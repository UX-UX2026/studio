'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, Unsubscribe, getDoc } from 'firebase/firestore';

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

  useEffect(() => {
    let profileUnsubscribe: Unsubscribe | null = null;

    const authUnsubscribe = onAuthStateChanged(firebaseAuth, (authUser) => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }

      if (authUser) {
        setUser(authUser);
        if (firestore) {
          const userRef = doc(firestore, 'users', authUser.uid);
          profileUnsubscribe = onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
              setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
              setIsLoading(false);
            } else {
              // This is a new user, create their profile.
              console.log(`Auth Provider: No profile for ${authUser.uid}. Creating...`);
              try {
                const metadataRef = doc(firestore, 'app', 'metadata');
                const metadataSnap = await getDoc(metadataRef);
                
                let assignedRole = 'Requester'; // Default role
                let isFirstAdmin = false;

                if (!metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp) {
                  // This is the first user, make them an admin.
                  assignedRole = 'Administrator';
                  isFirstAdmin = true;
                  console.log('Auth Provider: First user detected. Assigning Administrator role.');
                }

                const profileData = {
                  displayName: authUser.displayName || authUser.email?.split('@')[0] || 'New User',
                  email: authUser.email,
                  photoURL: authUser.photoURL || `https://i.pravatar.cc/150?u=${authUser.email}`,
                  role: assignedRole,
                  department: assignedRole === 'Administrator' ? 'Executive' : 'Unassigned',
                  status: 'Active' as const,
                };
                
                await setDoc(userRef, profileData);

                if (isFirstAdmin) {
                  // After successfully creating the admin user, set the flag.
                  await setDoc(metadataRef, { adminIsSetUp: true });
                  console.log('Auth Provider: adminIsSetUp flag has been set.');
                }
                // The onSnapshot listener will automatically fire again with the new data,
                // so we don't need to call setProfile here.
              } catch (e) {
                console.error("Auth Provider: Failed to create user profile.", e);
                await firebaseAuth.signOut();
              }
            }
          }, (error) => {
            console.error("Auth Provider: Profile listener error.", error);
            setIsLoading(false);
            setProfile(null);
          });
        }
      } else {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, [firebaseAuth, firestore]);

  useEffect(() => {
    if (isLoading) return;

    const isAuthPage = pathname === '/login';

    if (profile && isAuthPage) {
      router.replace('/dashboard');
    } else if (!profile && !isAuthPage && pathname !== '/') {
      router.replace('/login');
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
