'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore } from './client';
import { enableIndexedDbPersistence } from 'firebase/firestore';
import { Loader } from 'lucide-react';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);

  useEffect(() => {
    const initializePersistence = async () => {
      try {
        // This enables Firestore's offline capabilities.
        // It should be called before any other Firestore operations.
        await enableIndexedDbPersistence(firestore);
      } catch (err: any) {
        if (err.code === 'failed-precondition') {
          // This is a normal scenario when multiple tabs are open.
          // Persistence will be enabled in one tab only.
          console.warn('Firestore persistence failed: multiple tabs open. This is expected.');
        } else if (err.code === 'unimplemented') {
          // The browser does not support IndexedDB. Offline persistence is disabled.
          console.warn('Firestore persistence is not available in this browser. Proceeding without offline support.');
        } else {
            // An unexpected error occurred.
            console.error("An unexpected error occurred while enabling persistence:", err);
        }
      }
      // Once persistence is configured (or has failed gracefully), we can declare the client ready.
      // The individual components using Firestore (like AuthenticationProvider) are responsible for handling
      // online/offline states during data fetching.
      setIsPersistenceReady(true);
    };

    initializePersistence();
  }, []);

  if (!isPersistenceReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const firebase = { app, auth, firestore };

  return <FirebaseProvider value={firebase}>{children}</FirebaseProvider>;
}
