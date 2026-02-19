'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FulfillmentClient } from "@/components/app/fulfillment-client";
import { fulfillmentItems as allFulfillmentItems } from "@/lib/mock-data";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

type FulfillmentItem = (typeof allFulfillmentItems)[0];

export default function FulfillmentPage() {
    const { user, role, department, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
      const allowedRoles = ['Procurement Officer', 'Administrator', 'Manager', 'Executive'];
      if (!loading && (!user || !role || !allowedRoles.includes(role))) {
        router.push('/');
      }
    }, [user, role, loading, router]);
    
    const fulfillmentItemsByDept = useMemo(() => {
        return allFulfillmentItems.reduce((acc, item) => {
            if (!acc[item.department]) {
                acc[item.department] = [];
            }
            acc[item.department].push(item);
            return acc;
        }, {} as Record<string, FulfillmentItem[]>);
    }, []);

    const departmentOrder = useMemo(() => Object.keys(fulfillmentItemsByDept).sort(), [fulfillmentItemsByDept]);
    
    const itemsForUser = useMemo(() => {
        if (role === 'Manager' && department) {
            return allFulfillmentItems.filter(item => item.department === department);
        }
        // Admins, Executives, and Procurement Officers see all items
        return allFulfillmentItems;
    }, [role, department]);

    if (loading || !user || !role || !['Procurement Officer', 'Administrator', 'Manager', 'Executive'].includes(role)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const showDepartmentBreakdown = role === 'Executive' || role === 'Administrator';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Procurement Fulfillment</CardTitle>
        <p className="text-sm text-muted-foreground">
            {showDepartmentBreakdown 
                ? "Track and manage all outstanding procurement items, grouped by department."
                : "Track and manage your department's outstanding procurement items from approval to completion."
            }
        </p>
      </CardHeader>
      <CardContent>
        {showDepartmentBreakdown ? (
            <Accordion type="multiple" className="w-full space-y-2" defaultValue={departmentOrder}>
                {departmentOrder.map(dept => (
                    <AccordionItem value={dept} key={dept} className="border-0 rounded-lg bg-muted/50">
                            <AccordionTrigger className="px-3 py-2 hover:no-underline rounded-lg data-[state=open]:bg-muted">
                            <div className="flex justify-between items-center w-full">
                                <span className="font-semibold">{dept}</span>
                                <Badge variant="secondary" className="mr-4">{fulfillmentItemsByDept[dept].length}</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-2 pt-0">
                            <FulfillmentClient items={fulfillmentItemsByDept[dept]} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        ) : (
            <FulfillmentClient items={itemsForUser} />
        )}
      </CardContent>
    </Card>
  );
}
