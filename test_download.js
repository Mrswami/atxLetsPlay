import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'public', 'assets', 'raw_courts');
const GOOGLE_API_KEY = process.env.VITE_FIREBASE_API_KEY; 

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getPhoto(courtName, courtAddress) {
  const query = encodeURIComponent(`${courtName} ${courtAddress}`);
  console.log('Searching for:', query);
  const searchRes = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}`);
  const searchData = await searchRes.json();
  
  if (!searchData.results || searchData.results.length === 0) {
    console.log('No results found');
    return;
  }
  
  const place = searchData.results[0];
  if (!place.photos || place.photos.length === 0) {
    console.log('No photos found for place');
    return;
  }
  
  const photoRef = place.photos[0].photo_reference;
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_API_KEY}`;
  
  console.log('Downloading photo...');
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'pan_am_raw.jpg'), Buffer.from(buffer));
  console.log('Saved to pan_am_raw.jpg');
}

getPhoto('Pan American Rec Center', 'Austin TX');
