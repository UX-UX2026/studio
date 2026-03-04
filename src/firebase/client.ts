'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';


// =================================================================================
// IMPORTANT - DEPLOYMENT CONFIGURATION
// =================================================================================
// For your deployed site to work, you MUST replace the placeholder values below
// with your actual Firebase project configuration. This is not the recommended
// secure practice for a production app, but it is necessary if you cannot use
// your hosting provider's secret management features (which may require billing).
//
// 1. Go to your Firebase project settings.
// 2. Under "Your apps", find your web app.
// 3. Copy the `firebaseConfig` object.
// 4. Paste it here, replacing the placeholder values.
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
