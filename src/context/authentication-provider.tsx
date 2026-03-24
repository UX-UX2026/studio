
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { type Firestore, getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { type Auth, getAuth } from 'firebase/auth';
import { type FirebaseApp, initializeApp, getApp, getApps } from 'firebase/app';
import { usePathname, useRouter } from 'next/navigation';
import { Loader, AlertTriangle } from 'lucide-react';
import { firebaseConfig } from '@/firebase/client';


// Define the UserProfile shape
export type UserRole = string | null;
export type UserStatus = 'Active' | 'Invited' | null;

export interface UserProfile {
    id: string;
    role: UserRole;
    department: string;
    status: UserStatus;
    displayName?: string;
    email: string;
    photoURL?: string;
    alternateEmail?: string;
    notificationPreference?: 'Primary' | 'Alternate' | 'Both';
    approvableDepartmentIds?: string[];
}

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

// The context now only provides the core Firebase services and the auth User object.
// Profile data is handled by the useUser hook.
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const [firebaseServices, setFirebaseServices] = useState<FirebaseServices | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initialize = async () => {
      try {
        const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_");
        if (!isConfigValid) {
          setInitError("Firebase configuration is missing or incomplete. For local development, please update your .env file. For production (e.g., Vercel), set the required environment variables in your project settings. Then, restart your development server or redeploy.");
          setIsLoading(false); // Stop loading, show error
          return;
        }

        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        
        try {
          await enableIndexedDbPersistence(firestore);
          console.log("Firestore offline persistence enabled.");
        } catch (err: any) {
          if (err.code === 'failed-precondition') {
            console.warn("Firestore persistence failed (likely multiple tabs open). Continuing in online-only mode.");
          } else if (err.code === 'unimplemented') {
            console.warn("Persistence is not available in this browser. Continuing in online-only mode.");
          }
        }
        
        setFirebaseServices({ app, auth, firestore });
      } catch (err) {
        console.error("Fatal: Firebase Initialization Error", err);
        setInitError((err as Error).message || "An unknown error occurred during Firebase setup.");
        setIsLoading(false); // Stop loading, show error
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (!firebaseServices) {
      if (!isLoading) {
          // The error UI will be shown by the initError check
      }
      return;
    }
    
    const { auth } = firebaseServices;

    // This listener now ONLY handles the user's authentication state (logged in or out).
    // It does not touch the database.
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseServices, isLoading]);

  useEffect(() => {
    if (isLoading) return; 

    const isAuthPage = pathname === '/login';

    if (user) { 
      if (isAuthPage || pathname === '/') {
        router.replace('/dashboard');
      }
    } else if (!initError) { // Don't redirect if there's an init error
      if (!isAuthPage) {
        router.replace('/login');
      }
    }
  }, [isLoading, user, pathname, router, initError]);

  if (initError) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-background p-8">
              <div className="flex max-w-lg flex-col items-center gap-4 rounded-lg border border-destructive bg-destructive/5 p-6 text-center text-destructive">
                  <AlertTriangle className="h-10 w-10" />
                  <h1 className="text-xl font-bold">Firebase Configuration Error</h1>
                  <p className="text-sm">{initError}</p>
              </div>
          </div>
      );
  }
  
  if (isLoading || (pathname !== '/login' && !user)) {
     return (
        <div className="flex h-screen items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      app: firebaseServices?.app || null,
      auth: firebaseServices?.auth || null,
      firestore: firebaseServices?.firestore || null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthentication = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthentication must be used within an AuthenticationProvider');
  }
  return context;
};

    