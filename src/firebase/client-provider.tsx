'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore, firebaseConfig } from '@/firebase/client';
import { enableIndexedDbPersistence } from 'firebase/firestore';
import { AlertTriangle, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const { toast } = useToast();

  const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_");

  useEffect(() => {
    if (!isConfigValid) {
      return;
    }

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
  }, [isConfigValid]);

  if (!isConfigValid) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-8">
        <div className="flex max-w-lg flex-col items-center gap-4 rounded-lg border border-destructive bg-destructive/5 p-6 text-center text-destructive">
          <AlertTriangle className="h-10 w-10" />
          <h1 className="text-xl font-bold">Firebase Not Configured</h1>
          <p className="text-sm">
            Your Firebase configuration is missing or incomplete. Please update your environment variables (the <code>.env</code> file for local development) with your project's configuration and restart the development server. For production, ensure these variables are set in your hosting provider's settings.
          </p>
        </div>
      </div>
    );
  }

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
