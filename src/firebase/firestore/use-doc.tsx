'use client';

import { useState, useEffect, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData } from 'firebase/firestore';

// Helper to compare references
function areRefsEqual(r1: DocumentReference | null, r2: DocumentReference | null): boolean {
    if (!r1 || !r2) return r1 === r2;
    return r1.isEqual(r2);
}

export function useDoc<T>(ref: DocumentReference<DocumentData> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const refRef = useRef<DocumentReference | null>(ref);

  if (!areRefsEqual(ref, refRef.current)) {
      refRef.current = ref;
  }

  useEffect(() => {
    const currentRef = refRef.current;
    if (!currentRef) {
      setData(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(currentRef, (snapshot) => {
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
  }, [refRef.current]);

  return { data, loading, error };
}
