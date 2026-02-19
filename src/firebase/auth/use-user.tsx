'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '../provider';
import { mockUsers } from '@/lib/users-mock-data';

export type UserRole = string | null;

interface UserState {
  user: User | null;
  role: UserRole;
  department: string | null;
  loading: boolean;
}

export function useUser(): UserState {
  const auth = useAuth();
  const [userState, setUserState] = useState<UserState>({
    user: null,
    role: null,
    department: null,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await user.getIdTokenResult();
        let role: UserRole = (tokenResult.claims.role as UserRole) || null;
        let department: string | null = null;
        
        // Fallback for default users to have a role
        if (!role) {
            if (user.email === 'admin@procurportal.com' || user.email === 'heinrich@ubuntux.co.za') {
                role = 'Administrator';
            } else if (user.email === 'man@procurportal.com') {
                role = 'Manager';
            } else if (user.email === 'sam@procurportal.com') {
                role = 'Requester';
            }
        }
        
        // Get department from mock data
        if (user.email) {
            const mockUser = mockUsers.find(u => u.email === user.email);
            if (mockUser) {
                department = mockUser.department;
            }
        }


        setUserState({
          user,
          role,
          department,
          loading: false,
        });
      } else {
        setUserState({ user: null, role: null, department: null, loading: false });
      }
    });

    return () => unsubscribe();
  }, [auth]);

  return userState;
}
