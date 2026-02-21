'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

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
}

// Define the context shape
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  department: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const firebaseAuth = useFirebaseAuthInstance();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    if (!firebaseAuth) {
      setIsLoading(false);
      return;
    };
    
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (authUser) => {
        setUser(authUser);
        if (!authUser) {
            setProfile(null);
            setIsLoading(false);
        }
    });

    return () => unsubscribeAuth();
  }, [firebaseAuth]);


  useEffect(() => {
    if (!user || !firestore) {
      if (!user) {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    const userRef = doc(firestore, 'users', user.uid);

    const unsubscribeProfile = onSnapshot(userRef, 
      async (docSnap) => {
        try {
          if (docSnap.exists()) {
            const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
            setProfile(profileData);
            setIsLoading(false);
          } else {
            // --- Profile does NOT exist, create it ---
            let isAdmin = false;
            try {
                const metadataRef = doc(firestore, 'app', 'metadata');
                const metadataSnap = await getDoc(metadataRef);
                const needsAdminSetup = !metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp;
                if (needsAdminSetup) {
                    isAdmin = true;
                    await setDoc(metadataRef, { adminIsSetUp: true }, { merge: true });
                }
            } catch (e: any) {
                if (e.code === 'unavailable') {
                    console.warn("Could not check app metadata due to offline state. Assuming this is not the first admin setup.");
                } else {
                    throw e; // Re-throw other errors to be caught by the outer block
                }
            }
            
            const newProfile: Omit<UserProfile, 'id'> = {
              displayName: user.displayName || user.email?.split('@')[0] || 'New User',
              email: user.email!,
              photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.email}`,
              role: isAdmin ? 'Administrator' : 'Requester',
              department: isAdmin ? 'Executive' : 'Unassigned',
              status: 'Active' as const,
            };
            
            await setDoc(userRef, newProfile);
            // After setting, the onSnapshot listener will fire again with the new data.
            // We DO NOT set isLoading to false here. We wait for the next snapshot.
          }
        } catch (e: any) {
          // This is a catch-all for unexpected errors during profile creation/retrieval
          console.error("Auth Provider: A fatal error occurred during profile setup.", e);
          toast({ variant: "destructive", title: "Profile Error", description: `There was a critical problem setting up your profile: ${e.message}` });
          if (firebaseAuth) await firebaseAuth.signOut();
          setIsLoading(false);
        }
      },
      (error) => {
        // This error callback is for the onSnapshot listener itself.
        // It's the primary place to catch permission errors or truly fatal connection issues.
        console.error("Auth Provider: Firestore listener failed with a fatal error.", error);
        toast({
            variant: "destructive",
            title: "Profile Access Error",
            description: `Could not load your profile: ${error.message}. Please contact support.`
        });
        if (firebaseAuth) firebaseAuth.signOut();
        setIsLoading(false);
      }
    );

    return () => unsubscribeProfile();
  }, [user, firestore, firebaseAuth, toast]);


  useEffect(() => {
    if (isLoading) {
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
  }, [isLoading, user, profile, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, profile, role: profile?.role || null, department: profile?.department || null, isLoading }}>
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
