'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
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
    if (!firebaseAuth || !firestore) {
      setIsLoading(false);
      return;
    }

    let unsubscribeProfile: (() => void) | undefined;

    const authStateObserver = onAuthStateChanged(firebaseAuth, (authUser) => {
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }
      
      if (!authUser) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      const userRef = doc(firestore, 'users', authUser.uid);

      // Replace initial getDoc with a reactive onSnapshot listener to avoid race conditions.
      unsubscribeProfile = onSnapshot(userRef, async (profileSnap) => {
        if (profileSnap.exists()) {
          // Profile exists. Set user data and finish loading.
          setUser(authUser);
          setProfile({ id: profileSnap.id, ...profileSnap.data() } as UserProfile);
          setIsLoading(false);
        } else {
          // Profile does not exist. This is the first-time sign-in path.
          // The listener has confirmed the document is missing, so we can now safely perform write operations.
          try {
            // Check for a pre-existing invitation for this user's email.
            const invitesQuery = query(collection(firestore, 'users'), where('email', '==', authUser.email), where('status', '==', 'Invited'));
            const invitesSnapshot = await getDocs(invitesQuery);
            
            if (!invitesSnapshot.empty) {
              // An invitation was found. Use its data to create the new user profile.
              const inviteDoc = invitesSnapshot.docs[0];
              const invitedProfileData = inviteDoc.data();
              
              const newProfileData = {
                ...invitedProfileData,
                displayName: authUser.displayName || invitedProfileData.displayName,
                email: authUser.email!,
                photoURL: authUser.photoURL || invitedProfileData.photoURL,
                status: 'Active' as const,
              };
              
              // Use a batch write to atomically create the new profile and delete the invitation.
              const batch = writeBatch(firestore);
              batch.set(userRef, newProfileData);
              batch.delete(inviteDoc.ref);
              await batch.commit();
              // After the batch commits, the onSnapshot listener will automatically be triggered again with the new profile data.
            } else {
              // No invitation found. This is a brand new user signing up.
              const metadataRef = doc(firestore, 'app', 'metadata');
              const metadataSnap = await getDoc(metadataRef);
              
              let userRole = 'Requester'; // Default role for new users.
              // Special case: Ensure a specific email is always admin, or set the first user as admin.
              if (authUser.email === 'heinrich@ubuntux.co.za' || !metadataSnap.exists() || !metadataSnap.data()?.adminIsSetUp) {
                userRole = 'Administrator';
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
               // After this setDoc, the onSnapshot listener will be triggered again with the new profile.
            }
          } catch (error) {
            console.error("Fatal: Could not create user profile.", error);
            toast({ variant: "destructive", title: "Profile Creation Failed", description: (error as Error).message || "A critical error occurred." });
            if(firebaseAuth) firebaseAuth.signOut();
            setIsLoading(false); // Stop loading on error
          }
        }
      }, (error) => {
        // This is the error callback for the onSnapshot listener itself.
        console.error("Fatal: Firestore listener for profile failed.", error);
        toast({ variant: "destructive", title: "Profile Error", description: "Could not load your profile." });
        if(firebaseAuth) firebaseAuth.signOut();
        setIsLoading(false);
      });
    });

    return () => {
      authStateObserver();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [firebaseAuth, firestore, toast, router]);


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
