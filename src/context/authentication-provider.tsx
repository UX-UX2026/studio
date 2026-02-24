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
      (docSnap) => {
        try {
          if (docSnap.exists()) {
            const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;

            if (profileData.email === 'heinrich@ubuntux.co.za' && profileData.role !== 'Administrator') {
              // This is a non-blocking write. The onSnapshot listener will handle the update.
              setDoc(userRef, { role: 'Administrator', department: 'Executive' }, { merge: true })
                .catch(e => console.error("Failed to self-correct admin role:", e));
              return; 
            }

            setProfile(profileData);
            setIsLoading(false);
          } else {
            // --- Profile does NOT exist, create it ---
            getDoc(doc(firestore, 'app', 'metadata')).then(metadataSnap => {
                const isAdminEmail = user.email === 'heinrich@ubuntux.co.za';
                let isFirstUserAdmin = false;
                
                if (!isAdminEmail && (!metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp)) {
                    isFirstUserAdmin = true;
                    setDoc(doc(firestore, 'app', 'metadata'), { adminIsSetUp: true }, { merge: true })
                      .catch(e => console.error("Failed to set adminIsSetUp flag:", e));
                }

                const isNewUserAdmin = isAdminEmail || isFirstUserAdmin;

                const newProfile: Omit<UserProfile, 'id'> = {
                  displayName: user.displayName || user.email?.split('@')[0] || 'New User',
                  email: user.email!,
                  photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.email}`,
                  role: isNewUserAdmin ? 'Administrator' : 'Requester',
                  department: isNewUserAdmin ? 'Executive' : 'Unassigned',
                  status: 'Active' as const,
                };
                
                // This is a non-blocking write. The onSnapshot listener will pick up the new profile.
                setDoc(userRef, newProfile).catch(e => {
                  console.error("Auth Provider: A fatal error occurred during profile creation.", e);
                  toast({ variant: "destructive", title: "Profile Creation Failed", description: `Could not create your profile: ${e.message}` });
                  if (firebaseAuth) firebaseAuth.signOut();
                });
            }).catch(e => {
                 console.warn("Could not check app metadata, possibly due to offline state. Proceeding without first-user admin check.", e);
                 // Failsafe for offline mode on first login
                 const newProfile: Omit<UserProfile, 'id'> = {
                    displayName: user.displayName || user.email?.split('@')[0] || 'New User',
                    email: user.email!,
                    photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.email}`,
                    role: 'Requester',
                    department: 'Unassigned',
                    status: 'Active' as const,
                 };
                 setDoc(userRef, newProfile).catch(err => {
                    console.error("Auth Provider: A fatal error occurred during offline profile creation.", err);
                 });
            });
          }
        } catch (e: any) {
          console.error("Auth Provider: A fatal error occurred during profile setup.", e);
          toast({ variant: "destructive", title: "Profile Error", description: `There was a critical problem setting up your profile: ${e.message}` });
          if (firebaseAuth) firebaseAuth.signOut();
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("Auth Provider: Firestore listener failed with a fatal error.", error);
        toast({
            variant: "destructive",
            title: "Profile Access Error",
            description: `Could not load your profile: ${error.message}. Please contact support.`
        });
        if (firebaseAuth) {
            firebaseAuth.signOut();
        }
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
