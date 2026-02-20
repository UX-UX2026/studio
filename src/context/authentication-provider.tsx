'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { testUsers } from '@/lib/test-data';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuthInstance();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
        if (authUser) {
            // We have a user. Now ensure their profile exists.
            if (firestore) {
                const userRef = doc(firestore, 'users', authUser.uid);
                try {
                    const docSnap = await getDoc(userRef);
                    if (!docSnap.exists()) {
                        // Profile doesn't exist, create it.
                        console.log(`Auth Provider: No profile for ${authUser.uid}. Creating now...`);
                        const matchingTestUser = testUsers.find(testUser => testUser.email?.toLowerCase() === authUser.email?.toLowerCase());
                        const profileData = {
                            displayName: authUser.displayName || authUser.email?.split('@')[0],
                            email: authUser.email,
                            photoURL: authUser.photoURL || `https://i.pravatar.cc/150?u=${authUser.email}`,
                            role: matchingTestUser ? matchingTestUser.role : 'Requester',
                            department: matchingTestUser ? matchingTestUser.department : 'Unassigned',
                            status: 'Active' as const,
                        };
                        await setDoc(userRef, profileData);
                        console.log("Auth Provider: Profile created.");
                    }
                    // Profile is guaranteed to exist now.
                    setUser(authUser);
                } catch (e) {
                    console.error("Auth Provider: Error during profile check/creation.", e);
                    await auth.signOut(); // Log out user on error
                    setUser(null);
                }
            }
        } else {
            // No authenticated user.
            setUser(null);
        }
        // In all cases, once this async function completes, the initial loading is done.
        setIsLoading(false);
    });

    // Handle the redirect result from Google sign-in. This will trigger the onAuthStateChanged listener above.
    getRedirectResult(auth).catch(error => {
        console.error("Error from getRedirectResult:", error);
        // This can happen if the user closes the popup or if there's a configuration issue.
        // The onAuthStateChanged listener will correctly handle the lack of a user.
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  useEffect(() => {
    if (isLoading) return; // Wait until the initial auth state is confirmed

    const isAuthPage = pathname === '/login';

    if (user && isAuthPage) {
      // User is logged in but on the login page, redirect them.
      router.replace('/dashboard');
    } else if (!user && !isAuthPage && pathname !== '/') {
      // User is not logged in and is trying to access a protected page.
      // Redirect them to login. We also check for the root path which is handled by page.tsx.
      router.replace('/login');
    }
  }, [isLoading, user, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
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
