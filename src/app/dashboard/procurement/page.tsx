'use client';

import { useUser } from "@/firebase/auth/use-user";
import type { UserProfile } from '@/context/authentication-provider';
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import { Loader, AlertTriangle, Globe, Trash2, History, Check, ChevronDown, Bell, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc, orderBy, getDoc, arrayUnion } from "firebase/firestore";
import type { ApprovalRequest, RecurringItem, BudgetItem, Department, Company, AppMetadata, ApprovalItem } from "@/types";
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
import { format, addMonths } from "date-fns";
import { useBudgetSummary } from "@/hooks/use-budget-summary";
import { RecurringClient } from "@/components/app/recurring-client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { submissionReadyForReviewTemplate } from "@/lib/email-templates";
import { procurementCategories } from "@/lib/procurement-categories";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export default function ProcurementQuickSubmitPage() {
    const { user, profile, role, department: userDepartment, departmentId: userDepartmentId, reportingDepartments, loading: userLoading } = useUser();
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
    const [lastAction, setLastAction] = useState<'draft' | 'submit' | null>(null);
    const [openPeriods, setOpenPeriods] = useState<string[]>([]);
    const [isNotifying, setIsNotifying] = useState(false);

    const [isRequestEditDialogOpen, setIsRequestEditDialogOpen] = useState(false);
    const [editRequestReason, setEditRequestReason] = useState('');

    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [previousSubmissionToLoad, setPreviousSubmissionToLoad] = useState<string | null>(null);
    const [isLoadConfirmDialogOpen, setIsLoadConfirmDialogOpen] = useState(false);

    const [isArchiveCurrentDialogOpen, setIsArchiveCurrentDialogOpen] = useState(false);
    const [archiveReason, setArchiveReason] = useState('');

    const lastLoadedKey = useRef<string>('');

    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const companiesQuery = useMemo(() => collection(firestore, 'companies'), [firestore]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);
    
    const allDraftsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'procurementRequests'), where('status', '==', 'Draft'));
    }, [firestore]);
    const { data: allDrafts } = useCollection<ApprovalRequest>(allDraftsQuery);

    const userDrafts = useMemo(() => {
        if (!user || !allDrafts) return [];
        let draftsForUser: ApprovalRequest[];
        if (role === 'Manager' && userDepartment) {
            draftsForUser = allDrafts.filter(draft => draft.department === userDepartment);
        } else if (role === 'Administrator' || role === 'Executive' || role === 'Procurement Officer') {
            draftsForUser = allDrafts;
        } else {
            draftsForUser = allDrafts.filter(draft => draft.submittedById === user.uid);
        }
        return draftsForUser
            .filter(draft => draft.id !== editingRequestId)
            .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
    }, [user, allDrafts, editingRequestId, role, userDepartment]);

    const periodRequestsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId || !selectedPeriod) return null;
        return query(
            collection(firestore, 'procurementRequests'),
            where('departmentId', '==', selectedDepartmentId),
            where('period', '==', selectedPeriod)
        );
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
    
    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata } = useDoc<AppMetadata>(appMetadataRef);

    const previousSubmissionsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(
            collection(firestore, 'procurementRequests'),
            where('departmentId', '==', selectedDepartmentId),
            where('status', 'in', ['Completed', 'Approved', 'In Fulfillment']),
            orderBy('updatedAt', 'desc')
        );
    }, [firestore, selectedDepartmentId]);
    const { data: previousSubmissions } = useCollection<ApprovalRequest>(previousSubmissionsQuery);

    const associatedCompanies = useMemo(() => {
        if (!selectedDepartmentId || !departments || !companies) return [];
        const dept = departments.find(d => d.id === selectedDepartmentId);
        if (!dept || !dept.companyIds) return [];
        return companies.filter(c => dept.companyIds!.includes(c.id));
    }, [selectedDepartmentId, departments, companies]);
    
    const activeRequest = useMemo(() => {
        if (!editingRequestId || !periodRequests) return null;
        return periodRequests.find(req => req.id === editingRequestId);
    }, [editingRequestId, periodRequests]);

    const canApproveOrReject = useMemo(() => {
        if (role !== 'Executive' && role !== 'Administrator') return false;
        if (!activeRequest) return false;
        return ['Pending Manager Approval', 'Pending Executive', 'Queries Raised'].includes(activeRequest.status);
    }, [role, activeRequest]);

    const departmentCategories = useMemo(() => {
        const categoriesFromBudget = budgetItems?.map(item => item.category).filter(Boolean) || [];
        const categoriesFromCurrentItems = draftItems.map(item => item.category).filter(Boolean);
        const combined = new Set([...categoriesFromBudget, ...categoriesFromCurrentItems, ...procurementCategories]);
        if (!combined.has('Uncategorized')) combined.add('Uncategorized');
        return Array.from(combined).sort();
    }, [budgetItems, draftItems]);

    useEffect(() => {
        if (deptsLoading || !departments) return;
        const deptId = searchParams.get('deptId');
        const period = searchParams.get('period');
        if (deptId && period) {
            if (departments.some(d => d.id === deptId)) {
                setSelectedDepartmentId(deptId);
                setSelectedPeriod(period);
            }
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

    const baseGeneratedPeriods = useMemo(() => {
        const periods = [];
        const now = new Date();
        for (let i = 0; i < 18; i++) periods.push(format(addMonths(now, i), "MMMM yyyy"));
        return periods;
    }, []);

    useEffect(() => {
        if (!selectedDepartmentId || !departments) {
            setOpenPeriods([]);
            return;
        }
        const dept = departments.find(d => d.id === selectedDepartmentId);
        const periodSettings = dept?.periodSettings || {};
        const allKnownPeriods = new Set(baseGeneratedPeriods);
        Object.keys(periodSettings).forEach(p => allKnownPeriods.add(p));
        const periods = Array.from(allKnownPeriods).filter(period => periodSettings[period]?.status === 'Open');
        periods.sort((a, b) => new Date(a).getTime() - new Date(a).getTime());
        setOpenPeriods(periods);
    }, [selectedDepartmentId, departments, baseGeneratedPeriods]);

    useEffect(() => {
        if (openPeriods.length > 0 && !selectedPeriod) {
            setSelectedPeriod(openPeriods[0]);
        }
    }, [openPeriods, selectedPeriod]);

    useEffect(() => {
        if (periodRequestsLoading || recurringLoading || !selectedDepartmentId || !selectedPeriod) {
            if (!selectedPeriod) setDraftItems([]);
            return;
        }

        const currentKey = `${selectedDepartmentId}-${selectedPeriod}`;
        if (lastLoadedKey.current === currentKey) return;

        const existingRequest = periodRequests?.find(req => !['Archived'].includes(req.status));
        const mapRecurringToSubmissionItem = (item: RecurringItem): ApprovalItem => ({
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
            fulfillmentComments: [],
        });

        if (existingRequest) {
            const savedItems = existingRequest.items;
            setEditingRequestId(existingRequest.id);
            setSelectedCompanyId(existingRequest.companyId || '');
            const savedItemDescriptions = new Set(savedItems.map(i => i.description));
            const newRecurringItems = recurringItems?.filter(masterItem => masterItem.active && !savedItemDescriptions.has(masterItem.name)).map(mapRecurringToSubmissionItem) || [];
            setDraftItems([...savedItems, ...newRecurringItems]);
        } else {
            setEditingRequestId(null);
            setSelectedCompanyId('');
            const initialItems = recurringItems?.filter(item => item.active).map(mapRecurringToSubmissionItem) || [];
            setDraftItems(initialItems);
        }
        lastLoadedKey.current = currentKey;
    }, [selectedDepartmentId, selectedPeriod, periodRequests, periodRequestsLoading, recurringItems, recurringLoading]);

    const departmentName = useMemo(() => departments?.find(d => d.id === selectedDepartmentId)?.name || '', [selectedDepartmentId, departments]);
    
    const isLockedByWorkflow = useMemo(() => {
        if (!selectedDepartmentId || !selectedPeriod) return false;
        const periodStatusInfo = periodRequests?.find(req => !['Archived'].includes(req.status));
        if (!periodStatusInfo) return false;
        const { status } = periodStatusInfo;
        if (['Completed', 'Approved', 'In Fulfillment'].includes(status)) return true;
        if (role === 'Requester' && status === 'Pending Manager Approval') return true;
        return false;
    }, [selectedDepartmentId, selectedPeriod, periodRequests, role]);
    
    const isLocked = isLockedByWorkflow || !selectedPeriod;

    const { operationalSummary, capitalSummary } = useBudgetSummary(draftItems, selectedDepartmentId, selectedPeriod, budgetItems, departments);

    const handleRequestEdit = async () => {
        if (!user || !firestore || !editingRequestId) return;
        if (!editRequestReason.trim()) {
            toast({ variant: "destructive", title: "Reason Required" });
            return;
        }
        try {
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: `${profile?.displayName || user.email} (${role || 'N/A'})`,
                action: 'request.edit_request',
                details: `User requested to edit locked submission with reason: "${editRequestReason}"`,
                entity: { type: 'procurementRequest', id: editingRequestId },
                timestamp: serverTimestamp()
            });
            toast({ title: "Edit Request Sent" });
            setIsRequestEditDialogOpen(false);
            setEditRequestReason('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Request Failed', description: error.message });
        }
    };

    const handleSaveRequest = async (isDraft: boolean) => {
        if (!user || !profile || !departmentName || !selectedDepartmentId || !firestore) {
            toast({ variant: "destructive", title: "Cannot save" });
            return;
        }
        const selectedCompany = companies?.find(c => c.id === selectedCompanyId);
        if (associatedCompanies.length > 0 && !selectedCompanyId && !isDraft) {
            toast({ variant: "destructive", title: "Company Required" });
            return;
        }
        setLastAction(isDraft ? 'draft' : 'submit');
        setSaveStatus('saving');
        const department = departments?.find(d => d.id === selectedDepartmentId);
        if (!department) {
            setSaveStatus('idle');
            return;
        }
        const isSubmitterTheDeptManager = user.uid === department.managerId;
        const actorString = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;
        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        
        let newStatus: ApprovalRequest['status'];
        const departmentWorkflow = department?.workflow;
        
        let timeline: ApprovalRequest['timeline'] = departmentWorkflow && departmentWorkflow.length > 0
            ? departmentWorkflow.map((stage) => ({ stage: stage.name, actor: String(stage.role) || 'System', date: null, status: 'waiting' as const }))
            : [
                { stage: "Request Submission", actor: "Requester", date: null, status: 'waiting' as const },
                { stage: "Manager Review", actor: "Manager", date: null, status: 'waiting' as const },
                { stage: "Executive Approval", actor: "Executive", date: null, status: 'waiting' as const },
                { stage: "Procurement Processing", actor: "Procurement", date: null, status: 'waiting' as const },
            ];
        
        if (timeline.length > 0) {
            timeline[0] = { ...timeline[0], actor: actorString, date: currentDate, status: 'completed' as const };
        }

        if (isDraft) {
            newStatus = 'Draft';
        } else {
            newStatus = (role === 'Administrator' || isSubmitterTheDeptManager) ? 'Pending Executive' : 'Pending Manager Approval';
            if (newStatus === 'Pending Manager Approval') {
                const managerReviewIndex = timeline.findIndex(s => s.stage === 'Manager Review');
                if (managerReviewIndex > -1) timeline[managerReviewIndex].status = 'pending';
            } else if (newStatus === 'Pending Executive') {
                const managerReviewIndex = timeline.findIndex(s => s.stage === 'Manager Review');
                if (managerReviewIndex > -1) timeline[managerReviewIndex] = { ...timeline[managerReviewIndex], status: 'completed' as const, actor: 'System (Skipped)', date: currentDate };
                const execIndex = timeline.findIndex(s => s.stage === 'Executive Approval');
                if (execIndex > -1) timeline[execIndex].status = 'pending';
            }
        }
        
        const submissionTotal = draftItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);
        const baseRequestData: Partial<ApprovalRequest> = {
            department: departmentName, departmentId: selectedDepartmentId, companyId: selectedCompanyId,
            companyName: selectedCompany?.name || '', period: selectedPeriod, total: submissionTotal,
            status: newStatus, submittedBy: actorString, submittedById: user.uid, timeline: timeline,
            items: draftItems, updatedAt: serverTimestamp() as any,
        };
        
        try {
            let docId: string;
            if (editingRequestId) {
                await updateDoc(doc(firestore, 'procurementRequests', editingRequestId), baseRequestData);
                docId = editingRequestId;
            } else {
                const docRef = await addDoc(collection(firestore, 'procurementRequests'), { ...baseRequestData, createdAt: serverTimestamp() as any });
                docId = docRef.id;
            }
            if (!editingRequestId && docId) setEditingRequestId(docId);
            setSaveStatus('saved');
            toast({ title: isDraft ? "Draft Saved" : "Request Submitted" });
            setTimeout(() => { setSaveStatus('idle'); setLastAction(null); }, 3000);
        } catch (error: any) {
            setSaveStatus('idle');
            setLastAction(null);
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        }
    };

    const handleApprove = async () => {
        if (!activeRequest || !editingRequestId || !user || !firestore || !profile) return;
        setIsSaving(true);
        let newStatus: ApprovalRequest['status'] = activeRequest.status;
        let newTimeline = [...activeRequest.timeline];
        const actorName = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;
        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        if (role === 'Executive' || role === 'Administrator') {
            newStatus = 'Approved';
            const managerReviewIndex = newTimeline.findIndex(s => s.stage === 'Manager Review');
            const execApprovalIndex = newTimeline.findIndex(s => s.stage === 'Executive Approval');
            if (managerReviewIndex > -1 && newTimeline[managerReviewIndex].status !== 'completed') newTimeline[managerReviewIndex] = { ...newTimeline[managerReviewIndex], status: 'completed', date: currentDate, actor: actorName };
            if (execApprovalIndex > -1) newTimeline[execApprovalIndex] = { ...newTimeline[execApprovalIndex], status: 'completed', date: currentDate, actor: actorName };
            const procIndex = newTimeline.findIndex(s => s.stage === 'Procurement Processing');
            if (procIndex > -1) newTimeline[procIndex].status = 'pending';
        }
        try {
            await updateDoc(doc(firestore, 'procurementRequests', editingRequestId), { status: newStatus, timeline: newTimeline });
            toast({ title: "Request Approved" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Approval Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmReject = async () => {
        if (!activeRequest || !editingRequestId || !user || !firestore || !profile) return;
        if (!rejectionReason.trim()) {
            toast({ variant: "destructive", title: "Rejection Reason Required" });
            return;
        }
        setIsSaving(true);
        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        const actorString = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;
        let newTimeline = [...activeRequest.timeline];
        const currentStepIndex = newTimeline.findIndex(step => step.status === 'pending');
        if (currentStepIndex !== -1) newTimeline[currentStepIndex] = { ...newTimeline[currentStepIndex], status: 'rejected', actor: actorString, date: currentDate };
        const commentData = { actor: actorString, actorId: user.uid, text: `REJECTED: ${rejectionReason}`, timestamp: new Date().toLocaleString("en-GB") };
        try {
            await updateDoc(doc(firestore, 'procurementRequests', editingRequestId), { status: 'Rejected', timeline: newTimeline, comments: arrayUnion(commentData) });
            toast({ title: "Request Rejected" });
            setRejectionReason('');
            setIsRejectDialogOpen(false);
        } catch(error: any) {
            toast({ variant: "destructive", title: "Reject Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchiveCurrentDraft = async () => {
        if (!editingRequestId || !user || !firestore || !profile) return;
        if (!archiveReason.trim()) {
            toast({ variant: 'destructive', title: 'Reason Required' });
            return;
        }
        const actorString = `${profile?.displayName || user.email} (${role})`;
        try {
            await updateDoc(doc(firestore, 'procurementRequests', editingRequestId), { status: 'Archived', updatedAt: serverTimestamp() as any, comments: arrayUnion({ actor: actorString, actorId: user.uid, text: `ARCHIVED: ${archiveReason}`, timestamp: new Date().toLocaleString("en-GB") }) });
            toast({ title: 'Draft Archived' });
            setEditingRequestId(null);
            setDraftItems([]);
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Archive Failed' });
        } finally {
            setArchiveReason('');
            setIsArchiveCurrentDialogOpen(false);
        }
    };

    const handleLoadPrevious = () => {
        if (!previousSubmissionToLoad || !previousSubmissions || !user || !profile) return;
        const submissionToLoad = previousSubmissions.find(s => s.id === previousSubmissionToLoad);
        if (!submissionToLoad) return;
        const newItems = submissionToLoad.items.map((item, index) => ({ ...item, id: Date.now() + index, type: 'One-Off' as const, expenseType: item.expenseType || 'Operational', addedById: user.uid, addedByName: `${profile?.displayName || user.email}`, fulfillmentStatus: 'Pending' as const, receivedQty: 0, fulfillmentComments: [] }));
        setDraftItems(newItems);
        setEditingRequestId(null);
        toast({ title: 'Submission Loaded' });
        setIsLoadConfirmDialogOpen(false);
        setPreviousSubmissionToLoad(null);
    };

    const handleNotifyManager = async () => {
        if (!user || !profile || !firestore || !selectedDepartmentId || !departments) return;
        setIsNotifying(true);
        try {
            const department = departments.find(d => d.id === selectedDepartmentId);
            if (!department || !department.managerId) throw new Error("No manager assigned.");
            const managerDoc = await getDoc(doc(firestore, 'users', department.managerId));
            if (!managerDoc.exists()) throw new Error("Manager not found.");
            const manager = managerDoc.data() as any;
            const link = `${window.location.origin}/dashboard/procurement?deptId=${selectedDepartmentId}&period=${encodeURIComponent(selectedPeriod)}`;
            const emailHtml = submissionReadyForReviewTemplate({ department: department.name, period: selectedPeriod, requesterName: profile.displayName || user.email || '' }, link);
            await fetch('/api/send-email', { method: 'POST', body: JSON.stringify({ to: manager.email, subject: `Review Ready: ${department.name}`, html: emailHtml }) });
            toast({ title: 'Manager Notified' });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Notification Failed", description: error.message });
        } finally {
            setIsNotifying(false);
        }
    };

    const opProg = useMemo(() => {
        const { procurement, forecast } = operationalSummary.totals;
        return forecast <= 0 ? (procurement > 0 ? 100 : 0) : Math.min(Math.round((procurement / forecast) * 100), 100);
    }, [operationalSummary]);

    const capProg = useMemo(() => {
        const { procurement, forecast } = capitalSummary.totals;
        return forecast <= 0 ? (procurement > 0 ? 100 : 0) : Math.min(Math.round((procurement / forecast) * 100), 100);
    }, [capitalSummary]);

    if (userLoading || deptsLoading || recurringLoading || periodRequestsLoading) {
        return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Procurement Quick Submit</CardTitle>
                    <CardDescription>Consolidated view for managing procurement requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 items-end gap-4">
                        <div className="grid items-center gap-1.5">
                            <Label htmlFor="department">Department</Label>
                            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                                <SelectTrigger id="department"><SelectValue placeholder="Select department" /></SelectTrigger>
                                <SelectContent>{departmentsForUser.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid items-center gap-1.5">
                           <Label htmlFor="company">Company</Label>
                            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId} disabled={isLocked || associatedCompanies.length === 0}>
                                <SelectTrigger id="company"><SelectValue placeholder={associatedCompanies.length === 0 ? "No companies linked" : "Select company..."} /></SelectTrigger>
                                <SelectContent>{associatedCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid items-center gap-1.5">
                            <Label htmlFor="period">Period</Label>
                             <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={!selectedDepartmentId}>
                                <SelectTrigger id="period"><SelectValue placeholder="Select period..." /></SelectTrigger>
                                <SelectContent>{openPeriods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid items-center gap-1.5">
                            <Label htmlFor="load-prev">Load Previous</Label>
                             <Select onValueChange={val => { setPreviousSubmissionToLoad(val); setIsLoadConfirmDialogOpen(true); }} value={previousSubmissionToLoad || ""} disabled={isLocked}>
                                <SelectTrigger id="load-prev"><SelectValue placeholder="Load past..." /></SelectTrigger>
                                <SelectContent>{previousSubmissions?.map(s => <SelectItem key={s.id} value={s.id}>{s.period}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {userDrafts.length > 0 && (
                <Card>
                    <CardHeader><CardTitle>Other Drafts</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableBody>
                                {userDrafts.map(draft => (
                                    <TableRow key={draft.id}>
                                        <TableCell>{draft.department} - {draft.period}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(draft.total)}</TableCell>
                                        <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => { setSelectedDepartmentId(draft.departmentId); setSelectedPeriod(draft.period); }}>Resume</Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <Card>
                <Collapsible>
                    <CollapsibleTrigger className="w-full p-5 flex flex-row items-center justify-between cursor-pointer rounded-t-lg hover:bg-muted/50">
                        <div><CardTitle className="flex items-center gap-2 text-primary"><History className="h-6 w-6" />Monthly Recurring Master List</CardTitle></div>
                        <ChevronDown className="h-5 w-5 transition-transform data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent><CardContent className="border-t pt-5"><RecurringClient items={recurringItems || []} view="list" categories={departmentCategories} /></CardContent></CollapsibleContent>
                </Collapsible>
            </Card>

            <Card>
                <Tabs defaultValue="submission" className="w-full">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div><CardTitle>Period Submission</CardTitle></div>
                            <TabsList><TabsTrigger value="submission">Items</TabsTrigger><TabsTrigger value="summary">Budget Summary</TabsTrigger></TabsList>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <TabsContent value="submission">
                            <SubmissionClient user={user!} profile={profile} userRole={role!} items={draftItems} setItems={setDraftItems} isLocked={isLocked} recurringItems={recurringItems} recurringLoading={recurringLoading} departmentId={selectedDepartmentId} departmentName={departmentName} budgetItems={budgetItems} />
                        </TabsContent>
                        <TabsContent value="summary">
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <div className="p-4 border rounded-lg bg-muted/50">
                                        <div className="flex justify-between items-center">
                                            <div><h3 className="font-semibold text-lg">Operational Budget Impact</h3></div>
                                            <div className="text-right"><p className="text-2xl font-bold">{formatCurrency(operationalSummary.totals.procurement)}</p></div>
                                        </div>
                                        <Progress value={opProg} className="mt-4" />
                                    </div>
                                    <div className="p-4 border rounded-lg bg-muted/50">
                                        <div className="flex justify-between items-center">
                                            <div><h3 className="font-semibold text-lg">Capital Budget Impact</h3></div>
                                            <div className="text-right"><p className="text-2xl font-bold">{formatCurrency(capitalSummary.totals.procurement)}</p></div>
                                        </div>
                                        <Progress value={capProg} className="mt-4" />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </CardContent>
                </Tabs>
                <CardFooter className="flex justify-between items-center border-t pt-6">
                    <div className="flex-1">{isLocked && <div className="flex items-center gap-3 text-yellow-800"><Globe className="h-5 w-5"/><p className="text-sm font-medium">Submission is locked.</p></div>}</div>
                    <div className="flex gap-3">
                        {canApproveOrReject ? (
                            <>
                                <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)} disabled={isSaving}><X className="mr-2 h-4 w-4" />Reject</Button>
                                <Button onClick={handleApprove} disabled={isSaving}><Check className="mr-2 h-4 w-4" />Approve</Button>
                            </>
                        ) : isLockedByWorkflow ? (
                            <Button onClick={() => setIsRequestEditDialogOpen(true)}>Request Edit</Button>
                        ) : (
                            <>
                                <Button variant="destructive" onClick={() => setIsArchiveCurrentDialogOpen(true)} disabled={!editingRequestId || isLocked}><Trash2 className="h-4 w-4 mr-2" />Delete Draft</Button>
                                <Button variant="ghost" onClick={() => handleSaveRequest(true)} disabled={saveStatus === 'saving' || isLocked}>{saveStatus === 'saving' && lastAction === 'draft' ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : null}Save Draft</Button>
                                {role === 'Requester' ? (
                                    <Button onClick={handleNotifyManager} disabled={isLocked || isNotifying}><Bell className="mr-2 h-4 w-4" />Notify Manager</Button>
                                ) : (
                                    <Button onClick={() => handleSaveRequest(false)} disabled={saveStatus === 'saving' || isLocked}>Submit For Approval</Button>
                                )}
                            </>
                        )}
                    </div>
                </CardFooter>
            </Card>

            <Dialog open={isRequestEditDialogOpen} onOpenChange={setIsRequestEditDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Request Edit</DialogTitle></DialogHeader>
                    <Textarea placeholder="Reason for edit..." value={editRequestReason} onChange={e => setEditRequestReason(e.target.value)} />
                    <DialogFooter><Button onClick={handleRequestEdit}>Send Request</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Reject Request</DialogTitle></DialogHeader>
                    <Textarea placeholder="Reason..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
                    <DialogFooter><Button variant="destructive" onClick={handleConfirmReject} disabled={isSaving}>Confirm Rejection</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isArchiveCurrentDialogOpen} onOpenChange={setIsArchiveCurrentDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Archive Draft</DialogTitle></DialogHeader>
                    <Textarea placeholder="Reason..." value={archiveReason} onChange={e => setArchiveReason(e.target.value)} />
                    <DialogFooter><Button variant="destructive" onClick={handleArchiveCurrentDraft}>Archive</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isLoadConfirmDialogOpen} onOpenChange={setIsLoadConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Load Items?</AlertDialogTitle><AlertDialogDescription>This replaces your current list.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleLoadPrevious}>Load</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}