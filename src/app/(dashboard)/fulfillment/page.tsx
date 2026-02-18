'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FulfillmentClient } from "@/components/app/fulfillment-client";
import { fulfillmentItems } from "@/lib/mock-data";


export default function FulfillmentPage() {
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
    <Card>
      <CardHeader>
        <CardTitle>Procurement Fulfillment</CardTitle>
        <p className="text-sm text-muted-foreground">
            Track and manage all outstanding procurement items from approval to completion.
        </p>
      </CardHeader>
      <CardContent>
        <FulfillmentClient items={fulfillmentItems} />
      </CardContent>
    </Card>
  );
}
