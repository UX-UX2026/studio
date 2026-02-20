'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This layout forces a redirect to the correct /dashboard route, effectively disabling this invalid route group.
export default function RedirectLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return null; // Render nothing
}
