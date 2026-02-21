'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { testUsers } from '@/lib/test-data';
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
    
    // This effect should only run once to set up the auth state listener.
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (authUser) => {
        setUser(authUser);
        if (!authUser) {
            // If user signs out, clear profile and stop loading.
            setProfile(null);
            setIsLoading(false);
        }
    });

    return () => unsubscribeAuth();
  }, [firebaseAuth]);


  useEffect(() => {
    if (!user || !firestore) {
      if (!user) {
        // If there's no user, we're done loading.
        setIsLoading(false);
      }
      return;
    }

    // A user is authenticated, start the process of getting their profile.
    // We set loading to true here, as we are now fetching a profile.
    setIsLoading(true);
    const userRef = doc(firestore, 'users', user.uid);

    const unsubscribeProfile = onSnapshot(userRef, 
      // Success Callback
      async (docSnap) => {
        try {
          if (docSnap.exists()) {
            const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
            const isSpecialAdmin = user.email && testUsers.some(u => u.email.toLowerCase() === user.email!.toLowerCase() && u.role === 'Administrator');
            if (isSpecialAdmin && profileData.role !== 'Administrator') {
                await setDoc(userRef, { role: 'Administrator', department: 'Executive' }, { merge: true });
                // The snapshot listener will re-trigger with the updated role. We just wait.
            } else {
                setProfile(profileData);
                setIsLoading(false); // SUCCESS: Profile is loaded.
            }
          } else {
             // --- Profile does NOT exist, create it ---
            const metadataRef = doc(firestore, 'app', 'metadata');
            const metadataSnap = await getDoc(metadataRef);
            const needsAdminSetup = !metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp;
            
            const isSpecialAdmin = user.email && testUsers.some(u => u.email.toLowerCase() === user.email!.toLowerCase() && u.role === 'Administrator');

            let assignedRole = 'Requester';
            if (isSpecialAdmin || needsAdminSetup) {
              assignedRole = 'Administrator';
              if (needsAdminSetup) {
                  await setDoc(metadataRef, { adminIsSetUp: true }, { merge: true });
              }
            }

            const newProfile: Omit<UserProfile, 'id'> = {
              displayName: user.displayName || user.email?.split('@')[0] || 'New User',
              email: user.email!,
              photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.email}`,
              role: assignedRole,
              department: assignedRole === 'Administrator' ? 'Executive' : 'Unassigned',
              status: 'Active' as const,
            };
            
            await setDoc(userRef, newProfile);
            // After setting, the onSnapshot listener will fire again with the new data.
            // We DO NOT set isLoading to false here. We wait for the next snapshot.
          }
        } catch (e: any) {
          console.error("Auth Provider: Error during profile setup/creation.", e);
          toast({ variant: "destructive", title: "Profile Error", description: `There was a problem setting up your profile: ${e.message}` });
          if (firebaseAuth) await firebaseAuth.signOut();
          setIsLoading(false);
        }
      },
      // Error Callback
      (error) => {
        // This is the critical part for handling the "client is offline" error.
        if (error.code === 'unavailable') {
            // Firestore is offline. This is not a fatal error.
            // The SDK will automatically try to reconnect. We just inform the user.
            console.warn("Could not fetch profile due to offline state. Will retry automatically.", error);
            toast({
                title: "You appear to be offline",
                description: "We'll keep trying to connect to load your profile."
            });
            // We DON'T sign out or stop loading. We let the listener retry.
        } else {
            // For any other error (permissions, etc.), it's serious.
            console.error("Auth Provider: Firestore listener failed with a fatal error.", error);
            toast({
                variant: "destructive",
                title: "Profile Access Error",
                description: `Could not load your profile: ${error.message}. Please contact support.`
            });
            if (firebaseAuth) firebaseAuth.signOut();
            setIsLoading(false); // Stop loading on fatal error.
        }
      }
    );

    return () => unsubscribeProfile();
  }, [user, firestore, firebaseAuth, toast]);


  useEffect(() => {
    // This effect handles routing, and it ONLY runs when loading is complete.
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
