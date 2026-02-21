'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore } from './client';
import { enableIndexedDbPersistence, getDoc, doc } from 'firebase/firestore';
import { Loader } from 'lucide-react';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        await enableIndexedDbPersistence(firestore);
      } catch (err: any) {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence failed: multiple tabs open. This is expected.');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence is not available in this browser. Proceeding without offline support.');
        } else {
            console.error("An unexpected error occurred while enabling persistence:", err);
        }
      }

      try {
        // "Warm-up" read to ensure client is online before proceeding.
        // We use a document that is publicly readable according to firestore.rules.
        const metadataRef = doc(firestore, 'app', 'metadata');
        await getDoc(metadataRef);
      } catch(error) {
          // This might fail if the user is truly offline for the first time
          // and the cache is empty. We'll log it but proceed, as onSnapshot
          // should handle retries.
          console.warn("Firestore warm-up read failed. This can happen on first load when offline.", error);
      }
      
      // After attempting persistence and warm-up, we declare Firebase ready.
      setIsPersistenceReady(true);
    };

    initializeFirebase();
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
