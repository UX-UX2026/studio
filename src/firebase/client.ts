'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';


// =================================================================================
// IMPORTANT - DEPLOYMENT CONFIGURATION
// =================================================================================
// This app is configured to load your Firebase credentials from environment
// variables. This is the secure, industry-standard method.
//
// For local development, create or update the .env file in the root of your
// project and add the variables with your Firebase project config.
//
// For production, add these environment variables to your hosting provider's
// settings (e.g., Firebase App Hosting, Vercel, Netlify).
// =================================================================================
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};


let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// This pattern ensures that we only initialize Firebase once.
try {
  if (getApps().length) {
    app = getApp();
  } else {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_")) {
      console.error("Firebase configuration is missing or incomplete. Please update your environment variables (.env file for local development) with your project's configuration.");
    }
    // @ts-ignore
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
