
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Fragment } from "react";
import { Loader, AlertTriangle, Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { ApprovalRequest } from "@/lib/approvals-mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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

type Department = {
    id: string;
    name: string;
    budgetHeaders?: string[];
    budgetYear?: number;
};

type BudgetItem = {
    id: string;
    departmentId: string;
    category: string;
    forecasts: number[];
    yearTotal: number;
};

export default function ProcurementSummaryPage() {
    const { user, role, department: userDepartment, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const selectedPeriod = useMemo(() => format(selectedDate, "MMMM yyyy"), [selectedDate]);

    // Data fetching
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);
    
    const requestsQuery = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'procurementRequests');
    }, [firestore]);
    const { data: allRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(requestsQuery);

    const budgetsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(collection(firestore, 'budgets'), where('departmentId', '==', selectedDepartmentId));
    }, [firestore, selectedDepartmentId]);
    const { data: budgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);

    // Set default department based on user role and data
    useEffect(() => {
        if (deptsLoading || !departments) return;
        if ((role === 'Manager' || role === 'Requester') && userDepartment) {
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


    const procurementItemsForSummary = useMemo(() => {
        if (!allRequests || !selectedDepartmentId || !selectedPeriod) return [];
        const selectedRequest = allRequests.find(req => req.departmentId === selectedDepartmentId && req.period === selectedPeriod);
        return selectedRequest ? selectedRequest.items : [];
    }, [allRequests, selectedDepartmentId, selectedPeriod]);

    const summaryData = useBudgetSummary(procurementItemsForSummary, selectedDepartmentId, selectedPeriod, budgetItems, departments);
    
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
    const monthForHeader = selectedPeriod.split(' ')[0];

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
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId} disabled={deptsLoading || ((role === 'Manager' || role === 'Requester') && !!userDepartment)}>
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
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !selectedDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "MMMM yyyy") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => {
                                    if (date) setSelectedDate(date)
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            
             {loading ? (
                 <div className="flex h-64 items-center justify-center">
                    <Loader className="h-8 w-8 animate-spin" />
                </div>
             ) : (
                <div className="overflow-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted hover:bg-muted">
                                <TableHead className="font-bold">Procurement Line Items</TableHead>
                                <TableHead className="text-right font-bold">{monthForHeader} Procurement</TableHead>
                                <TableHead className="text-right font-bold">{monthForHeader} Forecast</TableHead>
                                <TableHead className="text-right font-bold">Procurement vs Forecast</TableHead>
                                <TableHead className="font-bold">Comments</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaryData.lines.length > 0 ? summaryData.lines.map((item) => (
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
                                        No data available for the selected department and period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-muted hover:bg-muted font-bold">
                                <TableCell>Subtotal</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(summaryData.totals.procurement)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(summaryData.totals.forecast)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(summaryData.totals.variance)}</TableCell>
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

    


    