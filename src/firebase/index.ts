import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';

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

// A private variable to hold the initialized instances.
let _firebaseInstances: { app: FirebaseApp; auth: Auth; firestore: Firestore; } | null = null;

export function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore; } {
  // If already initialized, return the existing instances.
  if (_firebaseInstances) {
    return _firebaseInstances;
  }

  // Initialize the app, or get the existing one.
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  // Initialize Firestore with long polling enabled.
  // This must only be called once.
  const firestore = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });

  // Cache the instances.
  _firebaseInstances = { app, auth, firestore };
  
  return _firebaseInstances;
}


export { FirebaseProvider, useFirebaseApp, useAuth, useFirestore } from './provider';
export { useUser, type UserRole, type UserStatus } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
