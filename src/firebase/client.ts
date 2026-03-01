'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// WARNING: It is strongly recommended to use environment variables for your Firebase
// configuration and to load them via process.env. The configuration below is
// hard-coded for demonstration purposes only because access to the secret manager
// was not available. This is not secure for a production application.
export const firebaseConfig = {
  apiKey: "AIzaSyBkP1hVPRjxoeuY9mRa7XU-0lZH5jdWzQo",
  authDomain: "studio-845965156-c3a3b.firebaseapp.com",
  projectId: "studio-845965156-c3a3b",
  storageBucket: "studio-845965156-c3a3b.appspot.com",
  messagingSenderId: "1014429404657",
  appId: "1:1014429404657:web:f4177556da3ea6ea9bc850",
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
// Connect to the default Firestore database instance.
firestore = getFirestore(app);

// Export the initialized services as singletons.
export { app, auth, firestore };
