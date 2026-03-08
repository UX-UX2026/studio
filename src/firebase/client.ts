'use client';

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

// NOTE: Firebase services (app, auth, firestore) are now initialized
// within FirebaseClientProvider.tsx to ensure they are only created
// on the client-side and after config validation. This file now only
// exports the configuration.
