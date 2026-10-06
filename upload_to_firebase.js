import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = path.join(__dirname, "public", "assets", "raw_courts");
const BUCKET_NAME = "atxletsplay.firebasestorage.app"; // Your actual bucket name

// Initialize Firebase Admin (uses Application Default Credentials or standard auth)
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, "functions", "firebase-adminsdk.json"), "utf8").catch(() => "null")) || null;

if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: BUCKET_NAME
    });
} else {
    // Attempt fallback to local gcloud auth if no service account
    admin.initializeApp({
        storageBucket: BUCKET_NAME
    });
}

const bucket = admin.storage().bucket();

async function uploadFiles() {
    const files = fs.readdirSync(LOCAL_DIR).filter(f => f.endsWith("_raw.jpg"));
    console.log(`Found ${files.length} raw images to upload...`);

    for (const file of files) {
        // Strip out the "_raw" so it matches the expected courtId.jpg format!
        const cleanName = file.replace("_raw", "");
        const localPath = path.join(LOCAL_DIR, file);
        const destination = `raw_courts/${cleanName}`;

        console.log(`Uploading ${file} to ${destination}...`);
        
        try {
            await bucket.upload(localPath, {
                destination: destination,
                metadata: { contentType: "image/jpeg" }
            });
            console.log(` -> Success!`);
        } catch (err) {
            console.error(` -> Failed:`, err.message);
        }
    }
    
    console.log("\nAll raw photos routed to the Firebase Bucket! The OpenArt pipeline is now generating the banners.");
}

uploadFiles();
