
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Fragment } from "react";
import { Loader, AlertTriangle, Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { ApprovalRequest, BudgetItem, Department } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useBudgetSummary } from "@/hooks/use-budget-summary";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};


export default function ProcurementSummaryPage() {
    const { user, role, department: userDepartment, reportingDepartments, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const [openCapitalCategory, setOpenCapitalCategory] = useState<string | null>(null);

    // Data fetching
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);
    
    const requestsQuery = useMemo(() => {
        if (!firestore) return null;
        const activeStatuses = ['Pending Manager Approval', 'Pending Executive', 'Approved', 'In Fulfillment', 'Completed'];
        return query(collection(firestore, 'procurementRequests'), where('status', 'in', activeStatuses));
    }, [firestore]);
    const { data: allRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(requestsQuery);

    const budgetsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(collection(firestore, 'budgets'), where('departmentId', '==', selectedDepartmentId));
    }, [firestore, selectedDepartmentId]);
    const { data: budgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);

    const visibleDepartments = useMemo(() => {
        if (!departments) return [];
        if (role === 'Administrator' || (role === 'Executive' && (!reportingDepartments || reportingDepartments.length === 0))) {
            return departments;
        }
        if (role === 'Executive') {
            return departments.filter(d => reportingDepartments.includes(d.id));
        }
        if (role === 'Manager' || role === 'Requester') {
            return departments.filter(d => d.name === userDepartment);
        }
        return [];
    }, [departments, role, reportingDepartments, userDepartment]);

    const availablePeriods = useMemo(() => {
        if (!allRequests || !selectedDepartmentId) return [];
        
        const periods = new Set<string>();
        allRequests.forEach(req => {
            if (req.departmentId === selectedDepartmentId) {
                periods.add(req.period);
            }
        });
    
        return Array.from(periods).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }, [allRequests, selectedDepartmentId]);

    useEffect(() => {
        if (deptsLoading || !visibleDepartments) return;
    
        if (!selectedDepartmentId && visibleDepartments.length > 0) {
            setSelectedDepartmentId(visibleDepartments[0].id);
        } else if (selectedDepartmentId && !visibleDepartments.some(d => d.id === selectedDepartmentId)) {
            setSelectedDepartmentId(visibleDepartments[0]?.id || '');
        }
    
    }, [visibleDepartments, deptsLoading, selectedDepartmentId]);

    useEffect(() => {
        if (availablePeriods.length > 0 && !selectedPeriod) {
            setSelectedPeriod(availablePeriods[0]);
        } else if (availablePeriods.length > 0 && !availablePeriods.includes(selectedPeriod)) {
            setSelectedPeriod(availablePeriods[0]);
        } else if (availablePeriods.length === 0) {
            setSelectedPeriod('');
        }
    }, [availablePeriods, selectedPeriod]);

    const procurementItemsForSummary = useMemo(() => {
        if (!allRequests || !selectedDepartmentId || !selectedPeriod) return [];
        const selectedRequest = allRequests.find(req => req.departmentId === selectedDepartmentId && req.period === selectedPeriod);
        return selectedRequest ? selectedRequest.items : [];
    }, [allRequests, selectedDepartmentId, selectedPeriod]);

    const { operationalSummary, capitalSummary } = useBudgetSummary(procurementItemsForSummary, selectedDepartmentId, selectedPeriod, budgetItems, departments);
    
    useEffect(() => {
      const allowedRoles = ['Administrator', 'Manager', 'Procurement Officer', 'Executive', 'Requester'];
      if (userLoading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }
      if (role && !allowedRoles.includes(role)) {
        router.push('/dashboard');
      }
    }, [user, role, userLoading, router]);

    const loading = userLoading || requestsLoading || deptsLoading || (selectedDepartmentId && budgetsLoading);
    const monthForHeader = selectedPeriod ? selectedPeriod.split(' ')[0] : '';

    const allowedRoles = useMemo(() => ['Administrator', 'Manager', 'Procurement Officer', 'Executive', 'Requester'], []);
    if (loading || !user || !role || !allowedRoles.includes(role)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Procurement vs. Budget Summary</CardTitle>
            <CardDescription>
                Compare submitted procurement request values against the imported budget forecast for a selected department and period.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-wrap items-end gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
                <div className="grid flex-1 min-w-[200px] items-center gap-1.5">
                    <Label htmlFor="department">Department</Label>
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId} disabled={deptsLoading || visibleDepartments.length <= 1}>
                        <SelectTrigger id="department">
                            <SelectValue placeholder={deptsLoading ? "Loading..." : "Select department"} />
                        </SelectTrigger>
                        <SelectContent>
                           {visibleDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid flex-1 min-w-[200px] items-center gap-1.5">
                    <Label htmlFor="period">Procurement Period</Label>
                     <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={availablePeriods.length === 0}>
                        <SelectTrigger id="period">
                            <SelectValue placeholder="Select a period..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availablePeriods.length > 0 ? (
                                availablePeriods.map(period => <SelectItem key={period} value={period}>{period}</SelectItem>)
                            ) : (
                                <div className="p-4 text-sm text-muted-foreground">No submissions found.</div>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
             {loading ? (
                 <div className="flex h-64 items-center justify-center">
                    <Loader className="h-8 w-8 animate-spin" />
                </div>
             ) : (
                <div className="space-y-8">
                    {/* Operational Summary */}
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted hover:bg-muted">
                                    <TableHead className="font-bold">Operational Line Items</TableHead>
                                    <TableHead className="text-right font-bold">{monthForHeader} Procurement</TableHead>
                                    <TableHead className="text-right font-bold">{monthForHeader} Forecast</TableHead>
                                    <TableHead className="text-right font-bold">Procurement vs Forecast</TableHead>
                                    <TableHead className="font-bold">Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {operationalSummary.lines.length > 0 ? operationalSummary.lines.map((item) => (
                                    <Fragment key={item.category}>
                                        <TableRow 
                                            onClick={() => setOpenCategory(openCategory === item.category ? null : item.category)}
                                            className={cn("cursor-pointer", item.procurementTotal > item.forecastTotal && "bg-red-50 dark:bg-red-900/20")}
                                        >
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <ChevronRight className={cn("h-4 w-4 transition-transform", openCategory === item.category && "rotate-90")} />
                                                {item.category}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(item.procurementTotal)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(item.forecastTotal)}</TableCell>
                                            <TableCell className={cn("text-right font-mono font-semibold", item.procurementTotal > item.forecastTotal && "text-red-500 flex items-center justify-end gap-2")}>
                                                {item.procurementTotal > item.forecastTotal && <AlertTriangle className="h-4 w-4" />}
                                                {formatCurrency(item.variance)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{item.comments}</TableCell>
                                        </TableRow>
                                        {openCategory === item.category && (
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableCell colSpan={5} className="p-2">
                                                    <div className="p-2 bg-background rounded-md border">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                    <TableHead>Item</TableHead>
                                                                    <TableHead>Type</TableHead>
                                                                    <TableHead className="text-center">Qty</TableHead>
                                                                    <TableHead className="text-right">Unit Price</TableHead>
                                                                    <TableHead className="text-right">Total</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {item.items.map((subItem) => (
                                                                    <TableRow key={subItem.id}>
                                                                        <TableCell>{subItem.description}</TableCell>
                                                                        <TableCell><Badge variant={subItem.type === 'Recurring' ? 'secondary' : 'outline'}>{subItem.type}</Badge></TableCell>
                                                                        <TableCell className="text-center">{subItem.qty}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice * subItem.qty)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                            No operational data for the selected period.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-muted hover:bg-muted font-bold">
                                    <TableCell>Operational Subtotal</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.procurement)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.forecast)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.variance)}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    {/* Capital Summary */}
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted hover:bg-muted">
                                    <TableHead className="font-bold">Capital Line Items</TableHead>
                                    <TableHead className="text-right font-bold">{monthForHeader} Procurement</TableHead>
                                    <TableHead className="text-right font-bold">{monthForHeader} Forecast</TableHead>
                                    <TableHead className="text-right font-bold">Procurement vs Forecast</TableHead>
                                    <TableHead className="font-bold">Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {capitalSummary.lines.length > 0 ? capitalSummary.lines.map((item) => (
                                    <Fragment key={item.category}>
                                        <TableRow 
                                            onClick={() => setOpenCapitalCategory(openCapitalCategory === item.category ? null : item.category)}
                                            className={cn("cursor-pointer", item.procurementTotal > item.forecastTotal && "bg-red-50 dark:bg-red-900/20")}
                                        >
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <ChevronRight className={cn("h-4 w-4 transition-transform", openCapitalCategory === item.category && "rotate-90")} />
                                                {item.category}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(item.procurementTotal)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(item.forecastTotal)}</TableCell>
                                            <TableCell className={cn("text-right font-mono font-semibold", item.procurementTotal > item.forecastTotal && "text-red-500 flex items-center justify-end gap-2")}>
                                                {item.procurementTotal > item.forecastTotal && <AlertTriangle className="h-4 w-4" />}
                                                {formatCurrency(item.variance)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{item.comments}</TableCell>
                                        </TableRow>
                                        {openCapitalCategory === item.category && (
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableCell colSpan={5} className="p-2">
                                                    <div className="p-2 bg-background rounded-md border">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                    <TableHead>Item</TableHead>
                                                                    <TableHead>Type</TableHead>
                                                                    <TableHead className="text-center">Qty</TableHead>
                                                                    <TableHead className="text-right">Unit Price</TableHead>
                                                                    <TableHead className="text-right">Total</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {item.items.map((subItem) => (
                                                                    <TableRow key={subItem.id}>
                                                                        <TableCell>{subItem.description}</TableCell>
                                                                        <TableCell><Badge variant="outline">{subItem.type}</Badge></TableCell>
                                                                        <TableCell className="text-center">{subItem.qty}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice * subItem.qty)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                            No capital data for the selected period.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-muted hover:bg-muted font-bold">
                                    <TableCell>Capital Subtotal</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(capitalSummary.totals.procurement)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(capitalSummary.totals.forecast)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(capitalSummary.totals.variance)}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    {/* Grand Total */}
                     <Table>
                        <TableFooter>
                             <TableRow className="bg-card hover:bg-card text-lg font-bold border-t-2 border-primary">
                                <TableCell>Grand Total</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.procurement + capitalSummary.totals.procurement)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.forecast + capitalSummary.totals.forecast)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.variance + capitalSummary.totals.variance)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableFooter>
                     </Table>
                </div>
            )}
        </CardContent>
    </Card>
  );
}
