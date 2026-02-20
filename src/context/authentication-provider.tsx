'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { useAuth as useFirebaseAuthInstance } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuthInstance();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // This listener will be triggered by onAuthStateChanged, which is in turn
    // triggered by the completion of getRedirectResult.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });

    // We process the redirect result here at the top level of the app.
    // If the user is coming back from a Google sign-in, this will complete the flow.
    // The onAuthStateChanged listener above will then receive the user object.
    getRedirectResult(auth).catch((error) => {
      // This is for developer debugging; a user-facing error could be implemented here.
      console.error("Error processing Firebase redirect result:", error);
    });

    return () => unsubscribe();
  }, [auth]);

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
