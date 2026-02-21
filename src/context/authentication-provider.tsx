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

  // Effect for handling auth state changes and initial profile load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        if (firestore) {
          const userRef = doc(firestore, 'users', authUser.uid);
          try {
            const docSnap = await getDoc(userRef);
            let profileData: UserProfile;

            if (docSnap.exists()) {
              profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
              
              const specialAdmin = testUsers.find(u => u.email.toLowerCase() === profileData.email.toLowerCase() && u.role === 'Administrator');
              if (specialAdmin && profileData.role !== 'Administrator') {
                console.log(`Auth Provider: Correcting role for special admin ${'\'\'\''}profileData.email{'\'\'\'}.`);
                await setDoc(userRef, { role: 'Administrator', department: 'Executive' }, { merge: true });
                profileData.role = 'Administrator';
                profileData.department = 'Executive';
              }

            } else {
              console.log(`Auth Provider: No profile for ${'\'\'\''}authUser.uid{'\'\'\''}. Creating...`);
              const metadataRef = doc(firestore, 'app', 'metadata');
              const metadataSnap = await getDoc(metadataRef);
              const needsAdminSetup = !metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp;
              
              const specialAdmin = testUsers.find(u => u.email.toLowerCase() === authUser.email!.toLowerCase() && u.role === 'Administrator');

              let assignedRole = 'Requester';
              if (specialAdmin || needsAdminSetup) {
                assignedRole = 'Administrator';
                if (needsAdminSetup) {
                    console.log('Auth Provider: First user detected. Assigning Administrator role.');
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
            await firebaseAuth.signOut();
            setProfile(null);
          } finally {
            setIsLoading(false);
          }
        } else {
          // Firestore not available
          setIsLoading(false);
        }
      } else {
        // No user logged in
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [firebaseAuth, firestore]);

  // Effect for real-time profile updates
  useEffect(() => {
    if (!user || !firestore) return;
    
    const userRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile((prevProfile) => {
            const newProfile = { id: docSnap.id, ...docSnap.data() } as UserProfile;
            // Prevent unnecessary re-renders if profile hasn't changed
            if (JSON.stringify(prevProfile) !== JSON.stringify(newProfile)) {
                return newProfile;
            }
            return prevProfile;
        });
      }
    });

    return () => unsubscribe();
  }, [user, firestore]);

  // Centralized effect for routing
  useEffect(() => {
    if (isLoading) return;

    const isAuthPage = pathname === '/login';

    if (profile) {
      // If user has a profile and is on the login page or root, redirect to the dashboard.
      if (isAuthPage || pathname === '/') {
        router.replace('/dashboard');
      }
    } else {
      // If user has no profile and is not on the login page, redirect them there.
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
