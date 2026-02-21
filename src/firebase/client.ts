'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// This is the public Firebase configuration for your web app.
export const firebaseConfig = {
  "projectId": "studio-845965156-c3a3b",
  "appId": "1:1014429404657:web:fe6855f3d2ed43d89bc850",
  "storageBucket": "studio-845965156-c3a3b.appspot.com",
  "apiKey": "AIzaSyBkP1hVPRjxoeuY9mRa7XU-0lZH5jdWzQo",
  "authDomain": "studio-845965156-c3a3b.firebaseapp.com",
  "messagingSenderId": "1014429404657",
  "measurementId": ""
};

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// This pattern ensures that we only initialize Firebase once, which is important
// in a Next.js environment with Hot Module Replacement (HMR).
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);
firestore = getFirestore(app);

// Persistence is now handled in FirebaseClientProvider to ensure
// it's enabled before any Firestore operations are attempted.

// Export the initialized services as singletons.
export { app, auth, firestore };
