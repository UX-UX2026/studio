'use client';

import { ReactNode } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

// This is a client-side only provider that initializes Firebase on the client.
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const firebase = initializeFirebase();
  return <FirebaseProvider value={firebase}>{children}</FirebaseProvider>;
}
