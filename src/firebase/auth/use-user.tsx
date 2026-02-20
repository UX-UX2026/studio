'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useFirestore } from '../';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuthentication } from '@/context/authentication-provider';
import { testUsers } from '@/lib/test-data';

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
    if (isAuthLoading || !firestore) {
      setIsProfileLoading(true);
      return;
    }
      
    if (!authUser) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    const userRef = doc(firestore, 'users', authUser.uid);
    
    const unsubscribe = onSnapshot(userRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
          setIsProfileLoading(false);
        } else {
          // Self-healing: Profile doesn't exist, so create it.
          console.log(`useUser: No profile for ${authUser.uid}. Creating now...`);
          try {
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
            // After creation, the onSnapshot listener will automatically fire again with the new data.
            // This will trigger the `docSnap.exists()` block above, setting the profile and completing the loading state.
            console.log("useUser: Profile created. Listener will refetch.");
          } catch (e) {
            console.error("useUser: Failed to create user profile.", e);
            setError(e as Error);
            setProfile(null);
            setIsProfileLoading(false);
          }
        }
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
