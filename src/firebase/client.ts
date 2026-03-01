'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// This configuration now safely reads from environment variables.
// WARNING: For this to work in a deployed environment (like Vercel, Netlify, or Firebase App Hosting),
// you MUST set these environment variables in your hosting provider's settings. The `README.md` has been updated with instructions.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// This pattern ensures that we only initialize Firebase once.
// It also handles the case where environment variables might be missing.
try {
  if (getApps().length) {
    app = getApp();
  } else {
    if (!firebaseConfig.apiKey) {
      throw new Error("Firebase API Key is missing. Please set NEXT_PUBLIC_FIREBASE_API_KEY in your environment. For deployed sites, this must be set in your hosting provider's secret/environment variable settings.");
    }
    app = initializeApp(firebaseConfig);
  }
  auth = getAuth(app);
  firestore = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  // To prevent the app from crashing, we'll assign dummy objects.
  // The app will not function correctly with Firebase, but it won't crash.
  // @ts-ignore
  app = app || {};
  // @ts-ignore
  auth = auth || {};
  // @ts-ignore
  firestore = firestore || {};
}


// Export the initialized services as singletons.
export { app, auth, firestore };
