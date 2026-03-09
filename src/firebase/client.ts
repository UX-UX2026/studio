
'use client';

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';


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
 /* apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"*/
  apiKey: "AIzaSyBkP1hVPRjxoeuY9mRa7XU-0lZH5jdWzQo",
  authDomain: "studio-845965156-c3a3b.firebaseapp.com",
  projectId: "studio-845965156-c3a3b",
  storageBucket: "studio-845965156-c3a3b.firebasestorage.app",
  messagingSenderId: "1014429404657",
  appId: "1:1014429404657:web:fe6855f3d2ed43d89bc850"
};


let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// This pattern ensures that we only initialize Firebase once.
try {
  if (getApps().length) {
    app = getApp();
  } else {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
      console.error("Firebase configuration is missing or incomplete. Please update src/firebase/client.ts with your project's configuration.");
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
