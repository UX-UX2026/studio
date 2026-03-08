'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore } from '@/firebase/client';
import { enableIndexedDbPersistence } from 'firebase/firestore';
import { Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        // This enables Firestore's offline capabilities.
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

      // Once persistence is enabled, the app is ready for Firestore operations.
      // The SDK will handle being online or offline automatically.
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

  return <FirebaseProvider value={firebase}>{children}</FirebaseProvider>;
}
