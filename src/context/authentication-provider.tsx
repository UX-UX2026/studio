'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { testUsers } from '@/lib/test-data';

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
  const [isLoading, setIsLoading] = useState(true); // Always start loading
  const router = useRouter();
  const pathname = usePathname();

  // Effect 1: Handle Auth State and Profile Fetching
  useEffect(() => {
    if (!firestore || !firebaseAuth) {
        setIsLoading(false); // Can't do anything, so stop loading
        return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (authUser) => {
      setIsLoading(true); // Set loading true at the start of any auth change
      if (authUser) {
        // User is signed in, fetch their profile.
        const userRef = doc(firestore, 'users', authUser.uid);
        try {
            const docSnap = await getDoc(userRef);
            let profileData: UserProfile;

            if (docSnap.exists()) {
              profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
              
              // Ensure heinrich is always admin
              const specialAdmin = testUsers.find(u => u.email.toLowerCase() === profileData.email.toLowerCase() && u.role === 'Administrator');
              if (specialAdmin && profileData.role !== 'Administrator') {
                await setDoc(userRef, { role: 'Administrator', department: 'Executive' }, { merge: true });
                profileData.role = 'Administrator';
                profileData.department = 'Executive';
              }
            } else {
              // Create new profile
              const metadataRef = doc(firestore, 'app', 'metadata');
              const metadataSnap = await getDoc(metadataRef);
              const needsAdminSetup = !metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp;
              
              // Check if the new user is the designated special admin
              const specialAdmin = testUsers.find(u => authUser.email && u.email.toLowerCase() === authUser.email.toLowerCase() && u.role === 'Administrator');

              let assignedRole = 'Requester';
              if (specialAdmin || needsAdminSetup) {
                assignedRole = 'Administrator';
                if (needsAdminSetup) {
                    await setDoc(metadataRef, { adminIsSetUp: true });
                }
              }

              const newProfile = {
                displayName: authUser.displayName || authUser.email?.split('@')[0] || 'New User',
                email: authUser.email!,
                photoURL: authUser.photoURL || `https://i.pravatar.cc/150?u=${authUser.email}`,
                role: assignedRole,
                department: assignedRole === 'Administrator' ? 'Executive' : 'Unassigned',
                status: 'Active' as const,
              };
              
              await setDoc(userRef, newProfile);
              profileData = { id: authUser.uid, ...newProfile };
            }
            // Set user and profile state together
            setUser(authUser);
            setProfile(profileData);
        } catch (error) {
            console.error("Auth Provider: Error during profile setup.", error);
            await firebaseAuth.signOut(); // Sign out on profile error
            setUser(null);
            setProfile(null);
        }
      } else {
        // No user is signed in.
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false); // End loading ONLY after all async logic for an auth change is done.
    });

    return () => unsubscribe();
  }, [firebaseAuth, firestore]);

  // Effect 2: Listen for real-time profile updates
  useEffect(() => {
    if (!user || !firestore) return;
    
    const userRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const newProfileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
        // Only update state if profile has actually changed to prevent loops
        setProfile(currentProfile => {
            if (JSON.stringify(currentProfile) !== JSON.stringify(newProfileData)) {
                return newProfileData;
            }
            return currentProfile;
        });
      } else {
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, [user, firestore]);

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
