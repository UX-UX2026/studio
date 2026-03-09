'use client';

import { useAuthentication as useAuthContext } from '@/context/authentication-provider';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

// The main hook that provides everything
export { useAuthentication } from '@/context/authentication-provider';

// Compatibility hooks that other components rely on
export { useUser, type UserRole, type UserStatus } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';


export const useFirebaseApp = (): FirebaseApp => {
    const { app } = useAuthContext();
    if (!app) {
        throw new Error('useFirebaseApp must be used within an AuthenticationProvider with initialized Firebase');
    }
    return app;
}

export const useAuth = (): Auth => {
    const { auth } = useAuthContext();
    if (!auth) {
        throw new Error('useAuth must be used within an AuthenticationProvider with initialized Firebase');
    }
    return auth;
}

export const useFirestore = (): Firestore => {
    const { firestore } = useAuthContext();
    if (!firestore) {
        throw new Error('useFirestore must be used within an AuthenticationProvider with initialized Firebase');
    }
    return firestore;
}
