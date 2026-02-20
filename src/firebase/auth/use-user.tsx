'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useFirestore } from '../';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuthentication } from '@/context/authentication-provider';

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
  const { user: authUser, isLoading: isAuthLoading } = useAuthentication();
  const firestore = useFirestore();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (isAuthLoading) {
      setIsProfileLoading(true);
      return;
    }
      
    if (!authUser || !firestore) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    const userRef = doc(firestore, 'users', authUser.uid);
    
    const unsubscribe = onSnapshot(userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
        } else {
          // If the profile doesn't exist, it means it hasn't been created yet.
          // The login flow is now responsible for creating it.
          // We set profile to null and stop loading.
          setProfile(null);
          console.warn(`useUser: No profile document found for user ${authUser.uid}. It should be created on login.`);
        }
        setIsProfileLoading(false);
      },
      (e) => {
        console.error("useUser: Firestore listener failed.", e);
        setError(e);
        setIsProfileLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authUser, isAuthLoading, firestore]);

  return {
    user: authUser,
    profile,
    role: profile?.role || null,
    department: profile?.department || null,
    status: profile?.status || null,
    loading: isAuthLoading || isProfileLoading,
    error: error
  };
}
