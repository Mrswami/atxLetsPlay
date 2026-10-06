import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { AUSTIN_COURTS_DATA } from './src/data/courtsMeta.js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'public', 'assets', 'raw_courts');
const GOOGLE_API_KEY = process.env.VITE_FIREBASE_API_KEY; 

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getGooglePlacePhotoUrl(courtName, courtAddress) {
  try {
    const payload = { textQuery: `${courtName} ${courtAddress}` };
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.photos'
      },
      body: JSON.stringify(payload)
    });
    
    const searchData = await searchRes.json();
    
    if (!searchData.places || searchData.places.length === 0) return null;
    
    const place = searchData.places[0];
    if (!place.photos || place.photos.length === 0) return null;
    
    // Use the New Places API photo endpoint
    const photoName = place.photos[0].name;
    return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=800&key=${GOOGLE_API_KEY}`;
  } catch (err) {
    console.error(`Error fetching Google Photo for ${courtName}:`, err);
    return null;
  }
}

async function downloadImage(url, filepath) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
}

async function run() {
  console.log('Starting Google Places photo downloader...');

  for (const court of AUSTIN_COURTS_DATA) {
    const outPath = path.join(OUTPUT_DIR, `${court.id}_raw.jpg`);
    
    if (fs.existsSync(outPath)) {
        console.log(`=> Skipping ${court.name}, raw photo already downloaded.`);
        continue;
    }

    console.log(`Fetching photo for: ${court.name}`);
    const photoUrl = await getGooglePlacePhotoUrl(court.name, court.address);
    
    if (photoUrl) {
       await downloadImage(photoUrl, outPath);
       console.log(`=> Successfully saved ${court.id}_raw.jpg`);
    } else {
       console.log(`=> No photo found for ${court.name}`);
    }
    
    // Sleep to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\nPhoto downloading complete! Let me know when this is done.');
}

run();
