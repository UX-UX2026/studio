'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
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
import { Progress } from "@/components/ui/progress";

export type FulfillmentItem = (typeof allFulfillmentItems)[0];

export default function FulfillmentPage() {
    const { user, role, department, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
      const allowedRoles = ['Procurement Officer', 'Administrator', 'Manager', 'Executive', 'Procurement Assistant'];
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

    const fulfillmentStatsByDept = useMemo(() => {
        const stats: Record<string, { total: number, completed: number, percentage: number }> = {};
        for (const dept in fulfillmentItemsByDept) {
            const items = fulfillmentItemsByDept[dept];
            const total = items.length;
            const completed = items.filter(item => item.status === 'Completed').length;
            stats[dept] = {
                total,
                completed,
                percentage: total > 0 ? (completed / total) * 100 : 0
            };
        }
        return stats;
    }, [fulfillmentItemsByDept]);

    const departmentOrder = useMemo(() => Object.keys(fulfillmentItemsByDept).sort(), [fulfillmentItemsByDept]);
    
    const departmentsForUser = useMemo(() => {
        if (role === 'Manager' && department) {
            return departmentOrder.filter(d => d === department);
        }
        return departmentOrder;
    }, [role, department, departmentOrder]);

    if (loading || !user || !role || !['Procurement Officer', 'Administrator', 'Manager', 'Executive', 'Procurement Assistant'].includes(role)) {
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
            Track and manage outstanding procurement items, grouped by department. View completion progress for each.
        </p>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full space-y-2" defaultValue={departmentsForUser}>
            {departmentsForUser.map(dept => (
                <AccordionItem value={dept} key={dept} className="border-0 rounded-lg bg-muted/50">
                    <AccordionTrigger className="px-3 py-2 hover:no-underline rounded-lg data-[state=open]:bg-muted">
                        <div className="flex justify-between items-center w-full">
                            <span className="font-semibold">{dept}</span>
                            <div className="flex items-center gap-4 mr-4">
                                {fulfillmentStatsByDept[dept] && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground w-32">
                                        <Progress value={fulfillmentStatsByDept[dept].percentage} className="w-full h-2" />
                                        <span className="font-semibold text-foreground">{Math.round(fulfillmentStatsByDept[dept].percentage)}%</span>
                                    </div>
                                )}
                                <Badge variant="secondary">{fulfillmentItemsByDept[dept].length}</Badge>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-2 pt-0">
                        <FulfillmentClient items={fulfillmentItemsByDept[dept]} role={role}/>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
