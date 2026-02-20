'use client';

import { ReactNode, useMemo } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { FirebaseProvider } from './provider';
import { firebaseConfig } from './index';

// This is a client-side only provider that initializes Firebase on the client.
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const firebase = useMemo(() => {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    return { app, auth, firestore };
  }, []);

  return <FirebaseProvider value={firebase}>{children}</FirebaseProvider>;
}
