'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader, ClipboardCheck, PackageCheck, Clock, AlertCircle } from "lucide-react";
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
import type { ApprovalRequest, Department, FulfillmentItem } from "@/types";
import { useRoles } from "@/lib/roles-provider";

export default function FulfillmentPage() {
    const { user, profile, role, reportingDepartments, loading: userLoading, departmentId: userDepartmentId } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { roles, loading: rolesLoading } = useRoles();

    const fulfillmentQuery = useMemo(() => {
        if (!firestore) return null;
        // Fetch requests that are in fulfillment or recently completed
        const statuses = ['In Fulfillment', 'Completed', 'Approved'];
        return query(collection(firestore, 'procurementRequests'), where('status', 'in', statuses));
    }, [firestore]);

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
                approvedOn: req.timeline.find(t => t.stage.includes('Approval'))?.date || 'N/A',
            }))
        );
    }, [fulfillmentRequests]);

    const filteredItems = useMemo(() => {
        if (!allFulfillmentItems || !role) return [];
        
        // Admins and Procurement see everything
        if (role === 'Administrator' || role === 'Procurement Officer' || role === 'Procurement Assistant') {
            return allFulfillmentItems;
        }

        // Executives see their reporting departments
        if (role === 'Executive') {
            if (!reportingDepartments || reportingDepartments.length === 0) return allFulfillmentItems;
            return allFulfillmentItems.filter(item => reportingDepartments.includes(item.departmentId));
        }

        // Managers and Requesters see their own department
        if (userDepartmentId) {
            return allFulfillmentItems.filter(item => item.departmentId === userDepartmentId);
        }

        return [];
    }, [allFulfillmentItems, role, reportingDepartments, userDepartmentId]);

    const itemsByDept = useMemo(() => {
        return filteredItems.reduce((acc, item) => {
            if (!acc[item.department]) acc[item.department] = [];
            acc[item.department].push(item);
            return acc;
        }, {} as Record<string, FulfillmentItem[]>);
    }, [filteredItems]);

    const stats = useMemo(() => {
        const total = filteredItems.length;
        const completed = filteredItems.filter(i => i.fulfillmentStatus === 'Completed').length;
        const pending = total - completed;
        const percentage = total > 0 ? (completed / total) * 100 : 0;
        
        return { total, completed, pending, percentage };
    }, [filteredItems]);

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

    const loading = userLoading || requestsLoading || deptsLoading;
    
    if (loading) {
        return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader className="h-8 w-8 animate-spin" /></div>;
    }

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
            <Card className="flex-1">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <PackageCheck className="h-4 w-4 text-green-500" />
                        Fulfillment Overview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <p className="text-2xl font-bold">{stats.completed} / {stats.total}</p>
                            <p className="text-xs text-muted-foreground">Items fully delivered</p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-semibold">{Math.round(stats.percentage)}%</p>
                        </div>
                    </div>
                    <Progress value={stats.percentage} className="h-2" />
                </CardContent>
            </Card>
            <Card className="flex-1">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        Pending Items
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground">Line items currently in progress</p>
                </CardContent>
            </Card>
            <Card className="flex-1">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        Action Required
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold">
                        {filteredItems.filter(i => !i.fulfillmentStatus || i.fulfillmentStatus === 'Pending').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Items awaiting initial sourcing</p>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-6 w-6 text-primary" />
                    Departmental Fulfillment
                </CardTitle>
                <CardDescription>
                    Track real-time delivery status. Requesters and Managers can use the 'Ping' tool to request updates from Procurement.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {Object.keys(itemsByDept).length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-3" defaultValue={Object.keys(itemsByDept)}>
                        {Object.entries(itemsByDept).sort().map(([dept, items]) => {
                            const deptCompleted = items.filter(i => i.fulfillmentStatus === 'Completed').length;
                            const deptPercent = (deptCompleted / items.length) * 100;
                            
                            return (
                                <AccordionItem value={dept} key={dept} className="border rounded-lg bg-card overflow-hidden">
                                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                                        <div className="flex justify-between items-center w-full mr-4">
                                            <span className="font-bold text-lg">{dept}</span>
                                            <div className="flex items-center gap-6">
                                                <div className="hidden sm:flex flex-col items-end gap-1 w-32">
                                                    <div className="flex justify-between w-full text-[10px] uppercase font-bold text-muted-foreground">
                                                        <span>Progress</span>
                                                        <span>{Math.round(deptPercent)}%</span>
                                                    </div>
                                                    <Progress value={deptPercent} className="w-full h-1.5" />
                                                </div>
                                                <Badge variant="secondary" className="font-mono">{items.length} Items</Badge>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                        <FulfillmentClient items={items} role={role!}/>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                ) : (
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg bg-muted/20">
                        <PackageCheck className="h-12 w-12 text-muted-foreground/40 mb-2" />
                        <p className="text-muted-foreground font-medium">No items found in fulfillment.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
