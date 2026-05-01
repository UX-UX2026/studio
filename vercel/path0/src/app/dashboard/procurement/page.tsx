'use client';

import ActualPage from '@/app/dashboard/procurement/page';

/**
 * Cleanup component: This file exists in some deployment environments and was 
 * incorrectly set as a dummy redirect. We now proxy it to the actual procurement page 
 * to ensure that users navigating here see the correct application state.
 */
export default function VercelPathProxy() {
    return <ActualPage />;
}
