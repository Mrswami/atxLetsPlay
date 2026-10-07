// Push notification registration (FCM). Delivery is done server-side (see functions/index.js).
import app, { db } from '../firebase/config';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

export const DEFAULT_PREFS = {
  channels: { push: false, email: true, sms: false },
  events: { gameReminders: true, courtInvites: true, friendInvites: true, friendAdds: true },
  phone: '',
};

export function mergePrefs(saved) {
  return {
    channels: { ...DEFAULT_PREFS.channels, ...(saved?.channels || {}) },
    events: { ...DEFAULT_PREFS.events, ...(saved?.events || {}) },
    phone: saved?.phone || '',
  };
}

// US-first E.164 normalisation. Returns '' if it doesn't look like a valid number.
export function normalizePhone(raw = '') {
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  const only = digits.replace(/\D/g, '');
  if (only.length === 10) return `+1${only}`;
  if (only.length === 11 && only.startsWith('1')) return `+${only}`;
  return '';
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

async function registerWorker() {
  const o = app.options;
  const qs = new URLSearchParams({
    apiKey: o.apiKey, projectId: o.projectId, messagingSenderId: o.messagingSenderId, appId: o.appId,
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`);
}

export async function enablePush(uid) {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device/browser.');
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error('Push is not configured yet (missing VAPID key).');
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) throw new Error('Push notifications are not supported here.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Enable them in your browser settings.');
  const reg = await registerWorker();
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error('Could not get a push token.');
  await setDoc(doc(db, 'users', uid, 'devices', token), {
    platform: navigator.userAgent.slice(0, 120),
    createdAt: serverTimestamp(),
  });
  return token;
}

export async function disablePush(uid) {
  try {
    const { getMessaging, deleteToken, isSupported } = await import('firebase/messaging');
    if (await isSupported()) await deleteToken(getMessaging(app));
  } catch { /* token may already be gone */ }
  const snap = await getDocs(collection(db, 'users', uid, 'devices'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
