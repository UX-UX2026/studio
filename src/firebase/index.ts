'use client';

// The Firebase configuration is now directly in this file to prevent loading issues.
export const firebaseConfig = {
  "projectId": "studio-845965156-c3a3b",
  "appId": "1:1014429404657:web:fe6855f3d2ed43d89bc850",
  "storageBucket": "studio-845965156-c3a3b.appspot.com",
  "apiKey": "AIzaSyBkP1hVPRjxoeuY9mRa7XU-0lZH5jdWzQo",
  "authDomain": "studio-845965156-c3a3b.firebaseapp.com",
  "messagingSenderId": "1014429404657",
  "measurementId": ""
};

// All initialization logic is now handled in FirebaseClientProvider.

export { FirebaseProvider, useFirebaseApp, useAuth, useFirestore } from './provider';
export { useUser, type UserRole, type UserStatus } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
