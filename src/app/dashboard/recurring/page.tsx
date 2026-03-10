
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurringClient } from "@/components/app/recurring-client";


export default function RecurringItemsPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
      const allowedRoles = ['Procurement Officer', 'Administrator', 'Manager', 'Executive', 'Requester'];
      if (loading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }
      if (role && !allowedRoles.includes(role)) {
        router.push('/dashboard');
      }
    }, [user, role, loading, router]);
    
    const allowedRoles = useMemo(() => ['Procurement Officer', 'Administrator', 'Manager', 'Executive', 'Requester'], []);
    if (loading || !user || !role || !allowedRoles.includes(role)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2 text-primary">
                <History className="h-6 w-6" />
                Monthly Recurring Master List
            </CardTitle>
            <CardDescription>
                Items defined here are automatically added to every period submission. Manage items and their recurrence below.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
            <RecurringClient role={role}/>
        </CardContent>
       </Card>
    </div>
  );
}

    