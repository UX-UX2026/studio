'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
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

    const authStateObserver = onAuthStateChanged(firebaseAuth, async (authUser) => {
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
      let docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
        // Profile does not exist, so we must create it.
        try {
          // Check for an invitation first.
          const invitesQuery = query(collection(firestore, 'users'), where('email', '==', authUser.email), where('status', '==', 'Invited'));
          const invitesSnapshot = await getDocs(invitesQuery);
          
          if (!invitesSnapshot.empty) {
            // An invitation exists. Use it to create the profile.
            const inviteDoc = invitesSnapshot.docs[0];
            const invitedProfileData = inviteDoc.data();
            
            const newProfileData = {
              ...invitedProfileData,
              displayName: authUser.displayName || invitedProfileData.displayName,
              email: authUser.email!,
              photoURL: authUser.photoURL || invitedProfileData.photoURL,
              status: 'Active' as const,
            };
            
            await setDoc(userRef, newProfileData);
            await deleteDoc(inviteDoc.ref);
          } else {
            // No invitation. This is a first-time sign-up.
            const metadataRef = doc(firestore, 'app', 'metadata');
            const metadataSnap = await getDoc(metadataRef);
            
            let userRole = 'Requester'; // Default role
            // Ensure heinrich@ubuntux.co.za is always an admin on first sign-up
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
          }
          // After creation, re-fetch the document to ensure we have the latest state
          docSnap = await getDoc(userRef);
        } catch (error) {
          console.error("Fatal: Could not create user profile.", error);
          toast({ variant: "destructive", title: "Profile Creation Failed", description: (error as Error).message || "A critical error occurred." });
          if(firebaseAuth) firebaseAuth.signOut();
          setIsLoading(false);
          return;
        }
      }

      // At this point, the document is guaranteed to exist.
      // Set up the real-time listener.
      unsubscribeProfile = onSnapshot(userRef, (profileSnap) => {
        if (profileSnap.exists()) {
          setUser(authUser);
          setProfile({ id: profileSnap.id, ...profileSnap.data() } as UserProfile);
        } else {
          // This case should not happen if creation logic is correct, but as a safeguard:
          setUser(null);
          setProfile(null);
          if(firebaseAuth) firebaseAuth.signOut(); // Log out user as their profile is gone
        }
        setIsLoading(false);
      }, (error) => {
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
