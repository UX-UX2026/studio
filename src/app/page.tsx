'use client';

import { Loader } from 'lucide-react';

// The AuthenticationProvider now handles all routing logic.
// This page just shows a loader until the provider redirects.
export default function RootPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader className="h-8 w-8 animate-spin" />
    </div>
  );
}
