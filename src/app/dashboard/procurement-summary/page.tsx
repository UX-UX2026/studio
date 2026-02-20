'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { ApprovalRequest, ApprovalItem } from "@/lib/approvals-mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

type SummaryItem = ApprovalItem & {
    department: string;
    period: string;
};

export default function ProcurementSummaryPage() {
    const { user, role, department, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const requestsQuery = useMemo(() => {
        if (!firestore) return null;
        const baseQuery = collection(firestore, 'procurementRequests');

        // Admins and Executives see all departments
        if (role === 'Administrator' || role === 'Executive' || role === 'Procurement Officer') {
            return query(baseQuery);
        }

        // Managers see their own department
        if (role === 'Manager' && department) {
            return query(baseQuery, where('department', '==', department));
        }

        return null;

    }, [firestore, role, department]);

    const { data: requests, loading: requestsLoading } = useCollection<ApprovalRequest>(requestsQuery);

    const allItems = useMemo(() => {
        if (!requests) return [];
        const items: SummaryItem[] = [];
        requests.forEach(req => {
            req.items.forEach(item => {
                items.push({
                    ...item,
                    department: req.department,
                    period: req.period,
                });
            });
        });
        return items;
    }, [requests]);

    useEffect(() => {
      const allowedRoles = ['Administrator', 'Manager', 'Procurement Officer', 'Executive'];
      if (!userLoading && (!user || !role || !allowedRoles.includes(role))) {
        router.push('/dashboard');
      }
    }, [user, role, userLoading, router]);

    const loading = userLoading || requestsLoading;
    
    if (loading || !user) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const totalProcurement = allItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

  return (
    <Card>
        <CardHeader>
            <CardTitle>Procurement Summary</CardTitle>
            <CardDescription>A summary of all line items from submitted procurement requests.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-4 p-4 text-right rounded-lg bg-primary/10 border-primary/20 border shrink-0">
                <p className="text-sm font-bold uppercase text-primary">Total Value of All Items</p>
                <p className="text-3xl font-black text-primary">{formatCurrency(totalProcurement)}</p>
            </div>
            <div className="overflow-x-auto rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted hover:bg-muted">
                            <TableHead>Department</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allItems.length > 0 ? allItems.map((item, index) => (
                            <TableRow key={`${item.id}-${index}`}>
                                <TableCell><Badge variant="secondary">{item.department}</Badge></TableCell>
                                <TableCell>{item.period}</TableCell>
                                <TableCell className="font-medium">{item.description}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.qty * item.unitPrice)}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No procurement items found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );
}
