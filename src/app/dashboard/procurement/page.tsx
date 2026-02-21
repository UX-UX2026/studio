'use client';

import { useUser, type UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader, AlertTriangle, Briefcase, FileText, History, BarChart, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { ApprovalRequest } from "@/lib/approvals-mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { SubmissionClient } from "@/components/app/submission-client";
import { RecurringClient } from "@/components/app/recurring-client";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

type Department = {
    id: string;
    name: string;
    budgetHeaders?: string[];
};

type BudgetItem = {
    id: string;
    departmentId: string;
    category: string;
    forecasts: number[];
    yearTotal: number;
};

type RecurringItem = {
    id: string;
    category: string;
    name: string;
    amount: number;
    active: boolean;
};

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currentYear = new Date().getFullYear();
const periods = months.map(m => `${m} ${currentYear + 2}`); // Matching the mock data year format

export default function ProcurementQuickSubmitPage() {
    const { user, role, department: userDepartment, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<string>(periods[1]); // Default to Feb 2026

    // Data fetching
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);
    
    const requestsQuery = useMemo(() => collection(firestore, 'procurementRequests'), [firestore]);
    const { data: allRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(requestsQuery);

    const budgetsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(collection(firestore, 'budgets'), where('departmentId', '==', selectedDepartmentId));
    }, [firestore, selectedDepartmentId]);
    const { data: budgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);

    const recurringItemsQuery = useMemo(() => query(collection(firestore, 'recurringItems'), where('active', '==', true)), [firestore]);
    const { data: recurringItems, loading: recurringLoading } = useCollection<RecurringItem>(recurringItemsQuery);

    // Set default department based on user role and data
    useEffect(() => {
        if (deptsLoading || !departments) return;
        if (role === 'Manager' && userDepartment) {
            const userDept = departments.find(d => d.name === userDepartment);
            if (userDept) {
                setSelectedDepartmentId(userDept.id);
                return;
            }
        }
        // Fallback for admins or if user dept not found
        if (!selectedDepartmentId && departments.length > 0) {
            setSelectedDepartmentId(departments[0].id);
        }
    }, [role, userDepartment, departments, deptsLoading, selectedDepartmentId]);


    const summaryData = useMemo(() => {
        if (!selectedDepartmentId || !selectedPeriod || !allRequests || !budgetItems) {
            return { lines: [], totals: { procurement: 0, forecast: 0, variance: 0 } };
        }

        const selectedRequest = allRequests.find(req => req.departmentId === selectedDepartmentId && req.period === selectedPeriod);
        const selectedDept = departments?.find(d => d.id === selectedDepartmentId);

        const procurementItems = selectedRequest ? selectedRequest.items : [];
        const monthName = selectedPeriod.split(' ')[0];
        const monthIndex = selectedDept?.budgetHeaders?.findIndex(h => h.toLowerCase().startsWith(monthName.toLowerCase().substring(0,3))) ?? -1;

        const allCategories = new Set([
            ...procurementItems.map(item => item.category),
            ...budgetItems.map(item => item.category)
        ]);

        const lines = Array.from(allCategories).map(category => {
            if (!category) return null;

            const procurementTotal = procurementItems
                .filter(item => item.category === category)
                .reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

            const budgetItem = budgetItems.find(item => item.category === category);
            const forecastTotal = (budgetItem && monthIndex !== -1 && budgetItem.forecasts.length > monthIndex)
                ? budgetItem.forecasts[monthIndex]
                : 0;

            const variance = procurementTotal - forecastTotal;
            const isOverBudget = forecastTotal > 0 && procurementTotal > (forecastTotal * 1.05);

            return { category, procurementTotal, forecastTotal, variance, isOverBudget };
        }).filter(Boolean) as { category: string; procurementTotal: number; forecastTotal: number; variance: number; isOverBudget: boolean; }[];
        
        const totals = lines.reduce((acc, line) => {
            acc.procurement += line.procurementTotal;
            acc.forecast += line.forecastTotal;
            acc.variance += line.variance;
            return acc;
        }, { procurement: 0, forecast: 0, variance: 0 });

        return { lines, totals };

    }, [selectedDepartmentId, selectedPeriod, allRequests, budgetItems, departments]);

    const periodSubmissionTotal = useMemo(() => {
        const selectedRequest = allRequests?.find(req => req.departmentId === selectedDepartmentId && req.period === selectedPeriod);
        return selectedRequest?.total || 0;
    }, [selectedDepartmentId, selectedPeriod, allRequests]);

    const recurringItemsTotal = useMemo(() => {
        if (!recurringItems) return 0;
        return recurringItems.reduce((sum, item) => sum + item.amount, 0);
    }, [recurringItems]);
    
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

    const loading = userLoading || requestsLoading || deptsLoading || budgetsLoading || recurringLoading;
    const monthForHeader = selectedPeriod.split(' ')[0];

    const budgetProgress = useMemo(() => {
        const { procurement, forecast } = summaryData.totals;
        if (forecast === 0) return 0;
        return Math.round((procurement / forecast) * 100);
    }, [summaryData]);

    const allowedRoles = useMemo(() => ['Administrator', 'Manager', 'Procurement Officer', 'Executive', 'Requester'], []);
    if (loading || !user || !role || !allowedRoles.includes(role)) {
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
                <CardTitle>Procurement Quick Submit</CardTitle>
                <CardDescription>
                    A consolidated view of your procurement activities. Select a department and period to begin.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap items-end gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
                    <div className="grid flex-1 min-w-[200px] items-center gap-1.5">
                        <Label htmlFor="department">Department</Label>
                        <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId} disabled={deptsLoading || (role === 'Manager' && !!userDepartment)}>
                            <SelectTrigger id="department">
                                <SelectValue placeholder={deptsLoading ? "Loading..." : "Select department"} />
                            </SelectTrigger>
                            <SelectContent>
                                {role === 'Administrator' || role === 'Executive' || role === 'Procurement Officer' ? (
                                    departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)
                                ) : (
                                    <SelectItem value={selectedDepartmentId}>{departments?.find(d => d.id === selectedDepartmentId)?.name}</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid flex-1 min-w-[200px] items-center gap-1.5">
                        <Label htmlFor="period">Procurement Period</Label>
                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                            <SelectTrigger id="period">
                                <SelectValue placeholder="Select period" />
                            </SelectTrigger>
                            <SelectContent>
                                {periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Accordion type="multiple" className="w-full space-y-4" defaultValue={['summary', 'submission', 'recurring']}>
            <AccordionItem value="summary" className="border-0 rounded-lg bg-card shadow-sm">
                <AccordionTrigger className="p-4 hover:no-underline rounded-lg data-[state=open]:rounded-b-none">
                    <div className="flex items-center gap-3">
                        <BarChart className="h-6 w-6 text-primary"/>
                        <div className="text-left">
                            <h3 className="font-semibold">Budget Summary</h3>
                            <p className="text-sm text-muted-foreground">Compare procurement vs. forecast.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 ml-auto">
                        <div className="text-right">
                           <p className="text-sm font-semibold">{formatCurrency(summaryData.totals.procurement)}</p>
                           <p className="text-xs text-muted-foreground">vs {formatCurrency(summaryData.totals.forecast)}</p>
                        </div>
                        <div className="w-32">
                           <Progress value={budgetProgress} />
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0">
                    <div className="overflow-auto rounded-lg border mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted hover:bg-muted">
                                    <TableHead className="font-bold">Procurement Line Items</TableHead>
                                    <TableHead className="text-right font-bold">{monthForHeader} Procurement</TableHead>
                                    <TableHead className="text-right font-bold">{monthForHeader} Forecast</TableHead>
                                    <TableHead className="text-right font-bold">Procurement vs Forecast</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summaryData.lines.length > 0 ? summaryData.lines.map((item) => (
                                    <TableRow key={item.category}>
                                        <TableCell className="font-medium">{item.category}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(item.procurementTotal)}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(item.forecastTotal)}</TableCell>
                                        <TableCell className={cn("text-right font-mono font-semibold", item.isOverBudget && "text-red-500 flex items-center justify-end gap-2")}>
                                            {item.isOverBudget && <AlertTriangle className="h-4 w-4" />}
                                            {formatCurrency(item.variance)}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                            No data available for the selected department and period.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableRow className="bg-muted hover:bg-muted font-bold">
                                <TableCell>Subtotal</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(summaryData.totals.procurement)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(summaryData.totals.forecast)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(summaryData.totals.variance)}</TableCell>
                            </TableRow>
                        </Table>
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="submission" className="border-0 rounded-lg bg-card shadow-sm">
                 <AccordionTrigger className="p-4 hover:no-underline rounded-lg data-[state=open]:rounded-b-none">
                    <div className="flex items-center gap-3">
                        <FileText className="h-6 w-6 text-primary"/>
                        <div className="text-left">
                            <h3 className="font-semibold">Period Submission</h3>
                            <p className="text-sm text-muted-foreground">Manage your request for the period.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 ml-auto">
                        <div className="text-right">
                           <p className="text-sm font-semibold">{formatCurrency(periodSubmissionTotal)}</p>
                           <p className="text-xs text-muted-foreground">Request Total</p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0">
                    <SubmissionClient userRole={role} userDepartment={userDepartment} />
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="recurring" className="border-0 rounded-lg bg-card shadow-sm">
                <AccordionTrigger className="p-4 hover:no-underline rounded-lg data-[state=open]:rounded-b-none">
                    <div className="flex items-center gap-3">
                        <History className="h-6 w-6 text-primary"/>
                        <div className="text-left">
                            <h3 className="font-semibold">Recurring Items</h3>
                            <p className="text-sm text-muted-foreground">Manage automatically added items.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 ml-auto">
                        <div className="text-right">
                           <p className="text-sm font-semibold">{formatCurrency(recurringItemsTotal)}</p>
                           <p className="text-xs text-muted-foreground">Monthly Total</p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0">
                    <RecurringClient />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </div>
  );
}
