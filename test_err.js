import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
const GOOGLE_API_KEY = process.env.VITE_FIREBASE_API_KEY; 
const query = encodeURIComponent(`Pan American Rec Center Austin TX`);
const searchRes = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}`);
console.log(await searchRes.json());
