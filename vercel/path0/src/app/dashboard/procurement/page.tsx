'use client';

import ActualPage from '@/app/dashboard/procurement/page';

/**
 * Proxy component to resolve duplicate path conflicts on Vercel.
 */
export default function VercelPathProxy() {
    return <ActualPage />;
}