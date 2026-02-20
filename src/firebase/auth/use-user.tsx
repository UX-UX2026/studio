'use client';

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth, useFirestore } from '../';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  const auth = useAuth();
  const firestore = useFirestore();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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

  const manageUserProfile = useCallback(async () => {
    if (!authUser || !firestore) {
        if (!auth.currentUser) {
            setLoading(false);
        }
        return;
    };

    setLoading(true);
    setError(null);
    const userRef = doc(firestore, 'users', authUser.uid);

    try {
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            setProfile({ id: userSnap.id, ...userSnap.data() } as UserProfile);
        } else {
            // Self-healing: Profile doesn't exist, so let's create it.
            console.log(`User profile for ${authUser.uid} not found. Creating it.`);
            
            const matchingTestUser = testUsers.find(testUser => testUser.email.toLowerCase() === authUser.email?.toLowerCase());

            const profileData = matchingTestUser
                ? { ...matchingTestUser, photoURL: authUser.photoURL || `https://i.pravatar.cc/150?u=${authUser.email}` }
                : {
                    displayName: authUser.displayName || authUser.email?.split('@')[0],
                    email: authUser.email,
                    photoURL: authUser.photoURL || `https://i.pravatar.cc/150?u=${authUser.email}`,
                    role: 'Requester',
                    department: 'Unassigned',
                    status: 'Active' as const,
                };
            
            if (authUser.email) {
                profileData.email = authUser.email;
            }

            await setDoc(userRef, profileData);
            setProfile({ id: authUser.uid, ...profileData } as UserProfile);
            console.log(`Successfully created profile from useUser hook for ${authUser.uid}.`);
        }
    } catch (e: any) {
        console.error("useUser: Failed to get or create user profile.", e);
        setError(e);
    } finally {
        setLoading(false);
    }
  }, [authUser, firestore, auth]);

  useEffect(() => {
      manageUserProfile();
  }, [manageUserProfile]);


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
