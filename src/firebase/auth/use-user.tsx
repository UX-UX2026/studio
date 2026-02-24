'use client';

import { useAuthentication } from '@/context/authentication-provider';

export type UserRole = string | null;
export type UserStatus = 'Active' | 'Invited' | null;

/**
 * This hook is a compatibility shim.
 * It consumes the new robust `useAuthentication` hook and provides the data
 * in the same shape as the old `useUser` hook, ensuring that no other
 * components needed to be refactored. The core logic now resides in
 * `AuthenticationProvider`.
 */
export function useUser() {
    const { user, profile, role, department, isLoading } = useAuthentication();
    
    return {
        user,
        profile,
        role,
        department,
        status: profile?.status || null,
        loading: isLoading,
        // Error handling is now internal to the provider, so we can remove it from here.
        // The provider will show toasts for any critical errors.
    };
}
