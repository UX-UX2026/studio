'use client';

import ActualPage from '@/app/dashboard/procurement/page';

/**
 * Proxy component to ensure Vercel uses the valid application file.
 */
export default function VercelPathProxy() {
    return <ActualPage />;
}
