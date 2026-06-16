import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

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

async function updateModels() {
  console.log('Updating court 3D model URLs in Firestore...');

  await updateDoc(doc(db, 'courts', 'mueller-basketball-rec'), {
    modelUrl: '/models/basketball.glb',
  });
  console.log('  ✅ Updated mueller-basketball-rec');

  await updateDoc(doc(db, 'courts', 'mueller-petanque'), {
    modelUrl: '/models/basketball.glb',
  });
  console.log('  ✅ Updated mueller-petanque');

  console.log('🎉 Finished updating models!');
}

updateModels().catch(console.error);
