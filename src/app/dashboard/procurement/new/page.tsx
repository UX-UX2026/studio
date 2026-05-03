'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef, Fragment } from "react";
import { Loader, History, Check, Save, FilePlus, Info, AlertCircle, ChevronRight, AlertTriangle } from "lucide-react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import type { ApprovalRequest, RecurringItem, BudgetItem, Department, Company, ApprovalItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { SubmissionClient } from "@/components/app/submission-client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { format, addMonths } from "date-fns";
import { useBudgetSummary } from "@/hooks/use-budget-summary";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export default function EnhancedProcurementPage() {
    const { user, profile, role, department: userDepartment, reportingDepartments, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [draftItems, setDraftItems] = useState<ApprovalItem[]>([]);
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Summary drill-down state
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const [openCapitalCategory, setOpenCapitalCategory] = useState<string | null>(null);

    const lastLoadedKey = useRef<string>('');

    // Data fetching
    const departmentsQuery = useMemo(() => firestore ? collection(firestore, 'departments') : null, [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const companiesQuery = useMemo(() => firestore ? collection(firestore, 'companies') : null, [firestore]);
    const { data: companies } = useCollection<Company>(companiesQuery);

    const periodRequestsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId || !selectedPeriod) return null;
        return query(collection(firestore, 'procurementRequests'), where('departmentId', '==', selectedDepartmentId), where('period', '==', selectedPeriod));
    }, [firestore, selectedDepartmentId, selectedPeriod]);
    const { data: periodRequests, loading: periodRequestsLoading } = useCollection<ApprovalRequest>(periodRequestsQuery);

    const budgetsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(collection(firestore, 'budgets'), where('departmentId', '==', selectedDepartmentId));
    }, [firestore, selectedDepartmentId]);
    const { data: budgetItems } = useCollection<BudgetItem>(budgetsQuery);

    const recurringItemsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(collection(firestore, 'recurringItems'), where('active', '==', true), where('departmentId', '==', selectedDepartmentId));
    }, [firestore, selectedDepartmentId]);
    const { data: recurringItems, loading: recurringLoading } = useCollection<RecurringItem>(recurringItemsQuery);

    const departmentName = useMemo(() => {
        if (!departments || !selectedDepartmentId) return 'Unassigned';
        return departments.find(d => d.id === selectedDepartmentId)?.name || 'Unassigned';
    }, [selectedDepartmentId, departments]);

    const associatedCompanies = useMemo(() => {
        if (!selectedDepartmentId || !departments || !companies) return [];
        const dept = departments.find(d => d.id === selectedDepartmentId);
        if (!dept || !dept.companyIds) return [];
        return companies.filter(c => dept.companyIds!.includes(c.id));
    }, [selectedDepartmentId, departments, companies]);

    useEffect(() => {
        if (deptsLoading || !departments) return;
        const deptId = searchParams.get('deptId');
        const period = searchParams.get('period');
        if (deptId && period && departments.some(d => d.id === deptId)) {
            setSelectedDepartmentId(deptId);
            setSelectedPeriod(period);
        }
    }, [searchParams, departments, deptsLoading]);

    const departmentsForUser = useMemo(() => {
        if (!departments) return [];
        if (role === 'Administrator' || role === 'Procurement Officer' || (role === 'Executive' && (!reportingDepartments || reportingDepartments.length === 0))) return departments;
        if (role === 'Executive') return departments.filter(d => d.id && reportingDepartments.includes(d.id));
        if (role === 'Manager' || role === 'Requester') return departments.filter(d => d.name === userDepartment);
        return [];
    }, [departments, role, userDepartment, reportingDepartments]);

    useEffect(() => {
        if (deptsLoading || !departmentsForUser) return;
        if (departmentsForUser.length > 0 && !selectedDepartmentId) setSelectedDepartmentId(departmentsForUser[0].id);
    }, [deptsLoading, departmentsForUser, selectedDepartmentId]);

    const openPeriods = useMemo(() => {
        if (!selectedDepartmentId || !departments) return [];
        const dept = departments.find(d => d.id === selectedDepartmentId);
        const settings = dept?.periodSettings || {};
        const p = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) p.push(format(addMonths(now, i), "MMMM yyyy"));
        const allKnown = new Set(p);
        Object.keys(settings).forEach(pKey => allKnown.add(pKey));
        return Array.from(allKnown).filter(pKey => settings[pKey]?.status === 'Open' || !settings[pKey]).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    }, [selectedDepartmentId, departments]);

    useEffect(() => {
        if (periodRequestsLoading || recurringLoading || !selectedDepartmentId || !selectedPeriod) return;
        const currentKey = `${selectedDepartmentId}-${selectedPeriod}`;
        if (lastLoadedKey.current === currentKey) return;
        
        const existing = periodRequests?.find(req => !['Archived'].includes(req.status));
        const mapRec = (item: RecurringItem): ApprovalItem => ({ 
            id: item.id, 
            type: "Recurring", 
            expenseType: item.expenseType || 'Operational', 
            description: item.name, 
            brand: item.name.split(" ")[0] || '', 
            qty: 1, 
            category: item.category, 
            unitPrice: item.amount, 
            fulfillmentStatus: 'Pending', 
            receivedQty: 0, 
            fulfillmentComments: [] 
        });

        if (existing) {
            setEditingRequestId(existing.id);
            setSelectedCompanyId(existing.companyId || '');
            const existingDescs = new Set(existing.items.map(i => i.description));
            const newRecs = recurringItems?.filter(i => i.active && !existingDescs.has(i.name)).map(mapRec) || [];
            setDraftItems([...existing.items, ...newRecs]);
        } else {
            setEditingRequestId(null);
            setSelectedCompanyId('');
            setDraftItems(recurringItems?.filter(i => i.active).map(mapRec) || []);
        }
        lastLoadedKey.current = currentKey;
    }, [selectedDepartmentId, selectedPeriod, periodRequests, periodRequestsLoading, recurringItems, recurringLoading]);

    const isLocked = useMemo(() => {
        if (!selectedDepartmentId || !selectedPeriod) return true;
        const existing = periodRequests?.find(req => !['Archived'].includes(req.status));
        if (!existing) return false;
        if (['Completed', 'Approved', 'In Fulfillment'].includes(existing.status)) return true;
        if (role === 'Requester' && existing.status === 'Pending Manager Approval') return true;
        return false;
    }, [selectedDepartmentId, selectedPeriod, periodRequests, role]);

    const { operationalSummary, capitalSummary } = useBudgetSummary(draftItems, selectedDepartmentId, selectedPeriod, budgetItems, departments);

    const handleSaveRequest = async (isDraft: boolean) => {
        if (!user || !profile || !selectedDepartmentId || !firestore) return;
        const department = departments?.find(d => d.id === selectedDepartmentId);
        if (!department) return;
        setSaveStatus('saving');
        const actor = `${profile.displayName || user.email} (${role})`;
        const date = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        let status: ApprovalRequest['status'] = isDraft ? 'Draft' : 'Pending Manager Approval';
        
        const timeline: ApprovalRequest['timeline'] = [
            { stage: 'Request Submission', actor, date, status: 'completed' as const }, 
            { stage: 'Manager Review', actor: 'Manager', date: null, status: isDraft ? 'waiting' : 'pending' as const }
        ];

        const base: Partial<ApprovalRequest> = { 
            department: department.name, 
            departmentId: selectedDepartmentId, 
            companyId: selectedCompanyId, 
            companyName: companies?.find(c => c.id === selectedCompanyId)?.name || '',
            period: selectedPeriod, 
            total: draftItems.reduce((a, i) => a + i.qty * i.unitPrice, 0), 
            status, 
            submittedBy: actor, 
            submittedById: user.uid, 
            timeline, 
            items: draftItems, 
            updatedAt: serverTimestamp() as any 
        };

        try {
            if (editingRequestId) { 
                await updateDoc(doc(firestore, 'procurementRequests', editingRequestId), base); 
            } else { 
                const ref = await addDoc(collection(firestore, 'procurementRequests'), { ...base, createdAt: serverTimestamp() as any }); 
                setEditingRequestId(ref.id); 
            }
            setSaveStatus('saved');
            toast({ title: isDraft ? "Draft Saved" : "Submitted Successfully" });
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e: any) { 
            setSaveStatus('idle'); 
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message }); 
        }
    };

    if (userLoading || deptsLoading || recurringLoading || periodRequestsLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    const opProg = operationalSummary.totals.forecast > 0 ? (operationalSummary.totals.procurement / operationalSummary.totals.forecast) * 100 : 0;
    const capProg = capitalSummary.totals.forecast > 0 ? (capitalSummary.totals.procurement / capitalSummary.totals.forecast) * 100 : 0;

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Enhanced Procurement Submission</h1>
                    <p className="text-muted-foreground mt-1">Manage your department's procurement request for the selected period.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => router.push('/dashboard/procurement/history')} className="gap-2">
                        <History className="h-4 w-4" /> History
                    </Button>
                    <Button onClick={() => handleSaveRequest(false)} disabled={saveStatus === 'saving' || isLocked} className="shadow-md">
                        <Check className="mr-2 h-4 w-4" /> Submit Request
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                <div className="xl:col-span-3 space-y-8">
                    <Card className="border-primary/20 shadow-sm overflow-hidden">
                        <div className="h-1 bg-primary w-full" />
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Info className="h-5 w-5 text-primary" /> 1. Submission Details
                            </CardTitle>
                            <CardDescription>Select the department and period you are submitting for.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Department</Label>
                                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                                        <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                        <SelectContent>{departmentsForUser.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Company</Label>
                                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId} disabled={isLocked || associatedCompanies.length === 0}>
                                        <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Select Company" /></SelectTrigger>
                                        <SelectContent>{associatedCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Procurement Period</Label>
                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={!selectedDepartmentId}>
                                        <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Select Period" /></SelectTrigger>
                                        <SelectContent>{openPeriods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <Tabs defaultValue="submission" className="w-full">
                            <CardHeader className="border-b bg-muted/30 pb-0">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <FilePlus className="h-5 w-5 text-primary" /> 2. Items & Budget Impact
                                        </CardTitle>
                                        <CardDescription>Review items and their specific impact on each budget line.</CardDescription>
                                    </div>
                                    <TabsList>
                                        <TabsTrigger value="submission">Line Items</TabsTrigger>
                                        <TabsTrigger value="summary">Budget Impact</TabsTrigger>
                                    </TabsList>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <TabsContent value="submission" className="m-0 p-6">
                                    <SubmissionClient 
                                        user={user!} 
                                        profile={profile} 
                                        userRole={role!} 
                                        items={draftItems} 
                                        setItems={setDraftItems} 
                                        isLocked={isLocked} 
                                        recurringItems={recurringItems} 
                                        recurringLoading={recurringLoading} 
                                        departmentId={selectedDepartmentId} 
                                        departmentName={departmentName} 
                                        budgetItems={budgetItems} 
                                    />
                                </TabsContent>
                                <TabsContent value="summary" className="m-0 p-6 space-y-8">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            Operational Budget Breakdown
                                            {operationalSummary.totals.variance > 0 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                                        </h3>
                                        <div className="overflow-auto rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted hover:bg-muted">
                                                        <TableHead className="font-bold">Category</TableHead>
                                                        <TableHead className="text-right font-bold">Request</TableHead>
                                                        <TableHead className="text-right font-bold">Forecast</TableHead>
                                                        <TableHead className="text-right font-bold">Variance</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {operationalSummary.lines.map((line) => (
                                                        <Fragment key={line.category}>
                                                            <TableRow 
                                                                className={cn("cursor-pointer", line.isOverBudget && "bg-red-50 dark:bg-red-900/20")}
                                                                onClick={() => setOpenCategory(openCategory === line.category ? null : line.category)}
                                                            >
                                                                <TableCell className="font-medium flex items-center gap-2">
                                                                    <ChevronRight className={cn("h-4 w-4 transition-transform", openCategory === line.category && "rotate-90")} />
                                                                    {line.category}
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono">{formatCurrency(line.procurementTotal)}</TableCell>
                                                                <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(line.forecastTotal)}</TableCell>
                                                                <TableCell className={cn("text-right font-mono font-bold", line.isOverBudget ? "text-red-600" : "text-green-600")}>
                                                                    {formatCurrency(line.variance)}
                                                                </TableCell>
                                                            </TableRow>
                                                            {openCategory === line.category && (
                                                                <TableRow className="bg-muted/30">
                                                                    <TableCell colSpan={4} className="p-4">
                                                                        <div className="rounded-md border bg-background overflow-hidden">
                                                                            <Table>
                                                                                <TableHeader>
                                                                                    <TableRow className="text-[10px] uppercase tracking-wider bg-muted/20">
                                                                                        <TableHead>Item Description</TableHead>
                                                                                        <TableHead className="text-center">Qty</TableHead>
                                                                                        <TableHead className="text-right">Price</TableHead>
                                                                                        <TableHead className="text-right">Total</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {line.items.map(subItem => (
                                                                                        <TableRow key={subItem.id} className="text-xs">
                                                                                            <TableCell>{subItem.description}</TableCell>
                                                                                            <TableCell className="text-center">{subItem.qty}</TableCell>
                                                                                            <TableCell className="text-right">{formatCurrency(subItem.unitPrice)}</TableCell>
                                                                                            <TableCell className="text-right font-bold">{formatCurrency(subItem.unitPrice * subItem.qty)}</TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </Fragment>
                                                    ))}
                                                </TableBody>
                                                <TableFooter>
                                                    <TableRow className="bg-muted/50 font-bold">
                                                        <TableCell>Operational Subtotal</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(operationalSummary.totals.procurement)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(operationalSummary.totals.forecast)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(operationalSummary.totals.variance)}</TableCell>
                                                    </TableRow>
                                                </TableFooter>
                                            </Table>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t">
                                        <h3 className="text-lg font-bold">Capital Budget Breakdown</h3>
                                        <div className="overflow-auto rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted hover:bg-muted">
                                                        <TableHead className="font-bold">Category</TableHead>
                                                        <TableHead className="text-right font-bold">Request</TableHead>
                                                        <TableHead className="text-right font-bold">Forecast</TableHead>
                                                        <TableHead className="text-right font-bold">Variance</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {capitalSummary.lines.length > 0 ? capitalSummary.lines.map((line) => (
                                                        <Fragment key={line.category}>
                                                            <TableRow 
                                                                className={cn("cursor-pointer", line.isOverBudget && "bg-red-50 dark:bg-red-900/20")}
                                                                onClick={() => setOpenCapitalCategory(openCapitalCategory === line.category ? null : line.category)}
                                                            >
                                                                <TableCell className="font-medium flex items-center gap-2">
                                                                    <ChevronRight className={cn("h-4 w-4 transition-transform", openCapitalCategory === line.category && "rotate-90")} />
                                                                    {line.category}
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono">{formatCurrency(line.procurementTotal)}</TableCell>
                                                                <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(line.forecastTotal)}</TableCell>
                                                                <TableCell className={cn("text-right font-mono font-bold", line.isOverBudget ? "text-red-600" : "text-green-600")}>
                                                                    {formatCurrency(line.variance)}
                                                                </TableCell>
                                                            </TableRow>
                                                            {openCapitalCategory === line.category && (
                                                                <TableRow className="bg-muted/30">
                                                                    <TableCell colSpan={4} className="p-4">
                                                                        <div className="rounded-md border bg-background overflow-hidden">
                                                                            <Table>
                                                                                <TableHeader>
                                                                                    <TableRow className="text-[10px] uppercase tracking-wider bg-muted/20">
                                                                                        <TableHead>Item Description</TableHead>
                                                                                        <TableHead className="text-center">Qty</TableHead>
                                                                                        <TableHead className="text-right">Price</TableHead>
                                                                                        <TableHead className="text-right">Total</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {line.items.map(subItem => (
                                                                                        <TableRow key={subItem.id} className="text-xs">
                                                                                            <TableCell>{subItem.description}</TableCell>
                                                                                            <TableCell className="text-center">{subItem.qty}</TableCell>
                                                                                            <TableCell className="text-right">{formatCurrency(subItem.unitPrice)}</TableCell>
                                                                                            <TableCell className="text-right font-bold">{formatCurrency(subItem.unitPrice * subItem.qty)}</TableCell>
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
                                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">No capital items in this submission.</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                                <TableFooter>
                                                    <TableRow className="bg-muted/50 font-bold">
                                                        <TableCell>Capital Subtotal</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(capitalSummary.totals.procurement)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(capitalSummary.totals.forecast)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(capitalSummary.totals.variance)}</TableCell>
                                                    </TableRow>
                                                </TableFooter>
                                            </Table>
                                        </div>
                                    </div>
                                </TabsContent>
                            </CardContent>
                        </Tabs>
                        <CardFooter className="bg-muted/30 border-t py-4 justify-between">
                            <p className="text-sm text-muted-foreground italic">Tip: Use the "Budget Impact" tab to see category-specific drill-downs.</p>
                            <Button variant="ghost" size="sm" onClick={() => handleSaveRequest(true)} disabled={saveStatus === 'saving' || isLocked} className="gap-2">
                                {saveStatus === 'saving' ? <Loader className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                                Save Progress
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <div className="xl:col-span-1 space-y-6">
                    <Card className="sticky top-20 shadow-md border-primary/10">
                        <CardHeader className="pb-2 border-b">
                            <CardTitle className="text-lg">Budget Summary</CardTitle>
                            <CardDescription>Live totals for {selectedPeriod || 'selected period'}</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-8">
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Operational</Label>
                                    <div className="text-right">
                                        <p className="text-xl font-bold">{formatCurrency(operationalSummary.totals.procurement)}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Forecast: {formatCurrency(operationalSummary.totals.forecast)}</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Progress value={opProg} className={cn("h-2", opProg > 100 ? "bg-red-100" : "")} />
                                    <div className="flex justify-between text-[10px]">
                                        <span className={cn("font-bold", opProg > 100 ? "text-red-500" : "text-primary")}>{Math.round(opProg)}% of budget</span>
                                        <span className={cn("font-medium", (operationalSummary.totals.variance < 0) ? "text-green-600" : "text-red-600")}>
                                            {operationalSummary.totals.variance > 0 ? `Over by ${formatCurrency(operationalSummary.totals.variance)}` : `Remaining: ${formatCurrency(Math.abs(operationalSummary.totals.variance))}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Capital</Label>
                                    <div className="text-right">
                                        <p className="text-xl font-bold">{formatCurrency(capitalSummary.totals.procurement)}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Forecast: {formatCurrency(capitalSummary.totals.forecast)}</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Progress value={capProg} className={cn("h-2", capProg > 100 ? "bg-red-100" : "")} />
                                    <div className="flex justify-between text-[10px]">
                                        <span className={cn("font-bold", capProg > 100 ? "text-red-500" : "text-primary")}>{Math.round(capProg)}% of budget</span>
                                        <span className={cn("font-medium", (capitalSummary.totals.variance < 0) ? "text-green-600" : "text-red-600")}>
                                            {capitalSummary.totals.variance > 0 ? `Over by ${formatCurrency(capitalSummary.totals.variance)}` : `Remaining: ${formatCurrency(Math.abs(capitalSummary.totals.variance))}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <div className="flex justify-between items-center">
                                    <Label className="text-sm font-bold uppercase">Grand Total</Label>
                                    <p className="text-2xl font-black text-primary">{formatCurrency(operationalSummary.totals.procurement + capitalSummary.totals.procurement)}</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/20 flex flex-col items-stretch gap-2 pt-4">
                            <Button className="w-full" onClick={() => handleSaveRequest(false)} disabled={saveStatus === 'saving' || isLocked}>
                                {saveStatus === 'saving' && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                                <Check className="mr-2 h-4 w-4" /> Confirm & Submit
                            </Button>
                            <p className="text-[10px] text-center text-muted-foreground">Submit for Review by Manager</p>
                        </CardFooter>
                    </Card>

                    {operationalSummary.totals.variance > 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 text-red-800">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <div className="text-xs">
                                <p className="font-bold">Over Budget Warning</p>
                                <p className="mt-1 opacity-90">This submission exceeds your operational forecast. Please ensure you have added justifications in the item comments.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
