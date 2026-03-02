
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';

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
    // This effect handles the result of a redirect sign-in when the page loads.
    if (!firebaseAuth) return;

    getRedirectResult(firebaseAuth)
      .then((result) => {
        if (result) {
          // The onAuthStateChanged observer will handle the user state update.
          // We can optionally toast a success message here.
          toast({ title: "Signed In", description: `Welcome back, ${result.user.displayName || result.user.email}!` });
        }
      }).catch((error) => {
        // Handle Errors here.
        console.error("Sign-in redirect error:", error);
        let description = error.message;
        if (error.code === 'auth/account-exists-with-different-credential') {
            description = "An account already exists with this email. Try signing in with the original method.";
        }
        toast({
            variant: "destructive",
            title: "Sign-In Failed",
            description,
        });
      });
  }, [firebaseAuth, toast]);


  useEffect(() => {
    if (!firebaseAuth || !firestore) {
      setIsLoading(false);
      return;
    };
    
    // This is the primary listener for authentication state changes.
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (authUser) => {
        setIsLoading(true);
        if (authUser) {
            // User is signed in. We must listen to their profile document.
            const userRef = doc(firestore, 'users', authUser.uid);
            const unsubscribeProfile = onSnapshot(userRef, 
              async (docSnap) => {
                if (docSnap.exists()) {
                    // Profile exists, set user and profile state, and stop loading.
                    setUser(authUser);
                    setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
                    setIsLoading(false);
                } else {
                    // Profile does NOT exist. This is the user's first sign-in.
                    try {
                        const metadataRef = doc(firestore, 'app', 'metadata');
                        const metadataSnap = await getDoc(metadataRef);

                        let userRole = 'Requester'; // Default role for new users
                        if (!metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp) {
                            userRole = 'Administrator';
                            // Set the flag to true so subsequent users don't become admins.
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
                        // The onSnapshot listener will now fire with the new data,
                        // which will then correctly set the profile and stop loading.
                    } catch(e) {
                        console.error("Fatal: Could not create user profile.", e);
                        toast({ variant: "destructive", title: "Profile Creation Failed", description: "A critical error occurred." });
                        if(firebaseAuth) firebaseAuth.signOut();
                        setIsLoading(false);
                    }
                }
              },
              (error) => {
                  console.error("Fatal: Firestore listener for profile failed.", error);
                  toast({ variant: "destructive", title: "Profile Error", description: "Could not load your profile." });
                  if(firebaseAuth) firebaseAuth.signOut();
                  setIsLoading(false);
              }
            );
            return () => unsubscribeProfile();
        } else {
            // User is signed out.
            setUser(null);
            setProfile(null);
            setIsLoading(false);
        }
    });

    return () => unsubscribeAuth();
  }, [firebaseAuth, firestore, toast]);


  useEffect(() => {
    // This effect handles routing logic *after* loading is complete.
    if (isLoading) {
      return; // Do nothing while loading.
    }

    const isAuthPage = pathname === '/login';

    if (user && profile) { 
      // User is fully authenticated. If they are on the login page or root,
      // redirect them to the dashboard.
      if (isAuthPage || pathname === '/') {
        router.replace('/dashboard');
      }
    } else {
      // User is not authenticated. Redirect to login if they aren't there already.
      if (!isAuthPage) {
        router.replace('/login');
      }
    }
  }, [isLoading, user, profile, pathname, router]);

  // Render children only when not loading. This prevents any child components
  // from attempting to access auth state or Firestore before it's ready.
  if (isLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
        </div>
    );
  }

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
