'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  type Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';
import { type Auth, getAuth } from 'firebase/auth';
import { type FirebaseApp, initializeApp, getApp, getApps } from 'firebase/app';
import { usePathname, useRouter } from 'next/navigation';
import { Loader, AlertTriangle } from 'lucide-react';
import { firebaseConfig } from '@/firebase/client';

export type UserRole = string | null;
export type UserStatus = 'Active' | 'Invited' | null;

export interface UserProfile {
    id: string;
    role: UserRole;
    department: string;
    departmentId: string | null;
    status: UserStatus;
    displayName?: string;
    email: string;
    photoURL?: string;
    alternateEmail?: string;
    notificationPreference?: 'Primary' | 'Alternate' | 'Both';
    delegatedToId?: string;
    delegatedToName?: string;
    reportingDepartments?: string[];
    companyIds?: string[];
}

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

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
          setInitError("Firebase configuration is missing. Please update your environment variables.");
          setIsLoading(false);
          return;
        }

        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const auth = getAuth(app);
        
        let firestore: Firestore;
        try {
          // Robust initialization: try to get existing instance first to avoid "different options" error
          firestore = getFirestore(app);
        } catch (e) {
          firestore = initializeFirestore(app, {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager()
            })
          });
        }
        
        setFirebaseServices({ app, auth, firestore });
      } catch (err) {
        console.error("Firebase Initialization Error", err);
        setInitError((err as Error).message || "An unknown error occurred during Firebase setup.");
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (!firebaseServices) return;
    
    const { auth } = firebaseServices;

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseServices]);

  useEffect(() => {
    if (isLoading) return; 

    const isAuthPage = pathname === '/login';

    if (user) { 
      if (isAuthPage || pathname === '/') {
        router.replace('/dashboard');
      }
    } else if (!initError) { 
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
                  <h1 className="text-xl font-bold">Configuration Error</h1>
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
