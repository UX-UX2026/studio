
'use client';

import { useUser, type UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader, AlertTriangle, Briefcase, FileText, History, BarChart, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, setDoc } from "firebase/firestore";
import type { ApprovalRequest } from "@/lib/approvals-mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { SubmissionClient } from "@/components/app/submission-client";
import { RecurringClient } from "@/components/app/recurring-client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { logErrorToFirestore } from "@/lib/error-logger";

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
    workflow?: WorkflowStage[];
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

// Item type is now managed by the parent component
type Item = {
  id: number | string;
  type: "Recurring" | "One-Off";
  description: string;
  brand: string;
  qty: number;
  category: string;
  unitPrice: number;
  fulfillmentStatus: 'Pending' | 'Sourcing' | 'Quoted' | 'Ordered' | 'Completed';
  receivedQty: number;
  fulfillmentComments: string[];
  comments?: string;
};

type WorkflowStage = {
    id: string;
    name: string;
    role: any;
    permissions: string[];
};


export default function ProcurementQuickSubmitPage() {
    const { user, role, department: userDepartment, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date(new Date().getFullYear() + 2, 1, 1));
    const selectedPeriod = useMemo(() => format(selectedDate, "MMMM yyyy"), [selectedDate]);
    
    // State for draft items is lifted up to this parent component
    const [draftItems, setDraftItems] = useState<Item[]>([]);
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);


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
        if (!selectedDepartmentId && departments.length > 0) {
            setSelectedDepartmentId(departments[0].id);
        }
    }, [role, userDepartment, departments, deptsLoading, selectedDepartmentId]);

    // Effect to initialize or load a draft
    useEffect(() => {
        if (requestsLoading || recurringLoading) return;

        const existingRequest = allRequests?.find(req => req.departmentId === selectedDepartmentId && req.period === selectedPeriod);

        if (existingRequest) {
            setDraftItems(existingRequest.items);
            setEditingRequestId(existingRequest.id);
        } else {
            setEditingRequestId(null);
            const recurringSubmissionItems: Item[] = recurringItems?.map(item => ({
                id: item.id,
                type: "Recurring",
                description: item.name,
                brand: item.name.split(" ")[0] || '',
                qty: 1,
                category: item.category,
                unitPrice: item.amount,
                fulfillmentStatus: 'Pending',
                receivedQty: 0,
                fulfillmentComments: [],
            })) || [];
            setDraftItems(recurringSubmissionItems);
        }
    }, [selectedDepartmentId, selectedPeriod, allRequests, requestsLoading, recurringItems, recurringLoading]);

    const departmentName = useMemo(() => departments?.find(d => d.id === selectedDepartmentId)?.name || '', [selectedDepartmentId, departments]);

    // This is the LIVE total for the accordion trigger, based on the current draft
    const periodSubmissionTotal = useMemo(() => {
        return draftItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);
    }, [draftItems]);

    // This summary now uses the live draftItems state
    const summaryData = useMemo(() => {
        const procurementItems = draftItems;
        
        if (!selectedDepartmentId || !selectedPeriod || !budgetItems) {
            return { lines: [], totals: { procurement: 0, forecast: 0, variance: 0 } };
        }

        const selectedDept = departments?.find(d => d.id === selectedDepartmentId);
        
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
            const isOverBudget = procurementTotal > forecastTotal;

            const comments = procurementItems
                .filter(item => item.category === category && item.comments)
                .map(item => item.comments)
                .join('; ');


            return { category, procurementTotal, forecastTotal, variance, isOverBudget, comments };
        }).filter(Boolean) as { category: string; procurementTotal: number; forecastTotal: number; variance: number; isOverBudget: boolean; comments: string; }[];
        
        const totals = lines.reduce((acc, line) => {
            acc.procurement += line.procurementTotal;
            acc.forecast += line.forecastTotal;
            acc.variance += line.variance;
            return acc;
        }, { procurement: 0, forecast: 0, variance: 0 });

        return { lines, totals };

    }, [draftItems, selectedDepartmentId, selectedPeriod, budgetItems, departments]);

    const recurringItemsTotal = useMemo(() => {
        if (!recurringItems) return 0;
        return recurringItems.reduce((sum, item) => sum + item.amount, 0);
    }, [recurringItems]);

    const handleSaveRequest = async (isDraft: boolean) => {
        if (!user || !departmentName || !selectedDepartmentId || !firestore) {
            toast({ variant: "destructive", title: "Cannot save", description: "User or department information is missing." });
            return;
        }

        const activePipelineRequest = allRequests?.find(req => 
            req.departmentId === selectedDepartmentId && 
            req.period === selectedPeriod &&
            req.id !== editingRequestId &&
            !['Draft', 'Completed', 'Rejected', 'Queries Raised'].includes(req.status)
        );

        if (role !== 'Administrator' && activePipelineRequest) {
            toast({
                variant: "destructive",
                title: "Active Submission Exists",
                description: "A request for this period is already in the approval process. You cannot submit another.",
            });
            return;
        }

        const newStatus = isDraft ? 'Draft' : 'Pending Manager Approval';
        const submissionTotal = draftItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);
        
        const departmentWorkflow = departments?.find(d => d.id === selectedDepartmentId)?.workflow;
        
        const defaultTimeline = [
            { stage: "Request Submission", actor: user.displayName || 'Requester', date: new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }), status: 'completed' as const },
            { stage: "Manager Review", actor: "Manager", date: null, status: newStatus === 'Draft' ? 'waiting' : ('pending' as const) },
            { stage: "Executive Review", actor: "Executive", date: null, status: 'waiting' as const },
            { stage: "Procurement Ack.", actor: "Procurement", date: null, status: 'waiting' as const },
        ];
        
        const timeline = departmentWorkflow && departmentWorkflow.length > 0
          ? departmentWorkflow.map((stage, index) => ({
              stage: stage.name,
              actor: String(stage.role) || 'System',
              date: index === 0 ? new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : null,
              status: index === 0 ? 'completed' as const : (index === 1 && !isDraft ? 'pending' as const : 'waiting' as const),
          }))
          : defaultTimeline;
        
        if (timeline.length > 0) {
            timeline[0].actor = user.displayName || 'Requester';
            if(isDraft) {
                for (let i = 1; i < timeline.length; i++) {
                    timeline[i].status = 'waiting';
                }
            }
        }

        const requestData = {
            department: departmentName,
            departmentId: selectedDepartmentId,
            period: selectedPeriod,
            total: submissionTotal,
            status: newStatus,
            submittedBy: user.displayName,
            submittedById: user.uid,
            timeline: timeline,
            comments: editingRequestId ? allRequests?.find(r => r.id === editingRequestId)?.comments || [] : [],
            items: draftItems,
        };

        const action = isDraft ? 'request.draft_save' : 'request.submit';
        
        toast({ 
            title: isDraft ? "Saving Draft..." : "Submitting Request...",
            description: "Please wait.",
        });

        try {
            let docId: string;
            if (editingRequestId) {
                await setDoc(doc(firestore, 'procurementRequests', editingRequestId), requestData, { merge: true });
                docId = editingRequestId;
            } else {
                const docRef = await addDoc(collection(firestore, 'procurementRequests'), { ...requestData, createdAt: serverTimestamp() });
                docId = docRef.id;
            }

            if (!editingRequestId && docId) {
                setEditingRequestId(docId); // Start tracking the new draft's ID
            }
            toast({ 
                title: isDraft ? "Draft Saved" : "Request Submitted", 
                description: `Your procurement request for ${selectedPeriod} has been successfully ${isDraft ? 'saved' : 'submitted'}.` 
            });

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `${isDraft ? (editingRequestId ? 'Updated draft' : 'Created draft') : 'Submitted request'} for ${selectedPeriod}.`,
                entity: { type: 'procurementRequest', id: docId },
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Save Request Error:", error);
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: error.message || "Could not save the request. You may not have permissions.",
            });
            await logErrorToFirestore({
                userId: user.uid,
                userName: user.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        }
    };
    
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
                                        if(date) setSelectedDate(date)
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
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
                                    <TableHead className="font-bold">Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summaryData.lines.length > 0 ? summaryData.lines.map((item) => (
                                    <TableRow key={item.category} className={cn(item.isOverBudget && "bg-red-50 dark:bg-red-900/20")}>
                                        <TableCell className="font-medium">{item.category}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(item.procurementTotal)}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(item.forecastTotal)}</TableCell>
                                        <TableCell className={cn("text-right font-mono font-semibold", item.isOverBudget && "text-red-500 flex items-center justify-end gap-2")}>
                                            {item.isOverBudget && <AlertTriangle className="h-4 w-4" />}
                                            {formatCurrency(item.variance)}
                                        </TableCell>
                                         <TableCell className="text-xs text-muted-foreground">{item.comments}</TableCell>
                                    </TableRow>
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
                    <SubmissionClient 
                        userRole={role} 
                        items={draftItems}
                        setItems={setDraftItems}
                        selectedPeriod={selectedPeriod}
                        onSaveDraft={() => handleSaveRequest(true)}
                        onSubmitRequest={() => handleSaveRequest(false)}
                        allRequests={allRequests || []}
                    />
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
