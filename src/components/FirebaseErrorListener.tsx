'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: Error) => {
      if (error instanceof FirestorePermissionError) {
        // In a real app, you might use a toast or a modal.
        // For debugging in this environment, we throw it so the Next.js overlay can show the rich error.
        throw error;
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null; // This component doesn't render anything.
}
