'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
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

  // Effect 1: Handle Auth State changes ONLY.
  // This just syncs the Firebase `User` object.
  useEffect(() => {
    if (!firebaseAuth) {
      setIsLoading(false);
      return;
    };
    const unsubscribe = onAuthStateChanged(firebaseAuth, (authUser) => {
      setUser(authUser);
    });
    return () => unsubscribe();
  }, [firebaseAuth]);

  // Effect 2: Handle Profile fetching, creation, and real-time updates.
  // This effect runs whenever the `user` object changes.
  useEffect(() => {
    // If there's no authenticated user, we clear the profile and finish loading.
    if (!user || !firestore) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    // A user is authenticated, start the process of getting their profile.
    setIsLoading(true);
    const userRef = doc(firestore, 'users', user.uid);

    const unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
      try {
        if (docSnap.exists()) {
          // --- Profile exists, use it ---
          const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
          
          // Ensure heinrich is always admin
          const isSpecialAdmin = user.email && testUsers.some(u => u.email.toLowerCase() === user.email!.toLowerCase() && u.role === 'Administrator');
          if (isSpecialAdmin && profileData.role !== 'Administrator') {
            await setDoc(userRef, { role: 'Administrator', department: 'Executive' }, { merge: true });
            profileData.role = 'Administrator';
            profileData.department = 'Executive';
          }
          setProfile(profileData);
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
          // After setting, the onSnapshot listener will fire again with the new data,
          // which will then call setProfile and finish loading.
          return;
        }
      } catch (e: any) {
        console.error("Auth Provider: Error during profile setup (onSnapshot).", e);
        toast({
          variant: "destructive",
          title: "Profile Error",
          description: `There was a problem loading your profile: ${e.message}`,
        });
        await firebaseAuth.signOut();
      } finally {
        // Whether it succeeded or failed, the profile loading process is done for now.
        setIsLoading(false);
      }
    },
    // ---- onSnapshot Error Handler ----
    (error) => {
        console.error("Auth Provider: Firestore listener failed.", error);
        toast({
            variant: "destructive",
            title: "Connection Error",
            description: "Could not connect to the database to load your profile. Please check your network and try again."
        });
        firebaseAuth.signOut();
        setIsLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user, firestore, firebaseAuth, toast]);


  // Effect 3: Centralized routing logic
  useEffect(() => {
    if (isLoading) {
      return; // Do NOTHING until loading is false.
    }

    const isAuthPage = pathname === '/login';

    if (user && profile) { // Check for both user and profile
      // User is logged in with a profile.
      if (isAuthPage || pathname === '/') {
        router.replace('/dashboard');
      }
    } else {
      // User is not logged in.
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
