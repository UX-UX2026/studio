'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// This is the public Firebase configuration for your web app.
export const firebaseConfig = {
  "projectId": "uxprocurementportal",
  "appId": "1:699115796238:web:1a8435d8a8b134d1c1a2f9",
  "storageBucket": "uxprocurementportal.appspot.com",
  "apiKey": "AIzaSyC0a7a01BI-REDACTED",
  "authDomain": "uxprocurementportal.firebaseapp.com",
  "messagingSenderId": "699115796238"
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
