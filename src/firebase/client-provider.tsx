'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/client';
import { AlertTriangle, Loader } from 'lucide-react';

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [firebase, setFirebase] = useState<FirebaseServices | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("FirebaseClientProvider: Mounting...");

    const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_");
    if (!isConfigValid) {
      const errorMessage = "Firebase configuration is missing or incomplete. Please update your environment variables (.env file for local development) and restart the server.";
      console.error("FirebaseClientProvider: " + errorMessage);
      setError(errorMessage);
      return;
    }
    console.log("FirebaseClientProvider: Config is valid.");

    const initialize = () => {
      try {
        console.log("FirebaseClientProvider: Initializing Firebase (simplified)...");
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        console.log("FirebaseClientProvider: Core services initialized.");
        return { app, auth, firestore };
      } catch (err) {
        console.error("FirebaseClientProvider: Initialization failed with an unexpected error.", err);
        throw err;
      }
    };

    if (!firebase && !error) {
      try {
        const services = initialize();
        console.log("FirebaseClientProvider: Initialization successful. Setting state.");
        setFirebase(services);
      } catch (err: any) {
        const errorMessage = err.message || "An unexpected error occurred during Firebase setup.";
        console.error("FirebaseClientProvider: Initialization catch block error:", errorMessage);
        setError(errorMessage);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once

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
