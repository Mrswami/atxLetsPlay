import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { AUSTIN_COURTS_DATA } from './src/data/courtsMeta.js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'public', 'assets', 'courts');

// Firebase key acts as the GCP API Key (which has Places API enabled)
const GOOGLE_API_KEY = process.env.VITE_FIREBASE_API_KEY; 
const OPENART_API_KEY = process.env.OPENART_API_KEY; 

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getGooglePlacePhotoUrl(courtName, courtAddress) {
  try {
    const query = encodeURIComponent(`${courtName} ${courtAddress}`);
    const searchRes = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}`);
    const searchData = await searchRes.json();
    
    if (!searchData.results || searchData.results.length === 0) return null;
    
    const place = searchData.results[0];
    if (!place.photos || place.photos.length === 0) return null;
    
    const photoRef = place.photos[0].photo_reference;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_API_KEY}`;
  } catch (err) {
    console.error(`Error fetching Google Photo for ${courtName}:`, err);
    return null;
  }
}

async function generateOpenArtCartoon(photoUrl, court) {
  // We specify the retro pixely 3D isometric prompt as requested!
  const prompt = `A 3d isometric style but retro and pixely video game asset of a ${court.sport.join(' and ')} court at ${court.name}. Vibrant colors, highly detailed, tilt-shift, pixel art textures mixed with modern 3D lighting, masterpiece.`;
  
  try {
    console.log(`[OpenArt] Generating retro pixely 3D image for ${court.name}...`);
    
    // NOTE: This uses a standard OpenArt Image-to-Image REST endpoint structure. 
    // You may need to adjust the exact endpoint/payload to match your specific OpenArt subscription/tier.
    const res = await fetch('https://api.openart.ai/v1/image-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENART_API_KEY}`
      },
      body: JSON.stringify({
        image_url: photoUrl,
        prompt: prompt,
        negative_prompt: "photorealistic, ugly, text, watermark, blurry",
        style: "isometric 3d retro pixel",
        strength: 0.75 // How much to change the original image
      })
    });
    
    if (!res.ok) {
        throw new Error(`OpenArt API Error: ${res.statusText}`);
    }
    
    const data = await res.json();
    return data.image_url; // Adjust based on actual OpenArt response format
  } catch (err) {
    console.error(`Error with OpenArt generation for ${court.name}:`, err);
    return null;
  }
}

async function downloadImage(url, filepath) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
}

async function run() {
  console.log('Starting automated Court Banner generation pipeline...');
  
  if (!OPENART_API_KEY) {
      console.log('\n[!] WARNING: OPENART_API_KEY not found in .env! The script will fail at the OpenArt step.');
      console.log('Please add OPENART_API_KEY=your_key_here to your .env file.\n');
  }

  for (const court of AUSTIN_COURTS_DATA) {
    console.log(`\nProcessing: ${court.name}`);
    const outPath = path.join(OUTPUT_DIR, `${court.id}.jpg`);
    
    if (fs.existsSync(outPath)) {
        console.log(`=> Skipping ${court.id}, image already exists.`);
        continue;
    }

    console.log('1. Fetching real photo from Google Places...');
    const photoUrl = await getGooglePlacePhotoUrl(court.name, court.address);
    
    if (!photoUrl) {
      console.log(`=> No Google Photo found for ${court.name}. Skipping...`);
      continue;
    }
    
    console.log('2. Sending to OpenArt for retro pixely 3D processing...');
    const openArtUrl = await generateOpenArtCartoon(photoUrl, court);
    
    if (openArtUrl) {
       console.log('3. Downloading final asset...');
       await downloadImage(openArtUrl, outPath);
       console.log(`=> Successfully saved ${court.id}.jpg`);
    }
    
    // Sleep to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\nPipeline complete!');
}

run();
