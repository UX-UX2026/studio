'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth, useFirestore } from '../';
import { doc, onSnapshot } from 'firebase/firestore';

export type UserRole = string | null;
export type UserStatus = 'Active' | 'Invited' | null;

interface UserProfile {
    id: string;
    role: UserRole;
    department: string;
    status: UserStatus;
    displayName?: string;
    email: string;
    photoURL?: string;
}

interface UserState {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  department: string | null;
  status: UserStatus;
  loading: boolean;
  error: Error | null;
}

export function useUser(): UserState {
  const auth = useAuth();
  const firestore = useFirestore();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
          setProfile(null);
          setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [auth]);
  
  // Listen for profile changes
  useEffect(() => {
    if (!authUser || !firestore) {
      if (!auth.currentUser) {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);
    const userRef = doc(firestore, 'users', authUser.uid);
    
    const unsubscribe = onSnapshot(userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
        } else {
          // Profile doesn't exist. Set profile to null.
          // The main app layout will handle creating it.
          setProfile(null);
        }
        setLoading(false);
      },
      (e) => {
        console.error("useUser: Firestore listener failed.", e);
        setError(e);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authUser, firestore, auth]);

  return {
    user: authUser,
    profile,
    role: profile?.role || null,
    department: profile?.department || null,
    status: profile?.status || null,
    loading: loading,
    error: error
  };
}
