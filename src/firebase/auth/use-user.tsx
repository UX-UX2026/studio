'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '../provider';

export type UserRole = string | null;

interface UserState {
  user: User | null;
  role: UserRole;
  loading: boolean;
}

export function useUser(): UserState {
  const auth = useAuth();
  const [userState, setUserState] = useState<UserState>({
    user: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await user.getIdTokenResult();
        let role: UserRole = (tokenResult.claims.role as UserRole) || null;
        
        // Fallback for default users to have a role
        if (!role) {
            if (user.email === 'admin@procurportal.com' || user.email === 'heinrich@ubuntux.co.za') {
                role = 'Administrator';
            } else if (user.email === 'man@procurportal.com') {
                role = 'Manager';
            }
        }

        setUserState({
          user,
          role,
          loading: false,
        });
      } else {
        setUserState({ user: null, role: null, loading: false });
      }
    });

    return () => unsubscribe();
  }, [auth]);

  return userState;
}
