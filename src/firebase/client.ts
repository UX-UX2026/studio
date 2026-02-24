'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// This is the public Firebase configuration for your web app.
export const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// This pattern ensures that we only initialize Firebase once, which is important
// in a Next.js environment with Hot Module Replacement (HMR).
if (!getApps().length) {
  if (!firebaseConfig.apiKey) {
    throw new Error('Missing Firebase API Key. Please check your .env.local file.');
  }
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);
// Connect to the default Firestore database instance.
firestore = getFirestore(app);

// Persistence is now handled in FirebaseClientProvider to ensure
// it's enabled before any Firestore operations are attempted.

// Export the initialized services as singletons.
export { app, auth, firestore };
