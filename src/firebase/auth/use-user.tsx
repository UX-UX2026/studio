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
        // Wait for the main AuthenticationProvider to finish its work (including profile creation).
        setIsProfileLoading(true);
        return;
    }
      
    if (!authUser || !firestore) {
      // No user, so no profile to load. We are done loading.
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    // Auth is loaded and we have a user. The AuthenticationProvider has already guaranteed
    // that a profile document exists. We can now safely listen for real-time updates to it.
    const userRef = doc(firestore, 'users', authUser.uid);
    
    const unsubscribe = onSnapshot(userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
        } else {
          // This case should no longer happen because the provider handles creation.
          // If it does, it's a critical error state (e.g. document deleted mid-session).
          console.error(`useUser: Profile for ${authUser.uid} unexpectedly not found! Signing out.`);
          setProfile(null);
        }
        // The attempt to load the profile (or confirm its absence) is now complete.
        setIsProfileLoading(false);
      },
      (e) => {
        console.error("useUser: Firestore listener failed.", e);
        setError(e);
        setProfile(null);
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
