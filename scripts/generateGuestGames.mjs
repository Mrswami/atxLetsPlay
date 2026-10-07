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

const fakeGuestGames = [
  {
    courtId: "zilker-park-volleyball",
    courtName: "Zilker Park Sand Volleyball",
    subCourt: "Court 2",
    district: "south-central",
    sport: "volleyball",
    createdBy: "guest-test-1",
    creatorName: "Austin Volley Fan",
    hostName: "Austin Volley Fan",
    hostAvatarUrl: "/assets/characters_v1/preset_teen_chloe.jpg",
    status: "open",
    scheduledTime: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 15)), // 15 mins from now
    maxPlayers: 12,
    currentPlayers: ["guest-test-1", "user1", "user2"],
    skillLevel: "casual",
    notes: "Just for fun, bringing a net and extra ball.",
    createdAt: serverTimestamp(),
  },
  {
    courtId: "clark-field-basketball",
    courtName: "Clark Field Basketball",
    district: "downtown",
    sport: "basketball",
    createdBy: "guest-test-2",
    creatorName: "Hoops King",
    hostName: "Hoops King",
    hostAvatarUrl: "/assets/characters_v1/preset_adult_amir.jpg",
    status: "open",
    scheduledTime: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 5)), // 5 mins from now
    maxPlayers: 10,
    currentPlayers: ["guest-test-2", "user4"],
    skillLevel: "intermediate",
    notes: "Need 8 more for full court.",
    createdAt: serverTimestamp(),
  }
];

async function generate() {
  console.log("Generating guest games...");
  for (const game of fakeGuestGames) {
    try {
      const docRef = await addDoc(collection(db, 'games'), game);
      console.log("Generated game:", docRef.id);
    } catch (e) {
      console.error("Error generating game:", e);
    }
  }
  console.log("Done. Exiting.");
  process.exit(0);
}

generate();
