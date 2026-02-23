'use client';

import { useState, useEffect, useRef } from 'react';
import { onSnapshot, Query, DocumentData } from 'firebase/firestore';

// Helper to compare queries
function areQueriesEqual(q1: Query | null, q2: Query | null): boolean {
  if (!q1 || !q2) return q1 === q2;
  return q1.isEqual(q2);
}

export function useCollection<T>(query: Query<DocumentData> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Use a ref to store the query to avoid re-subscribing on every render
  const queryRef = useRef<Query | null>(query);

  // Update the ref only if the query has actually changed
  if (!areQueriesEqual(query, queryRef.current)) {
    queryRef.current = query;
  }

  useEffect(() => {
    const currentQuery = queryRef.current;
    if (!currentQuery) {
      setData(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(currentQuery, (snapshot) => {
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
  }, [queryRef.current]); // Depend on the stable ref value

  return { data, loading, error };
}
