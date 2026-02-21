'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore } from './client';
import { enableIndexedDbPersistence } from 'firebase/firestore';
import { Loader } from 'lucide-react';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);

  useEffect(() => {
    // enableIndexedDbPersistence() is async. We must wait for it to complete
    // before rendering the rest of the app to prevent "client is offline" errors
    // on the initial load.
    enableIndexedDbPersistence(firestore)
      .then(() => {
        setIsPersistenceReady(true);
      })
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          // This is a normal scenario in a multi-tab environment.
          // Persistence is already enabled in another tab, so we can proceed.
          console.warn('Firestore persistence failed: multiple tabs open. This is expected.');
        } else if (err.code === 'unimplemented') {
          // The current browser does not support all of the features required for persistence.
          console.warn('Firestore persistence is not available in this browser. Proceeding without offline support.');
        } else {
            console.error("An unexpected error occurred while enabling persistence:", err);
        }
        // In any case, we allow the app to continue rendering.
        // The persistence just might not be enabled.
        setIsPersistenceReady(true);
      });
  }, []);

  // This prevents any child components from attempting to use Firestore before
  // the persistence layer is ready.
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
