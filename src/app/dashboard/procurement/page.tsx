'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

/**
 * Redundant route redirecting to the new unified Enhanced Submission page.
 */
export default function LegacyProcurementRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/procurement/new');
    }, [router]);

    return (
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
            <p className="ml-4 text-muted-foreground font-medium uppercase tracking-widest text-xs">Redirecting to Consolidated Submission...</p>
        </div>
    );
}
