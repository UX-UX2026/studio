'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import type { ApprovalRequest, Department } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Pending Manager Approval': return <Badge variant="outline" className="text-blue-500 border-blue-500">Pending Manager</Badge>;
        case 'Pending Executive': return <Badge variant="outline" className="text-orange-500 border-orange-500">Pending Executive</Badge>;
        case 'Approved': return <Badge variant="outline" className="text-purple-500 border-purple-500">Approved</Badge>;
        case 'In Fulfillment': return <Badge variant="outline" className="text-indigo-500 border-indigo-500">In Fulfillment</Badge>;
        case 'Completed': return <Badge variant="outline" className="text-green-500 border-green-500">Completed</Badge>;
        case 'Queries Raised': return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{status}</Badge>;
        case 'Rejected': return <Badge variant="destructive">{status}</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>
    }
}

export default function ProcurementHistoryPage() {
    const { user, profile, loading: userLoading, role, departmentId: userDepartmentId, reportingDepartments } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    const [periodFilter, setPeriodFilter] = useState<string>('all');

    const historyQuery = useMemo(() => {
        if (!firestore || !profile) return null;
        return query(collection(firestore, 'procurementRequests'), where('status', 'not-in', ['Draft']));
    }, [firestore, profile]);

    const { data: allRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(historyQuery);

    const filteredByRole = useMemo(() => {
        if (!allRequests || !role) return [];
        if (role === 'Administrator' || role === 'Procurement Officer' || role === 'Procurement Assistant') return allRequests;
        if (role === 'Executive') {
            if (reportingDepartments && reportingDepartments.length > 0) {
                return allRequests.filter(req => reportingDepartments.includes(req.departmentId));
            }
            return allRequests;
        }
        return allRequests.filter(req => req.departmentId === userDepartmentId);
    }, [allRequests, role, userDepartmentId, reportingDepartments]);

    const departmentsQuery = useMemo(() => firestore ? collection(firestore, 'departments') : null, [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const finalFiltered = useMemo(() => {
        let filtered = filteredByRole;
        if (departmentFilter !== 'all') filtered = filtered.filter(req => req.departmentId === departmentFilter);
        if (periodFilter !== 'all') filtered = filtered.filter(req => req.period === periodFilter);
        return [...filtered].sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    }, [filteredByRole, departmentFilter, periodFilter]);

    const availablePeriods = useMemo(() => {
        if (!filteredByRole) return [];
        return ['all', ...Array.from(new Set(filteredByRole.map(r => r.period)))];
    }, [filteredByRole]);

    const visibleDepartments = useMemo(() => {
        if (!departments) return [];
        if (role === 'Administrator' || role === 'Procurement Officer' || (role === 'Executive' && (!reportingDepartments || reportingDepartments.length === 0))) return departments;
        if (role === 'Executive') return departments.filter(d => reportingDepartments.includes(d.id));
        if (role === 'Manager' || role === 'Requester') return departments.filter(d => d.id === userDepartmentId);
        return [];
    }, [departments, role, reportingDepartments, userDepartmentId]);
    
    if (userLoading || requestsLoading || deptsLoading) return <div className="flex h-screen items-center justify-center"><Loader className="animate-spin" /></div>;
    
    return (
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History />All Submissions</CardTitle><CardDescription>Review all open and closed procurement requests.</CardDescription></CardHeader>
            <CardContent>
                <div className="flex items-center gap-4 p-4 mb-6 border rounded-lg bg-muted/50">
                    <div className="grid gap-1.5"><Label>Department</Label><Select value={departmentFilter} onValueChange={setDepartmentFilter}><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{visibleDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid gap-1.5"><Label>Period</Label><Select value={periodFilter} onValueChange={setPeriodFilter}><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent>{availablePeriods.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Periods' : p}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="overflow-auto border rounded-lg">
                    <Table>
                        <TableHeader><TableRow><TableHead>Request ID</TableHead><TableHead>Department</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {finalFiltered.length > 0 ? finalFiltered.map(req => (
                                <TableRow key={req.id}><TableCell className="font-medium">{req.id.substring(0,8)}...</TableCell><TableCell>{req.department}</TableCell><TableCell>{req.period}</TableCell><TableCell>{getStatusBadge(req.status)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(req.total)}</TableCell><TableCell className="text-right"><Button asChild variant="outline" size="sm"><Link href={`/dashboard/approvals?id=${req.id}`}>View Details</Link></Button></TableCell></TableRow>
                            )) : <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No records found.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}