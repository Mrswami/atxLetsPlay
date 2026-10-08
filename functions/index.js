const { setGlobalOptions } = require('firebase-functions/v2');
setGlobalOptions({ region: 'us-central1' });
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { getStorage } = require("firebase-admin/storage");
const admin = require("firebase-admin");
const path = require("path");

admin.initializeApp();

// Configuration for OpenArt
const OPENART_API_KEY = process.env.OPENART_API_KEY || "YOUR_OPENART_KEY";

/**
 * Cloud Function Trigger: onObjectFinalized
 * Triggered whenever a new raw court photo is uploaded to Firebase Storage inside "raw_courts/"
 */
exports.onImageUpload = onObjectFinalized({ bucket: "atxletsplay.firebasestorage.app" }, async (event) => {
  const fileBucket = event.data.bucket; 
  const filePath = event.data.name; 
  const contentType = event.data.contentType;

  // Exit if this is triggered on a non-image, or if it's already in the stylized folder
  if (!contentType.startsWith("image/")) return console.log("This is not an image.");
  if (!filePath.startsWith("raw_courts/")) return console.log("Not in raw_courts folder.");

  console.log(`[Media Pipeline] New raw court image detected: ${filePath}`);

  const bucket = getStorage().bucket(fileBucket);
  const file = bucket.file(filePath);

  // Generate a signed URL so OpenArt can read the raw image
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: "03-01-2500" // Long expiration for API read
  });

  console.log(`[Media Pipeline] Sending ${signedUrl} to OpenArt for stylization...`);

  try {
    // 1. Call OpenArt REST API
    const response = await fetch("https://api.openart.ai/v1/image-to-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENART_API_KEY}`
      },
      body: JSON.stringify({
        image_url: signedUrl,
        prompt: "A 3d isometric style but retro and pixely video game asset of a sports court. Vibrant colors, masterpiece, tilt-shift, retro 3D.",
        style: "isometric 3d retro pixel",
        strength: 0.75
      })
    });

    if (!response.ok) {
      throw new Error(`OpenArt API Error: ${response.statusText}`);
    }

    const openArtData = await response.json();
    const stylizedUrl = openArtData.image_url;

    console.log(`[Media Pipeline] Received stylized image from OpenArt. Downloading...`);

    // 2. Download stylized image from OpenArt
    const stylizedRes = await fetch(stylizedUrl);
    const buffer = await stylizedRes.arrayBuffer();

    // 3. Save to the final stylized folder in Firebase Storage
    const fileName = path.basename(filePath);
    const newFilePath = `assets/courts/${fileName}`;
    const newFile = bucket.file(newFilePath);

    await newFile.save(Buffer.from(buffer), {
      metadata: { contentType: contentType }
    });

    console.log(`[Media Pipeline] Success! Stylized image saved to ${newFilePath}`);

  } catch (error) {
    console.error(`[Media Pipeline] Error processing image:`, error);
  }
});




// ─── Game reminders (push / email / SMS) ─────────────────────────────────────
// Runs every 5 minutes; reminds players ~1 hour before a game, honouring each user's
// notificationPrefs. Email uses the Firebase "Trigger Email" extension (collection: mail);
// SMS uses a Twilio-style extension (collection: messages). Both are no-ops until installed.
const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.sendGameReminders = onSchedule("every 5 minutes", async () => {
  const db = admin.firestore();
  const now = Date.now();
  const from = admin.firestore.Timestamp.fromMillis(now + 55 * 60000);
  const to = admin.firestore.Timestamp.fromMillis(now + 65 * 60000);

  const games = await db.collection("games")
    .where("scheduledTime", ">=", from)
    .where("scheduledTime", "<=", to)
    .get();

  for (const g of games.docs) {
    const game = g.data();
    if (game.reminderSent || !["open", "full"].includes(game.status)) continue;

    const when = game.scheduledTime.toDate().toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
    });
    const title = "Game starts in about an hour";
    const body = `${game.sport} at ${game.courtName} · ${when}`;
    const url = `/court/${game.courtId}`;

    for (const uid of game.currentPlayers || []) {
      const uSnap = await db.collection("users").doc(uid).get();
      if (!uSnap.exists) continue;
      const u = uSnap.data();
      const prefs = u.notificationPrefs || {};
      const ch = { push: false, email: false, sms: false, ...(prefs.channels || {}) };
      const gameRemindersOn = (prefs.events || {}).gameReminders !== false;
      if (!gameRemindersOn) continue;

      if (ch.push) {
        const devices = await db.collection("users").doc(uid).collection("devices").get();
        const tokens = devices.docs.map((d) => d.id);
        if (tokens.length) {
          const res = await admin.messaging().sendEachForMulticast({
            tokens, notification: { title, body }, data: { url },
          });
          // Clean up dead tokens
          res.responses.forEach((r, i) => {
            if (!r.success && /registration-token-not-registered|invalid-argument/.test(r.error?.code || "")) {
              devices.docs[i].ref.delete().catch(() => {});
            }
          });
        }
      }
      if (ch.email && u.email) {
        await db.collection("mail").add({
          to: u.email,
          message: { subject: `${title}: ${game.courtName}`, text: `${body}\nOpen: https://atxletsplay.web.app${url}` },
        });
      }
      if (ch.sms && prefs.phone) {
        await db.collection("messages").add({ to: prefs.phone, body: `ATX Let's Play: ${body}. Reply STOP to opt out.` });
      }
    }
    await g.ref.update({ reminderSent: true });
  }
});


// ─── Auto-close abandoned games ───────────────────────────────────────────────
exports.cleanAbandonedGames = onSchedule("every 1 hours", async () => {
  const db = admin.firestore();
  // Games older than 3 hours
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 3 * 60 * 60 * 1000);
  
  const games = await db.collection("games")
    .where("status", "in", ["open", "full"])
    .where("scheduledTime", "<", cutoff)
    .get();

  const batch = db.batch();
  let count = 0;
  for (const g of games.docs) {
    batch.update(g.ref, { status: "completed", autoClosed: true });
    count++;
    if (count === 500) {
      await batch.commit();
      count = 0;
    }
  }
  if (count > 0) {
    await batch.commit();
  }
  console.log(`Cleaned up ${games.docs.length} abandoned games.`);
});


// ─── Chat Spam & Profanity Filter ─────────────────────────────────────────────
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const PROFANITY_LIST = ["fuck", "shit", "bitch", "asshole", "cunt", "nigger", "faggot", "dick", "pussy"];

exports.filterChatMessages = onDocumentCreated("games/{gameId}/chat/{messageId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const data = snapshot.data();
  const text = (data.text || "").toLowerCase();

  // Basic profanity check
  const hasProfanity = PROFANITY_LIST.some(badWord => text.includes(badWord));

  if (hasProfanity) {
    console.log(`[Moderation] Filtered message ${snapshot.id} in game ${event.params.gameId}`);
    // Delete the message entirely
    await snapshot.ref.delete();
  }
});
