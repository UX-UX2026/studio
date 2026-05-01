'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BrokenPathRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/procurement');
    }, [router]);
    return null;
}