'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader } from 'lucide-react';

export default function UserDetailRedirectPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params.userId as string;

    useEffect(() => {
        if (userId) {
            router.replace(`/dashboard/settings/users/${userId}`);
        }
    }, [router, userId]);

    return (
        <div className="flex h-screen items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
            <p className="ml-4">Redirecting...</p>
        </div>
    );
}
