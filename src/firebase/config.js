import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || 'PLACEHOLDER').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'atxletsplay.firebaseapp.com').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || 'atxletsplay').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'atxletsplay.appspot.com').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
