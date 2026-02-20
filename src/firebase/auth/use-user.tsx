'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth, useFirestore } from '../';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
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
      // Not logged in, or firebase not ready
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
          setLoading(false);
        } else {
          // Profile doesn't exist, so let's create it ("self-healing").
          console.log(`User profile for ${authUser.uid} not found. Creating it.`);
          
          const matchingTestUser = testUsers.find(testUser => testUser.email.toLowerCase() === authUser.email?.toLowerCase());

          const profileData: any = matchingTestUser
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
          
          setDoc(userRef, profileData)
            .then(() => {
                // The onSnapshot listener will automatically receive the new data,
                // so we don't need to setLoading(false) here. It will happen on the next snapshot.
                console.log(`Successfully triggered profile creation for ${authUser.uid}.`);
            })
            .catch((e) => {
                console.error("useUser: Failed to create user profile.", e);
                setError(e);
                setLoading(false);
            });
        }
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
