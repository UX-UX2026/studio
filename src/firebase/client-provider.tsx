'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/client';
import { AlertTriangle, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [firebase, setFirebase] = useState<FirebaseServices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_");

    if (!isConfigValid) {
      setError("Firebase configuration is missing or incomplete. Please update your environment variables (.env file for local development) and restart the server.");
      return;
    }

    const initialize = async () => {
      try {
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        
        await enableIndexedDbPersistence(firestore);
        
        setFirebase({ app, auth, firestore });

      } catch (err: any) {
        // Gracefully handle persistence errors (e.g., multiple tabs open)
        // by initializing the app anyway for online-only mode.
        if (err.code === 'failed-precondition' || err.code === 'unimplemented') {
          if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence failed: multiple tabs open. App will work, but without offline support.');
            toast({
              title: "Offline Mode Disabled",
              description: "You have the app open in multiple tabs, so offline capabilities are turned off.",
              duration: 6000,
            });
          } else {
             console.warn('Firestore persistence is not available in this browser.');
          }
          
          const app = getApp();
          const auth = getAuth(app);
          const firestore = getFirestore(app);
          setFirebase({ app, auth, firestore });
        } else {
          console.error("Firebase initialization failed:", err);
          setError(err.message || "An unexpected error occurred during Firebase setup.");
        }
      }
    };

    if (!firebase) {
      initialize();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-8">
        <div className="flex max-w-lg flex-col items-center gap-4 rounded-lg border border-destructive bg-destructive/5 p-6 text-center text-destructive">
          <AlertTriangle className="h-10 w-10" />
          <h1 className="text-xl font-bold">Firebase Error</h1>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!firebase) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <FirebaseProvider value={firebase}>{children}</FirebaseProvider>;
}
