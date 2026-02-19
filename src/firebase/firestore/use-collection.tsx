'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, Query, DocumentData } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useCollection<T>(query: Query<DocumentData> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      setData(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(query, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
      setData(docs);
      setLoading(false);
    }, (err) => {
      // This path is just a placeholder. A robust implementation would need to parse this from the query.
      const path = (query as any)._query?.path?.segments?.join('/') || 'unknown collection';
      const permissionError = new FirestorePermissionError({
        path: path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
