'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '../provider';

interface UserState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useUser(): UserState {
  const auth = useAuth();
  const [userState, setUserState] = useState<UserState>({
    user: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await user.getIdTokenResult();
        const isAdmin = tokenResult.claims.admin === true || user.email === 'admin@procurportal.com';
        setUserState({
          user,
          isAdmin: isAdmin,
          loading: false,
        });
      } else {
        setUserState({ user: null, isAdmin: false, loading: false });
      }
    });

    return () => unsubscribe();
  }, [auth]);

  return userState;
}
