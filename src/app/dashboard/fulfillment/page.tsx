'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FulfillmentClient } from "@/components/app/fulfillment-client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { ApprovalRequest, ApprovalItem } from "@/lib/approvals-mock-data";


export type FulfillmentItem = ApprovalItem & {
  procurementRequestId: string;
  department: string;
  item: string;
  approvedOn: string;
  request: any;
};

export default function FulfillmentPage() {
    const { user, role, department, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const fulfillmentQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'procurementRequests'), where('status', '==', 'In Fulfillment'));
    }, [firestore]);

    const { data: fulfillmentRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(fulfillmentQuery);

    const allFulfillmentItems = useMemo(() => {
        if (!fulfillmentRequests) return [];
        return fulfillmentRequests.flatMap(req => 
            req.items.map(item => ({
                ...item,
                procurementRequestId: req.id,
                department: req.department,
                item: item.description,
                approvedOn: req.timeline.find(t => t.stage === 'Executive Review')?.date || new Date().toISOString(),
                 request: {
                    itemName: item.description,
                    itemDescription: item.description,
                    quantity: item.qty,
                    category: item.category,
                    unitPrice: item.unitPrice,
                    department: req.department,
                }
            }))
        )
    }, [fulfillmentRequests]);


    useEffect(() => {
      const allowedRoles = ['Procurement Officer', 'Administrator', 'Manager', 'Executive', 'Procurement Assistant'];
      if (!userLoading && (!user || !role || !allowedRoles.includes(role))) {
        router.push('/dashboard');
      }
    }, [user, role, userLoading, router]);
    
    const fulfillmentItemsByDept = useMemo(() => {
        return allFulfillmentItems.reduce((acc, item) => {
            if (!acc[item.department]) {
                acc[item.department] = [];
            }
            acc[item.department].push(item);
            return acc;
        }, {} as Record<string, FulfillmentItem[]>);
    }, [allFulfillmentItems]);

    const fulfillmentStatsByDept = useMemo(() => {
        const stats: Record<string, { total: number, completed: number, percentage: number }> = {};
        for (const dept in fulfillmentItemsByDept) {
            const items = fulfillmentItemsByDept[dept];
            const total = items.length;
            const completed = items.filter(item => item.fulfillmentStatus === 'Completed').length;
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
    
    const loading = userLoading || requestsLoading;

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
