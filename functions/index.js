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


