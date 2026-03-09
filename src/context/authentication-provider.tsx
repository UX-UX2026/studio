
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs, writeBatch, type Firestore, getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { type Auth, getAuth } from 'firebase/auth';
import { type FirebaseApp, initializeApp, getApps, getApp } from 'firebase/app';
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
  // Combined state
  const [firebaseServices, setFirebaseServices] = useState<FirebaseServices | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // 1. Initialize Firebase
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
        setInitError(err.message || "An unknown error occurred during Firebase setup.");
    });
  }, []);

  // 2. Observe Auth State and User Profile
  useEffect(() => {
    if (!firebaseServices) {
      return;
    }
    
    const { auth, firestore } = firebaseServices;
    let unsubscribeProfile: (() => void) | undefined;

    const authStateObserver = onAuthStateChanged(auth, (authUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }
      
      if (!authUser) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      const userRef = doc(firestore, 'users', authUser.uid);

      unsubscribeProfile = onSnapshot(userRef, async (profileSnap) => {
        if (profileSnap.exists()) {
          setUser(authUser);
          setProfile({ id: profileSnap.id, ...profileSnap.data() } as UserProfile);
          setIsLoading(false);
        } else {
          try {
            const invitesQuery = query(collection(firestore, 'users'), where('email', '==', authUser.email));
            const invitesSnapshot = await getDocs(invitesQuery);
            const invitedDocs = invitesSnapshot.docs.filter(doc => doc.data().status === 'Invited');
            
            if (invitedDocs.length > 0) {
              const inviteDoc = invitedDocs[0];
              const invitedProfileData = inviteDoc.data();
              
              const newProfileData = {
                ...invitedProfileData,
                displayName: authUser.displayName || invitedProfileData.displayName,
                email: authUser.email!,
                photoURL: authUser.photoURL || invitedProfileData.photoURL,
                status: 'Active' as const,
              };
              
              const batch = writeBatch(firestore);
              batch.set(userRef, newProfileData);
              batch.delete(inviteDoc.ref);
              await batch.commit();
            } else {
              const metadataRef = doc(firestore, 'app', 'metadata');
              const metadataSnap = await getDoc(metadataRef);
              
              let userRole = 'Requester';
              if (authUser.email === 'heinrich@ubuntux.co.za' || !metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp) {
                userRole = 'Administrator';
                await setDoc(metadataRef, { adminIsSetUp: true }, { merge: true });
              }
              
              const newProfile: Omit<UserProfile, 'id'> = {
                displayName: authUser.displayName || authUser.email?.split('@')[0] || 'New User',
                email: authUser.email!,
                photoURL: authUser.photoURL || `https://i.pravatar.cc/150?u=${authUser.email}`,
                role: userRole,
                department: userRole === 'Administrator' ? 'Executive' : 'Unassigned',
                status: 'Active' as const,
              };
              await setDoc(userRef, newProfile);
            }
          } catch (error) {
            console.error("Fatal: Could not create user profile.", error);
            toast({ variant: "destructive", title: "Profile Creation Failed", description: (error as Error).message || "A critical error occurred." });
            if(auth) auth.signOut();
            setIsLoading(false);
          }
        }
      }, (error) => {
        console.error("Fatal: Firestore listener for profile failed.", error);
        toast({ variant: "destructive", title: "Profile Error", description: "Could not load your profile." });
        if(auth) auth.signOut();
        setIsLoading(false);
      });
    });

    return () => {
      authStateObserver();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [firebaseServices, toast, router]);

  // 3. Handle routing
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

  // Render states
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
