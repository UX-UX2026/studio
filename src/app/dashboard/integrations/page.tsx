'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

export default function IntegrationsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/settings/integrations');
    }, [router]);

    return (
        <div className="flex h-screen items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
            <p className="ml-4">Redirecting to Settings...</p>
        </div>
    );
}
