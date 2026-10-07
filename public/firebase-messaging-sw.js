/* Firebase Cloud Messaging service worker. Config arrives via query string (set in services/notifications.js). */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const p = new URL(self.location).searchParams;
firebase.initializeApp({
  apiKey: p.get('apiKey'),
  projectId: p.get('projectId'),
  messagingSenderId: p.get('messagingSenderId'),
  appId: p.get('appId'),
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || "ATX Let's Play", {
    body: n.body || '',
    icon: '/favicon.svg',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});
