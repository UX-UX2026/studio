import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

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

export function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore } {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  return { app, auth, firestore };
}

export { FirebaseProvider, useFirebaseApp, useAuth, useFirestore } from './provider';
export { useUser, type UserRole } from './auth/use-user';
