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
  const [isLoading, setIsLoading] = useState(true); // Start as true
  const router = useRouter();
  const pathname = usePathname();

  // Effect 1: Handle Auth State and Profile Fetching
  useEffect(() => {
    if (!firestore) return;

    const handleUserProfile = async (authUser: User) => {
      const userRef = doc(firestore, 'users', authUser.uid);
      try {
        const docSnap = await getDoc(userRef);
        let profileData: UserProfile;

        if (docSnap.exists()) {
          profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
          
          const specialAdmin = testUsers.find(u => u.email.toLowerCase() === profileData.email.toLowerCase() && u.role === 'Administrator');
          if (specialAdmin && profileData.role !== 'Administrator') {
            await setDoc(userRef, { role: 'Administrator', department: 'Executive' }, { merge: true });
            profileData.role = 'Administrator';
            profileData.department = 'Executive';
          }
        } else {
          const metadataRef = doc(firestore, 'app', 'metadata');
          const metadataSnap = await getDoc(metadataRef);
          const needsAdminSetup = !metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp;
          
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
            photoURL: authUser.photoURL || `https://i.pravatar.cc/150?u=${'\'\'\''}authUser.email{'\'\'\''}`,
            role: assignedRole,
            department: assignedRole === 'Administrator' ? 'Executive' : 'Unassigned',
            status: 'Active' as const,
          };
          
          await setDoc(userRef, newProfile);
          profileData = { id: authUser.uid, ...newProfile };
        }
        setProfile(profileData);
      } catch (error) {
        console.error("Auth Provider: Error during profile setup.", error);
        await firebaseAuth.signOut(); // Sign out on profile error
        setProfile(null);
      } finally {
        setIsLoading(false); // End loading ONLY after profile is processed
      }
    };

    const unsubscribe = onAuthStateChanged(firebaseAuth, (authUser) => {
      setUser(authUser);
      if (authUser) {
        // User is signed in, fetch their profile.
        // isLoading remains true until handleUserProfile sets it to false.
        handleUserProfile(authUser);
      } else {
        // No user is signed in. Auth process is complete.
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseAuth, firestore]);

  // Effect 2: Listen for real-time profile updates
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

    if (profile) {
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
