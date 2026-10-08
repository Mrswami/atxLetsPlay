import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SPORTS = ['basketball', 'soccer', 'tennis', 'volleyball', 'pickleball', 'ultimate', 'baseball'];
const COURTS = [
  { id: 'zilker-park-volleyball', name: 'Zilker Park', district: 'south-central' },
  { id: 'clark-field-basketball', name: 'Clark Field', district: 'downtown' },
  { id: 'rosewood-park-tennis', name: 'Rosewood Park', district: 'east-austin' },
  { id: 'pease-park-basketball', name: 'Pease Park', district: 'downtown' }
];

async function generate() {
  console.log("Generating 20 stress-test games...");
  for (let i = 0; i < 20; i++) {
    const sport = SPORTS[i % SPORTS.length];
    const court = COURTS[i % COURTS.length];
    
    // Mix of times: 5 ended (3hrs ago), 5 live (now), 5 later today, 5 tomorrow
    let timeOffset;
    let status = 'open';
    if (i < 5) {
      timeOffset = -1000 * 60 * 60 * 3; // 3 hours ago (Ended)
    } else if (i < 10) {
      timeOffset = 1000 * 60 * 5; // 5 mins from now (Live)
    } else if (i < 15) {
      timeOffset = 1000 * 60 * 60 * 5; // 5 hours from now (Upcoming)
    } else {
      timeOffset = 1000 * 60 * 60 * 24; // tomorrow (Upcoming)
    }

    const game = {
      courtId: court.id,
      courtName: court.name,
      district: court.district,
      sport: sport,
      createdBy: `stress-test-${i}`,
      creatorName: `Tester ${i}`,
      hostName: `Tester ${i}`,
      hostAvatarUrl: "",
      status: status,
      scheduledTime: Timestamp.fromDate(new Date(Date.now() + timeOffset)),
      maxPlayers: 10,
      currentPlayers: [`stress-test-${i}`],
      skillLevel: "casual",
      notes: `Stress test game ${i}`,
      createdAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, 'games'), game);
      console.log(`Generated game ${i} (${sport}):`, docRef.id);
    } catch (e) {
      console.error("Error generating game:", e);
    }
  }
  console.log("Done. Exiting.");
  process.exit(0);
}

generate();
