import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
const GOOGLE_API_KEY = process.env.VITE_FIREBASE_API_KEY; 

async function test() {
  const payload = { textQuery: "Pan American Rec Center Austin TX" };
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.photos'
    },
    body: JSON.stringify(payload)
  });
  console.log(await res.json());
}
test();
