

'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
import type { UserProfile } from '@/context/authentication-provider';
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import type { ApprovalRequest, ApprovalItem, Department } from "@/types";
import { useRoles } from "@/lib/roles-provider";

export type FulfillmentItem = ApprovalItem & {
  procurementRequestId: string;
  department: string;
  item: string;
  approvedOn: string;
  request: any;
  submittedBy: string;
};

export default function FulfillmentPage() {
    const { user, profile, role, reportingDepartments, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { roles, loading: rolesLoading } = useRoles();

    const fulfillmentQuery = useMemo(() => {
        if (!firestore) return null;
        const statuses = ['In Fulfillment', 'Completed'];

        let q = query(collection(firestore, 'procurementRequests'), where('status', 'in', statuses));

        if (role === 'Executive' && reportingDepartments && reportingDepartments.length > 0) {
            q = query(q, where('departmentId', 'in', reportingDepartments));
        }

        return q;
    }, [firestore, role, reportingDepartments]);

    const { data: fulfillmentRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(fulfillmentQuery);
    
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const allFulfillmentItems = useMemo(() => {
        if (!fulfillmentRequests) return [];
        return fulfillmentRequests.flatMap(req => 
            req.items.map(item => ({
                ...item,
                procurementRequestId: req.id,
                department: req.department,
                departmentId: req.departmentId,
                item: item.description,
                submittedBy: req.submittedBy,
                approvedOn: req.timeline.find(t => t.stage === 'Executive Approval')?.date || new Date().toISOString(),
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
      if (userLoading || rolesLoading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }
      const userPerms = roles.find(r => r.name === role)?.permissions || [];
      if (role !== 'Administrator' && !userPerms.includes('fulfillment:view')) {
        router.push('/dashboard');
      }
    }, [user, role, roles, userLoading, rolesLoading, router]);
    
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
    
    const allDepartmentNames = useMemo(() => Object.keys(fulfillmentItemsByDept).sort(), [fulfillmentItemsByDept]);

    const departmentsForUser = useMemo(() => {
        if (!profile || !allDepartmentNames || !departments) return [];
        
        const role = profile.role;
        const userDepartmentName = profile.department;
        
        if (role === 'Administrator' || role === 'Procurement Officer' || role === 'Procurement Assistant') {
            return allDepartmentNames;
        }
    
        if (role === 'Manager' || role === 'Requester') {
            return userDepartmentName ? allDepartmentNames.filter(d => d === userDepartmentName) : [];
        }
    
        if (role === 'Executive') {
            if (!profile.reportingDepartments || profile.reportingDepartments.length === 0) {
                return allDepartmentNames; // Can see all if not restricted
            }
            const reportingDeptNames = departments
                .filter(d => profile.reportingDepartments!.includes(d.id))
                .map(d => d.name);
            
            return allDepartmentNames.filter(deptName => reportingDeptNames.includes(deptName));
        }
    
        return [];
    }, [profile, allDepartmentNames, departments]);

    const loading = userLoading || requestsLoading || rolesLoading || deptsLoading;
    
    if (loading || !user || !role) {
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
                <CardTitle>Procurement Fulfillment Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Track and manage procurement items, grouped by department. View overall fulfillment and completion progress for each.
                </p>
            </CardHeader>
            <CardContent>
                {departmentsForUser.length > 0 ? (
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
                ) : (
                    <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">No fulfillment items found for your assigned departments.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
