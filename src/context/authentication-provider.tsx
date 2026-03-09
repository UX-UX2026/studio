
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, type Firestore, getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { type Auth, getAuth } from 'firebase/auth';
import { type FirebaseApp, initializeApp, getApp, getApps } from 'firebase/app';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
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
}

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

// Define the context shape
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  department: string | null;
  isLoading: boolean;
  // also provide the services
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const [firebaseServices, setFirebaseServices] = useState<FirebaseServices | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const initialize = async () => {
      const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_");
      if (!isConfigValid) {
        throw new Error("Firebase configuration is missing or incomplete. Please update your environment variables (.env file for local development) and restart the server.");
      }

      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const auth = getAuth(app);
      const firestore = getFirestore(app);
      
      try {
        await enableIndexedDbPersistence(firestore);
      } catch (err: any) {
        if (err.code === 'failed-precondition') {
          console.warn("Firestore persistence failed (likely multiple tabs open). Continuing in online-only mode.");
        } else if (err.code === 'unimplemented') {
          console.warn("Persistence is not available in this browser. Continuing in online-only mode.");
        }
      }
      
      setFirebaseServices({ app, auth, firestore });
    };

    initialize().catch(err => {
        console.error("Fatal: Firebase Initialization Error", err);
        setInitError((err as Error).message || "An unknown error occurred during Firebase setup.");
    });
  }, []);

  useEffect(() => {
    if (!firebaseServices) {
      return;
    }
    
    const { auth, firestore } = firebaseServices;

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      const userRef = doc(firestore, 'users', authUser.uid);

      try {
        const profileSnap = await getDoc(userRef);

        if (profileSnap.exists()) {
          setUser(authUser);
          setProfile({ id: profileSnap.id, ...profileSnap.data() } as UserProfile);
        } else {
          // Profile doesn't exist, create it.
          const newProfile: Omit<UserProfile, 'id'> = {
            displayName: authUser.displayName || authUser.email?.split('@')[0] || 'New User',
            email: authUser.email!,
            photoURL: authUser.photoURL || `https://i.pravatar.cc/150?u=${authUser.email}`,
            role: 'Requester',
            department: 'Unassigned',
            status: 'Active' as const,
          };

          if (authUser.email === 'heinrich@ubuntux.co.za') {
            newProfile.role = 'Administrator';
            newProfile.department = 'Executive';
            const metadataRef = doc(firestore, 'app', 'metadata');
            await setDoc(metadataRef, { adminIsSetUp: true }, { merge: true });
          }
          
          await setDoc(userRef, newProfile);
          
          const createdProfile = { id: authUser.uid, ...newProfile };
          setUser(authUser);
          setProfile(createdProfile as UserProfile);
        }
      } catch (error) {
        console.error("Fatal: Could not get or create user profile.", error);
        toast({ variant: "destructive", title: "Authentication Error", description: (error as Error).message || "A critical error occurred while loading your profile." });
        if (auth) auth.signOut();
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [firebaseServices, toast, router]);

  useEffect(() => {
    if (isLoading || !firebaseServices) {
      return; 
    }

    const isAuthPage = pathname === '/login';

    if (user && profile) { 
      if (isAuthPage || pathname === '/') {
        router.replace('/dashboard');
      }
    } else {
      if (!isAuthPage) {
        router.replace('/login');
      }
    }
  }, [isLoading, user, profile, pathname, router, firebaseServices]);

  if (initError) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-background p-8">
              <div className="flex max-w-lg flex-col items-center gap-4 rounded-lg border border-destructive bg-destructive/5 p-6 text-center text-destructive">
                  <AlertTriangle className="h-10 w-10" />
                  <h1 className="text-xl font-bold">Firebase Error</h1>
                  <p className="text-sm">{initError}</p>
              </div>
          </div>
      );
  }

  if (isLoading || !firebaseServices) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      role: profile?.role || null,
      department: profile?.department || null,
      isLoading,
      app: firebaseServices.app,
      auth: firebaseServices.auth,
      firestore: firebaseServices.firestore,
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
