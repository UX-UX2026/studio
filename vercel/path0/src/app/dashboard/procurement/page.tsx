'use client';

import ActualPage from '@/app/dashboard/procurement/page';

/**
 * Clean proxy component to resolve Vercel build conflicts.
 * Points to the actual, syntactically correct procurement page.
 */
export default function VercelPathProxy() {
    return <ActualPage />;
}