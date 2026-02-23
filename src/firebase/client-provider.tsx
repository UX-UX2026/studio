'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore } from './client';
import { enableIndexedDbPersistence, getDoc, doc } from 'firebase/firestore';
import { Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        await enableIndexedDbPersistence(firestore);
      } catch (err: any) {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence failed: multiple tabs open. App will work, but without offline support.');
          toast({
            title: "Offline Mode Disabled",
            description: "You have the app open in multiple tabs, so offline capabilities are turned off.",
            duration: 6000,
          });
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence is not available in this browser.');
        } else {
          console.error("An unexpected error occurred while enabling persistence:", err);
        }
      }

      // This "warm-up" read is critical. It forces the SDK to establish its
      // connection and determine if it's online or offline. By waiting for
      // this to complete (either succeed or fail), we prevent race conditions
      // where the app tries to write data before the SDK is ready.
      try {
        const warmUpDocRef = doc(firestore, 'app', 'metadata');
        await getDoc(warmUpDocRef);
      } catch (error) {
        console.warn("Firestore warm-up read failed, likely because you are offline. The app will proceed using cached data.", error);
      }
      
      // Now that persistence is enabled and the connection state is known,
      // the rest of the application can safely interact with Firestore.
      setIsFirebaseReady(true);
    };

    initializeFirebase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isFirebaseReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const firebase = { app, auth, firestore };

  return <FirebaseProvider value={value}>{children}</FirebaseProvider>;
}
