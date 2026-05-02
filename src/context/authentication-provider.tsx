'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, getAuth, type Auth } from 'firebase/auth';
import { 
  type Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore';
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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [firestore, setFirestore] = useState<Firestore | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_");
      if (!isConfigValid) {
        setInitError("Firebase configuration is missing. Please update your environment variables.");
        setIsLoading(false);
        return;
      }

      let firebaseApp: FirebaseApp;
      if (!getApps().length) {
        firebaseApp = initializeApp(firebaseConfig);
      } else {
        firebaseApp = getApp();
      }

      const firebaseAuth = getAuth(firebaseApp);
      
      let db: Firestore;
      try {
        // Try to get existing Firestore instance first
        db = getFirestore(firebaseApp);
      } catch (e) {
        // If not initialized, initialize it with persistent cache
        db = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        });
      }
      
      setApp(firebaseApp);
      setAuth(firebaseAuth);
      setFirestore(db);

      const unsubscribe = onAuthStateChanged(firebaseAuth, (authUser) => {
        setUser(authUser);
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error("Firebase Initialization Error", err);
      setInitError(err.message || "An unknown error occurred during Firebase setup.");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading || initError) return; 

    const isAuthPage = pathname === '/login';

    if (user) { 
      if (isAuthPage || pathname === '/') {
        router.replace('/dashboard');
      }
    } else { 
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
      app,
      auth,
      firestore,
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