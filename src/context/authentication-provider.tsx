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
    if (!firebaseAuth || !firestore) {
      // This should not happen if the provider is used correctly.
      setIsLoading(false);
      return;
    };
    
    // This is the primary listener for authentication state.
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (authUser) => {
        setIsLoading(true);
        if (authUser) {
            // User is signed in. Now, we MUST listen to their profile document.
            const userRef = doc(firestore, 'users', authUser.uid);
            const unsubscribeProfile = onSnapshot(userRef, 
              (docSnap) => {
                if (docSnap.exists()) {
                    // Profile exists, set user and profile state
                    setUser(authUser);
                    setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
                    setIsLoading(false);
                } else {
                    // Profile does NOT exist. We must create it.
                    // This logic prevents a race condition on first sign-in.
                    const newProfile: Omit<UserProfile, 'id'> = {
                        displayName: authUser.displayName || authUser.email?.split('@')[0] || 'New User',
                        email: authUser.email!,
                        photoURL: authUser.photoURL || `https://i.pravatar.cc/150?u=${authUser.email}`,
                        role: 'Administrator', // First user is always an admin
                        department: 'Executive',
                        status: 'Active' as const,
                    };

                    setDoc(userRef, newProfile).then(() => {
                        // The onSnapshot listener will fire again with the new data,
                        // which will then set the user and profile state correctly.
                        // We don't need to setLoading(false) here.
                    }).catch(e => {
                        console.error("Fatal: Could not create user profile.", e);
                        toast({ variant: "destructive", title: "Profile Creation Failed", description: "A critical error occurred while creating your user profile." });
                        firebaseAuth.signOut(); // Sign out on critical failure
                        setIsLoading(false);
                    });
                }
              },
              (error) => {
                  console.error("Fatal: Firestore listener for profile failed.", error);
                  toast({ variant: "destructive", title: "Profile Error", description: "Could not load your profile from the database." });
                  firebaseAuth.signOut();
                  setIsLoading(false);
              }
            );
            return () => unsubscribeProfile(); // Cleanup profile listener
        } else {
            // User is signed out.
            setUser(null);
            setProfile(null);
            setIsLoading(false);
        }
    });

    return () => unsubscribeAuth(); // Cleanup auth listener
  }, [firebaseAuth, firestore, toast]);


  useEffect(() => {
    // This effect handles routing based on the loading and auth state.
    if (isLoading) {
      return; 
    }

    const isAuthPage = pathname === '/login';

    if (user && profile) { 
      // User is fully authenticated with a profile.
      if (isAuthPage || pathname === '/') {
        router.replace('/dashboard');
      }
    } else {
      // User is not authenticated.
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
