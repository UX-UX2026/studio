'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
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
import { ApprovalRequest, ApprovalItem } from "@/lib/approvals-mock-data";
import { useRoles } from "@/lib/roles-provider";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart";


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
    const { roles, loading: rolesLoading } = useRoles();

    const fulfillmentQuery = useMemo(() => {
        if (!firestore) return null;
        const statuses = ['In Fulfillment', 'Completed'];
        if (role === 'Requester' || role === 'Manager') {
            return query(collection(firestore, 'procurementRequests'), where('status', 'in', statuses), where('department', '==', department));
        }
        return query(collection(firestore, 'procurementRequests'), where('status', 'in', statuses));
    }, [firestore, role, department]);

    const { data: fulfillmentRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(fulfillmentQuery);

    const allFulfillmentItems = useMemo(() => {
        if (!fulfillmentRequests) return [];
        return fulfillmentRequests.flatMap(req => 
            req.items.map(item => ({
                ...item,
                procurementRequestId: req.id,
                department: req.department,
                item: item.description,
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

    const fulfillmentStatusSummary = useMemo(() => {
        if (!allFulfillmentItems) return { data: [], total: 0 };
        const statusCounts = allFulfillmentItems.reduce((acc, item) => {
            const status = item.fulfillmentStatus || 'Pending';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const data = Object.entries(statusCounts).map(([name, value]) => ({ 
            name, 
            value,
            fill: `var(--color-${name.replace(/ /g, "")})`
        }));
        
        return { data, total: allFulfillmentItems.length };
    }, [allFulfillmentItems]);

    const fulfillmentStatusChartConfig = {
        Sourcing: { label: "Sourcing", color: "hsl(var(--chart-1))" },
        Quoted: { label: "Quoted", color: "hsl(var(--chart-2))" },
        Ordered: { label: "Ordered", color: "hsl(var(--chart-3))" },
        Completed: { label: "Completed", color: "hsl(var(--chart-4))" },
        Pending: { label: "Pending", color: "hsl(var(--chart-5))" },
    } satisfies ChartConfig;

    const departmentOrder = useMemo(() => Object.keys(fulfillmentItemsByDept).sort(), [fulfillmentItemsByDept]);
    
    const departmentsForUser = useMemo(() => {
        if ((role === 'Manager' || role === 'Requester') && department) {
            return departmentOrder.filter(d => d === department);
        }
        return departmentOrder;
    }, [role, department, departmentOrder]);
    
    const loading = userLoading || requestsLoading || rolesLoading;
    
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
                <CardTitle>Fulfillment Status Overview</CardTitle>
                <CardDescription>
                Breakdown of all fulfillment items by their current status.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={fulfillmentStatusChartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {fulfillmentStatusSummary.data.length > 0 ? (
                    <PieChart>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Pie data={fulfillmentStatusSummary.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                        {fulfillmentStatusSummary.data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                    ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No fulfillment items found.
                    </div>
                    )}
                </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
        <Card>
        <CardHeader>
            <CardTitle>Procurement Fulfillment Details</CardTitle>
            <p className="text-sm text-muted-foreground">
                Track and manage procurement items, grouped by department. View overall fulfillment and completion progress for each.
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
    </div>
  );
}