'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, DocumentReference, DocumentData } from 'firebase/firestore';

export function useDoc<T>(ref: DocumentReference<DocumentData> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!ref) {
      setData(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        setData({ id: snapshot.id, ...snapshot.data() } as T);
      } else {
        setData(null);
      }
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("useDoc error:", err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ref]);

  return { data, loading, error };
}
