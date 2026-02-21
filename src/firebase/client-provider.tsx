'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore } from './client';
import { enableIndexedDbPersistence, getDoc, doc } from 'firebase/firestore';
import { Loader } from 'lucide-react';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        // 1. Enable persistence. This is crucial for offline support and smooth startup.
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
        // 2. Perform a "warm-up" read. This forces the client to establish a
        // connection and ensures it's online before the rest of the app tries to
        // access data. We use a publicly readable document for this check.
        // This is the definitive fix for the "client is offline" race condition.
        const warmUpDocRef = doc(firestore, 'app', 'metadata');
        await getDoc(warmUpDocRef);
      } catch(error) {
        // This might fail if the user is genuinely offline, which is okay.
        // Persistence is enabled, so subsequent reads will come from the cache.
        // The key is that we've waited for the initial connection attempt to complete.
        console.warn("Firestore warm-up read failed, likely due to being offline. Proceeding with cached data.", error);
      }
      
      // 3. Once persistence is configured and the connection is warmed up, the app is ready.
      setIsFirebaseReady(true);
    };

    initializeFirebase();
  }, []);

  if (!isFirebaseReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const firebase = { app, auth, firestore };

  return <FirebaseProvider value={firebase}>{children}</FirebaseProvider>;
}
