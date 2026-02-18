'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader, Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { recurringItems } from "@/lib/mock-data";
import { RecurringClient } from "@/components/app/recurring-client";


export default function RecurringPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
      if (!loading && (!user || (role !== 'Procurement Officer' && role !== 'Administrator'))) {
        router.push('/');
      }
    }, [user, role, loading, router]);
    
    if (loading || !user || (role !== 'Procurement Officer' && role !== 'Administrator')) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-primary">
                <History className="h-6 w-6" />
                Monthly Recurring Master List
            </CardTitle>
            <CardDescription>
                Items defined here are automatically added to every period submission. Manage items and their recurrence below.
            </CardDescription>
          </div>
          <Button className="shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4 mr-2"/>
            New Recurring Item
          </Button>
        </CardHeader>
        <CardContent>
            <RecurringClient items={recurringItems} />
        </CardContent>
       </Card>
    </div>
  );
}
