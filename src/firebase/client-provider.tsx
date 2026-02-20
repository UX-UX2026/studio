'use client';

import { ReactNode } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore } from './client'; // Import the singleton instances

// This provider now just passes the already-initialized instances to the context.
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const firebase = { app, auth, firestore };

  return <FirebaseProvider value={firebase}>{children}</FirebaseProvider>;
}
