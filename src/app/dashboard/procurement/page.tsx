
'use client';

import { useUser, type UserRole } from "@/firebase/auth/use-user";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader, AlertTriangle, Globe, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import type { ApprovalRequest } from "@/lib/approvals-mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SubmissionClient } from "@/components/app/submission-client";
import { useToast } from "@/hooks/use-toast";
import { logErrorToFirestore } from "@/lib/error-logger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    budgetYear?: number;
    periodSettings?: {
        [period: string]: {
            status: 'Open' | 'Locked';
        }
    }
};

type AppMetadata = {
    id: string;
    adminIsSetUp?: boolean;
    limitToOneSubmissionPerPeriod?: boolean;
}

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
    const searchParams = useSearchParams();
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    
    const [draftItems, setDraftItems] = useState<Item[]>([]);
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [openPeriods, setOpenPeriods] = useState<string[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);

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
    
    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);

    // Handle incoming query params to resume a draft
    useEffect(() => {
        const deptId = searchParams.get('deptId');
        const period = searchParams.get('period');

        if (deptId && period) {
            // Check if this is a valid department before setting
            if (departments?.some(d => d.id === deptId)) {
                setSelectedDepartmentId(deptId);
                setSelectedPeriod(period);
                // Clear the search params so a refresh doesn't keep reloading it
                router.replace('/dashboard/procurement', { scroll: false });
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, departments]);

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

    // Update the list of open periods when the department changes
    useEffect(() => {
        if (selectedDepartmentId && departments) {
            const dept = departments.find(d => d.id === selectedDepartmentId);
            if (dept && dept.periodSettings) {
                const periods = Object.entries(dept.periodSettings)
                    .filter(([, settings]) => settings.status === 'Open')
                    .map(([period]) => period);
                setOpenPeriods(periods);
                
                // If the previously selected period isn't open for the new dept, reset it
                if (!periods.includes(selectedPeriod)) {
                    setSelectedPeriod(periods[0] || '');
                }
            } else {
                setOpenPeriods([]);
                setSelectedPeriod('');
            }
        }
    }, [selectedDepartmentId, departments, selectedPeriod]);

    // Effect to initialize or load a draft, now with logic to sync recurring items.
    useEffect(() => {
        if (requestsLoading || recurringLoading || !selectedDepartmentId || !selectedPeriod) {
            if (!selectedPeriod) setDraftItems([]);
            return;
        };

        const existingRequest = allRequests?.find(req => req.departmentId === selectedDepartmentId && req.period === selectedPeriod);

        // Prepare a function to convert master recurring items to submission items
        const mapRecurringToSubmissionItem = (item: RecurringItem): Item => ({
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
        });

        if (existingRequest) {
            // A draft or submitted request exists. Load its items...
            const savedItems = existingRequest.items;
            setEditingRequestId(existingRequest.id);

            // ...and also add any NEW recurring items from the master list that are not already present.
            const savedItemDescriptions = new Set(savedItems.map(i => i.description));
            const newRecurringItems = recurringItems
                ?.filter(masterItem => masterItem.active && !savedItemDescriptions.has(masterItem.name))
                .map(mapRecurringToSubmissionItem) || [];

            setDraftItems([...savedItems, ...newRecurringItems]);

        } else {
            // This is a brand new submission for the period.
            setEditingRequestId(null);
            // Start with all active recurring items from the master list.
            const initialItems = recurringItems
                ?.filter(item => item.active)
                .map(mapRecurringToSubmissionItem) || [];
            setDraftItems(initialItems);
        }
    }, [selectedDepartmentId, selectedPeriod, allRequests, requestsLoading, recurringItems, recurringLoading]);

    const departmentName = useMemo(() => departments?.find(d => d.id === selectedDepartmentId)?.name || '', [selectedDepartmentId, departments]);

    const isLockedByWorkflow = useMemo(() => {
        if (!selectedDepartmentId || !selectedPeriod) return false;
        const periodStatusInfo = allRequests?.find(req => req.departmentId === selectedDepartmentId && req.period === selectedPeriod);

        if (!periodStatusInfo) return false;

        const { status } = periodStatusInfo;
        
        if (status === 'Completed' || status === 'Pending Executive' || status === 'Approved' || status === 'In Fulfillment') {
            return true;
        }
        if (role === 'Requester' && (status === 'Pending Manager Approval' || status === 'Pending Executive')) {
            return true;
        }
        if (role === 'Manager' && status === 'Pending Executive') {
            return true;
        }

        return false;
    }, [selectedDepartmentId, selectedPeriod, allRequests, role]);

    const isLocked = isLockedByWorkflow || !selectedPeriod;

    const summaryData = useMemo(() => {
        const procurementItems = draftItems;
        
        if (!selectedDepartmentId || !selectedPeriod || !budgetItems || !departments) {
            return { lines: [], totals: { procurement: 0, forecast: 0, variance: 0 } };
        }

        const selectedDept = departments.find(d => d.id === selectedDepartmentId);
        const procurementYear = new Date(selectedPeriod).getFullYear();
        
        const monthName = selectedPeriod.split(' ')[0];
        const monthIndex = (selectedDept?.budgetYear === procurementYear)
            ? selectedDept?.budgetHeaders?.findIndex(h => h.toLowerCase().startsWith(monthName.toLowerCase().substring(0,3))) ?? -1
            : -1;

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
    
    const userDrafts = useMemo(() => {
        if (!allRequests || !user) return [];
        return allRequests
            .filter(req => req.status === 'Draft' && req.submittedById === user.uid)
            .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
    }, [allRequests, user]);

    const handleRequestEdit = () => {
        toast({
          title: "Edit Request Sent",
          description: "Your manager has been notified of your request to edit this submission. This is a placeholder action.",
        });
    };

    const handleSaveRequest = async (isDraft: boolean) => {
        if (!user || !departmentName || !selectedDepartmentId || !firestore) {
            toast({ variant: "destructive", title: "Cannot save", description: "User or department information is missing." });
            return;
        }

        const activePipelineRequest = allRequests?.find(req => 
            req.departmentId === selectedDepartmentId && 
            req.period === selectedPeriod &&
            req.id !== editingRequestId &&
            !['Draft', 'Completed', 'Rejected', 'Queries Raised', 'Archived'].includes(req.status)
        );

        if (appMetadata?.limitToOneSubmissionPerPeriod && role !== 'Administrator' && activePipelineRequest) {
            toast({
                variant: "destructive",
                title: "Active Submission Exists",
                description: "A request for this period is already in the approval process. You cannot submit another while the submission limit is active.",
            });
            return;
        }

        setIsSaving(true);
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

        const baseRequestData = {
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
            updatedAt: serverTimestamp(),
        };

        const action = isDraft ? 'request.draft_save' : 'request.submit';
        
        toast({ 
            title: isDraft ? "Saving Draft..." : "Submitting Request...",
            description: "Please wait.",
        });

        try {
            let docId: string;
            if (editingRequestId) {
                const docRef = doc(firestore, 'procurementRequests', editingRequestId);
                await updateDoc(docRef, baseRequestData);
                docId = editingRequestId;
            } else {
                const docRef = await addDoc(collection(firestore, 'procurementRequests'), {
                    ...baseRequestData,
                    createdAt: serverTimestamp()
                });
                docId = docRef.id;
            }

            if (!editingRequestId && docId) {
                setEditingRequestId(docId); // Start tracking the new draft's ID
            }
            toast({ 
                title: isDraft ? "Draft Saved" : "Request Submitted", 
                description: `Your procurement request for ${selectedPeriod} has been successfully ${isDraft ? 'saved' : 'submitted'}.` 
            });

            const auditLogData = {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `${isDraft ? (editingRequestId ? 'Updated draft' : 'Created draft') : 'Submitted request'} for ${selectedPeriod}.`,
                entity: { type: 'procurementRequest', id: docId },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
        } catch (error: any) {
            console.error("Save Request Error:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save your request. Check your connection.',
            });
            await logErrorToFirestore({
                userId: user.uid,
                userName: user.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteDraft = async () => {
        if (!deletingRequestId || !user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not archive draft.' });
            return;
        }

        const draftToArchive = allRequests?.find(req => req.id === deletingRequestId);
        if (!draftToArchive) return;

        const action = 'request.draft_archive';
        try {
            const docRef = doc(firestore, 'procurementRequests', deletingRequestId);
            await updateDoc(docRef, { status: 'Archived', updatedAt: serverTimestamp() });
            
            toast({ title: 'Draft Archived', description: 'The draft has been moved to the recycle bin.' });

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Archived draft for ${draftToArchive.period}`,
                entity: { type: 'procurementRequest', id: deletingRequestId },
                timestamp: serverTimestamp()
            });

            // If the deleted draft was the one being edited, clear the form
            if (editingRequestId === deletingRequestId) {
                setEditingRequestId(null);
                setDraftItems([]);
            }
        } catch (error: any) {
            console.error("Archive Draft Error:", error);
            toast({ variant: 'destructive', title: 'Archive Failed', description: error.message });
            await logErrorToFirestore({
                userId: user.uid,
                userName: user.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack
            });
        } finally {
            setDeletingRequestId(null);
            setIsDeleteDialogOpen(false);
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

    const loading = userLoading || requestsLoading || deptsLoading || budgetsLoading || recurringLoading || metadataLoading;
    const monthForHeader = selectedPeriod.split(' ')[0];

    const budgetProgress = useMemo(() => {
        const { procurement, forecast } = summaryData.totals;
        if (forecast === 0) return procurement > 0 ? 100 : 0;
        return Math.min(Math.round((procurement / forecast) * 100), 100);
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
                        A consolidated view for managing your procurement request. Select a department and an open period to begin.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
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
                             <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={!selectedDepartmentId}>
                                <SelectTrigger id="period">
                                    <SelectValue placeholder="Select an open period..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {openPeriods.length > 0 ? (
                                        openPeriods.map(period => <SelectItem key={period} value={period}>{period}</SelectItem>)
                                    ) : (
                                        <div className="p-4 text-sm text-muted-foreground">No open periods found for this department.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {userDrafts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Your Draft Submissions</CardTitle>
                        <CardDescription>Resume editing or archive your saved drafts for other periods.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Period</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Last Saved</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {userDrafts.map(draft => (
                                        <TableRow key={draft.id}>
                                            <TableCell>{draft.department}</TableCell>
                                            <TableCell>{draft.period}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(draft.total)}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{draft.updatedAt ? formatDistanceToNow(new Date(draft.updatedAt.seconds * 1000), { addSuffix: true }) : 'N/A'}</TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="outline" size="sm" onClick={() => {
                                                    setSelectedDepartmentId(draft.departmentId);
                                                    setSelectedPeriod(draft.period);
                                                }}>Resume</Button>
                                                <Button variant="destructive" size="icon" onClick={() => { setDeletingRequestId(draft.id); setIsDeleteDialogOpen(true); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <Tabs defaultValue="submission" className="w-full">
                    <CardHeader className="flex flex-row items-start justify-between">
                         <div>
                            <CardTitle>Period Submission</CardTitle>
                            <CardDescription>Manage line items and compare against the budget forecast for this period.</CardDescription>
                         </div>
                         <TabsList className="grid grid-cols-2">
                            <TabsTrigger value="submission">Submission Items</TabsTrigger>
                            <TabsTrigger value="summary">Budget Summary</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <CardContent>
                        <TabsContent value="submission">
                            <SubmissionClient 
                                userRole={role} 
                                items={draftItems}
                                setItems={setDraftItems}
                                isLocked={isLocked}
                                recurringItems={recurringItems}
                                recurringLoading={recurringLoading}
                            />
                        </TabsContent>
                        <TabsContent value="summary">
                            <div className="space-y-4">
                                <div className="p-4 border rounded-lg bg-muted/50">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="font-semibold text-lg">Budget vs. Actuals: {monthForHeader}</h3>
                                            <p className="text-sm text-muted-foreground">This is a live comparison of your draft items against the forecast.</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold">{formatCurrency(summaryData.totals.procurement)}</p>
                                            <p className="text-sm text-muted-foreground">vs forecast of {formatCurrency(summaryData.totals.forecast)}</p>
                                        </div>
                                    </div>
                                    <Progress value={budgetProgress} className="mt-4" />
                                </div>
                                <div className="overflow-auto rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted hover:bg-muted">
                                                <TableHead className="font-bold">Category</TableHead>
                                                <TableHead className="text-right font-bold">Procurement Total</TableHead>
                                                <TableHead className="text-right font-bold">Forecast Total</TableHead>
                                                <TableHead className="text-right font-bold">Variance</TableHead>
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
                                                        No budget or submission data available.
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
                            </div>
                        </TabsContent>
                    </CardContent>
                </Tabs>
                <CardFooter className="flex justify-between items-center border-t pt-6">
                    {isLocked ? (
                        <div className="flex items-center gap-3 text-yellow-800">
                             <Globe className="h-5 w-5"/>
                            <div className="text-sm font-medium">
                                <p>{isLockedByWorkflow ? "This submission is locked as it is already in the approval pipeline." : "Select an open period to begin."}</p>
                            </div>
                        </div>
                    ) : (
                        <span className='text-sm text-muted-foreground'>Ready to proceed?</span>
                    )}
                    <div className="flex gap-3">
                        {isLockedByWorkflow ? (
                            <Button onClick={handleRequestEdit}>Request Edit</Button>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => handleSaveRequest(true)} disabled={isSaving || isLocked}>
                                    {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Save as Draft
                                </Button>
                                <Button className="shadow-lg shadow-primary/20" onClick={() => handleSaveRequest(false)} disabled={isSaving || isLocked}>
                                    {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Submit For Approval
                                </Button>
                            </>
                        )}
                    </div>
                </CardFooter>
            </Card>

             <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Archive this draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This will move the draft to the recycle bin. You can restore it later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingRequestId(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteDraft}>Archive</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
