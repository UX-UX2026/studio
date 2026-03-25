'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const handleError = (error: FirestorePermissionError) => {
            // Throwing the error here will cause it to be caught by Next.js's
            // development error overlay, displaying the rich error message.
            throw error;
        };

        errorEmitter.on('permission-error', handleError);

        // This is a global listener. We don't remove it on component unmount
        // because it should persist for the application's entire lifecycle.
    }, []);

    return <>{children}</>;
}
