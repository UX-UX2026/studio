'use client';

// All initialization logic is now handled in src/firebase/client.ts and provided via FirebaseClientProvider.

export { FirebaseProvider, useFirebaseApp, useAuth, useFirestore } from './provider';
export { useUser, type UserRole, type UserStatus } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
