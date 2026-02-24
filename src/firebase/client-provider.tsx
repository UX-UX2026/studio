'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore } from './client';
import { getDoc, doc } from 'firebase/firestore';
import { Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const initializeFirebase = async () => {
      // Offline persistence has been disabled as a diagnostic step to resolve connection timeouts.
      
      // This "warm-up" read is critical. It forces the SDK to establish its
      // connection and determine if it's online or offline. By waiting for
      // this to complete (either succeed or fail), we prevent race conditions
      // where the app tries to write data before the SDK is ready.
      try {
        const warmUpDocRef = doc(firestore, 'app', 'metadata');
        await getDoc(warmUpDocRef);
      } catch (error) {
        console.warn("Firestore warm-up read failed, likely because you are offline or the backend is unreachable.", error);
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

  return <FirebaseProvider value={firebase}>{children}</FirebaseProvider>;
}
