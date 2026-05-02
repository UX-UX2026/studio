'use client';

import ActualPage from '@/app/dashboard/procurement/page';

/**
 * Proxy component to resolve duplicate path conflicts on Vercel build environment.
 * Ensures that the correctly structured component from the main source tree is used.
 */
export default function VercelPathProxy() {
    return <ActualPage />;
}