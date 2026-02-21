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
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Effect 1: Handle Firebase Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (authUser) => {
      setUser(authUser);
      if (!authUser) {
        // If there's no authenticated user, we're done loading.
        setProfile(null);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [firebaseAuth]);

  // Effect 2: Fetch or create user profile from Firestore when user is authenticated
  useEffect(() => {
    // Don't proceed if we don't have a user or firestore instance
    if (!user || !firestore) {
      // If there's no user object, the first effect already handles setting isLoading to false.
      return;
    }

    const fetchOrCreateProfile = async () => {
      const userRef = doc(firestore, 'users', user.uid);
      try {
        const docSnap = await getDoc(userRef);
        let profileData: UserProfile;

        if (docSnap.exists()) {
          profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
          
          const specialAdmin = testUsers.find(u => u.email.toLowerCase() === profileData.email.toLowerCase() && u.role === 'Administrator');
          if (specialAdmin && profileData.role !== 'Administrator') {
            console.log(`Auth Provider: Correcting role for special admin ${'\'\'\''}profileData.email{'\'\'\''}.`);
            await setDoc(userRef, { role: 'Administrator', department: 'Executive' }, { merge: true });
            profileData.role = 'Administrator';
            profileData.department = 'Executive';
          }
        } else {
          console.log(`Auth Provider: No profile for ${'\'\'\''}user.uid{'\'\'\''}. Creating...`);
          const metadataRef = doc(firestore, 'app', 'metadata');
          const metadataSnap = await getDoc(metadataRef);
          const needsAdminSetup = !metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp;
          
          const specialAdmin = testUsers.find(u => u.email.toLowerCase() === user.email!.toLowerCase() && u.role === 'Administrator');

          let assignedRole = 'Requester';
          if (specialAdmin || needsAdminSetup) {
            assignedRole = 'Administrator';
            if (needsAdminSetup) {
                console.log('Auth Provider: First user detected. Assigning Administrator role.');
                await setDoc(metadataRef, { adminIsSetUp: true });
            }
          }

          const newProfile = {
            displayName: user.displayName || user.email?.split('@')[0] || 'New User',
            email: user.email!,
            photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${'\'\'\''}user.email{'\'\'\''}`,
            role: assignedRole,
            department: assignedRole === 'Administrator' ? 'Executive' : 'Unassigned',
            status: 'Active' as const,
          };
          
          await setDoc(userRef, newProfile);
          profileData = { id: user.uid, ...newProfile };
        }
        setProfile(profileData);
      } catch (error) {
        console.error("Auth Provider: Error during profile setup.", error);
        await firebaseAuth.signOut();
        setProfile(null);
      } finally {
        // Profile has been fetched/created or an error occurred. We can stop loading.
        setIsLoading(false);
      }
    };

    fetchOrCreateProfile();
  }, [user, firestore, firebaseAuth]);

  // Effect 3: Listen for real-time profile updates
  useEffect(() => {
    if (!user || !firestore) return;
    
    const userRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile((prevProfile) => {
            const newProfile = { id: docSnap.id, ...docSnap.data() } as UserProfile;
            if (JSON.stringify(prevProfile) !== JSON.stringify(newProfile)) {
                return newProfile;
            }
            return prevProfile;
        });
      } else {
        // This can happen if the user is deleted from the backend.
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, [user, firestore]);

  // Effect 4: Centralized routing logic
  useEffect(() => {
    // Wait until the loading process is fully complete.
    if (isLoading) return;

    const isAuthPage = pathname === '/login';

    if (profile) {
      // If user has a profile, they should be on an app page.
      if (isAuthPage || pathname === '/') {
        router.replace('/dashboard');
      }
    } else {
      // If there is no profile (not logged in, or error), they should be on the login page.
      if (!isAuthPage) {
        router.replace('/login');
      }
    }
  }, [isLoading, profile, pathname, router]);

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
