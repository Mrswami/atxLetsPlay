import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

const getEnv = (key) => {
  if (typeof globalThis !== 'undefined' && globalThis.process && globalThis.process.env && globalThis.process.env[key]) {
    return globalThis.process.env[key];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  return '';
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
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
