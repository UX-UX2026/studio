'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, Query, DocumentData } from 'firebase/firestore';

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
      setError(null);
    }, (err) => {
      console.error("useCollection error:", err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
