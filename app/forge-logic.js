/**
 * ATX LET'S PLAY: THE CHARACTER FORGE (V1.0)
 * ──────────────────────────────────────────────────
 * This script automates the generation of lore-driven player profiles.
 * Run this overnight to populate the Austin map with unique characters.
 * 
 * Usage: 
 *   1. Ensure OPENAI_API_KEY is in your .env
 *   2. Run: node scripts/character-forge.js --count 50
 */

import 'dotenv/config';
import { OpenAI } from 'openai';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── LORE SEEDS ───
const LORE_SEEDS = {
  'downtown': {
    name: 'Downtown (Pease District)',
    vibe: 'High-Intensity Urban King',
    intensity: 5,
    loreDesc: 'Deep streetball culture, post-work hustlers, and local legends at Pease Park.'
  },
  'mueller': {
    name: 'Mueller',
    vibe: 'Neighborhood Strategists',
    intensity: 3,
    loreDesc: 'Family-driven but highly competitive, tech-savvy, and loyal to the neighborhood Parks.'
  },
  'hyde-park': {
    name: 'Hyde Park',
    vibe: 'Intellectual Tacticians',
    intensity: 4,
    loreDesc: 'Historic purists at Shipe Park. Technical mastery over flashy moves.'
  },
  'south-congress': {
    name: 'South Congress',
    vibe: 'Social Stylists',
    intensity: 2,
    loreDesc: 'Vibrant connects at Little Stacy. It is about the gear, the neon vibes, and the social energy.'
  }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// NOTE: You will need to download your serviceAccountKey.json from Firebase Console
// For now, this script will log to console in "Dry Run" mode.
const DRY_RUN = process.argv.includes('--dry');

async function forgeCharacter(districtKey) {
  const seed = LORE_SEEDS[districtKey];
  console.log(`[FORGING] Soul for ${seed.name}...`);

  const prompt = `
    You are an expert world-builder for 'ATX Let's Play', a social sports app.
    Generate a player profile for the '${seed.name}' district.
    District Personality: ${seed.vibe}
    Lore Context: ${seed.loreDesc}

    REQUIRED FIELDS (JSON):
    - displayName: A unique, catchy player handle (e.g., 'SoCoSpeed', 'MuellerMaverick').
    - bio: 2-sentence backstory integrated with the district lore.
    - skillLevel: A number (1.0 to 5.0) matching the district's intensity (${seed.intensity}).
    - xp: Initial experience points (500 to 5000).
    - vibeNote: A short "shout-out" they would use to call a game.
    - visualPrompt: A DALL-E 3 prompt for their 3D avatar (neon-retro Austin aesthetic).
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: "You are a creative game writer." }, { role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  const character = JSON.parse(response.choices[0].message.content);
  character.district = districtKey;
  character.createdAt = new Date().toISOString();

  return character;
}

async function runForge(count = 5) {
  console.log(`🚀 Starting the Forge for ${count} characters...`);
  
  for (let i = 0; i < count; i++) {
    const keys = Object.keys(LORE_SEEDS);
    const districtKey = keys[Math.floor(Math.random() * keys.length)];
    
    try {
      const soul = await forgeCharacter(districtKey);
      
      if (DRY_RUN) {
        console.log(`[DRY RUN] Generated: ${soul.displayName} | ${soul.bio}`);
      } else {
        // Here we would push to Firebase
        console.log(`[LIVE] Character Forge Ready for: ${soul.displayName}`);
        // await db.collection('profiles').add(soul);
      }
    } catch (err) {
      console.error(`❌ Error forging character ${i + 1}:`, err.message);
    }
  }
  
  console.log(`✅ Forge Operation Complete.`);
}

// EXECUTION
const count = parseInt(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1]) || 3;
runForge(count);
