'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

// Clean redirect component to prevent corrupted routes from picking up syntax errors
export default function BrokenPathRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/procurement');
    }, [router]);
    
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
            <p className="ml-4">Redirecting...</p>
        </div>
    );
}