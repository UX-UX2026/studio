'use client';

import { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth, useDoc, useFirestore } from '../';
import { doc } from 'firebase/firestore';

export type UserRole = string | null;
export type UserStatus = 'Active' | 'Invited' | null;

interface UserState {
  user: User | null;
  role: UserRole;
  department: string | null;
  status: UserStatus;
  loading: boolean;
}

interface UserProfile {
    id: string;
    role: UserRole;
    department: string;
    status: UserStatus;
}

export function useUser(): UserState {
  const auth = useAuth();
  const firestore = useFirestore();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const userProfileRef = useMemo(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);

  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const loading = authLoading || profileLoading;

  if (loading) {
    return { user: null, role: null, department: null, status: null, loading: true };
  }

  if (!authUser) {
     return { user: null, role: null, department: null, status: null, loading: false };
  }

  return {
    user: authUser,
    role: userProfile?.role || null,
    department: userProfile?.department || null,
    status: userProfile?.status || null,
    loading: false,
  };
}
