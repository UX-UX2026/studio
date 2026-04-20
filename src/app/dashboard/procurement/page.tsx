
'use client';

import { useUser, type UserRole } from "@/firebase/auth/use-user";
import type { UserProfile } from '@/context/authentication-provider';
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Fragment, useRef } from "react";
import { Loader, AlertTriangle, Globe, Trash2, History, Check, ChevronDown, Bell, X, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, setDoc, updateDoc, deleteDoc, orderBy, getDocs, arrayUnion, getDoc } from "firebase/firestore";
import type { ApprovalRequest, RecurringItem, BudgetItem, Department, Company, AppMetadata, ApprovalItem, WorkflowStage, AuditEvent } from "@/types";
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
import { format, addMonths, formatDistanceToNow } from "date-fns";
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
import { useBudgetSummary } from "@/hooks/use-budget-summary";
import { RecurringClient } from "@/components/app/recurring-client";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { submissionReadyForReviewTemplate, requestActionRequiredTemplate, requestRejectedTemplate } from "@/lib/email-templates";
import { procurementCategories } from "@/lib/procurement-categories";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

type UserProfileData = {
    id: string;
    displayName: string;
    email: string;
    role: string;
};

export default function ProcurementQuickSubmitPage() {
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
    const [lastAction, setLastAction] = useState<'draft' | 'submit' | null>(null);
    const [openPeriods, setOpenPeriods] = useState<string[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
    const [isNotifying, setIsNotifying] = useState(false);

    // State for the edit request dialog
    const [isRequestEditDialogOpen, setIsRequestEditDialogOpen] = useState(false);
    const [editRequestReason, setEditRequestReason] = useState('');

    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // State for loading previous submissions
    const [previousSubmissionToLoad, setPreviousSubmissionToLoad] = useState<string | null>(null);
    const [isLoadConfirmDialogOpen, setIsLoadConfirmDialogOpen] = useState(false);

    // State for archiving current draft
    const [isArchiveCurrentDialogOpen, setIsArchiveCurrentDialogOpen] = useState(false);
    const [archiveReason, setArchiveReason] = useState('');

    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const [openCapitalCategory, setOpenCapitalCategory] = useState<string | null>(null);


    // Data fetching
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const companiesQuery = useMemo(() => collection(firestore, 'companies'), [firestore]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);
    
    const allDraftsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'procurementRequests'),
            where('status', '==', 'Draft')
        );
    }, [firestore]);
    const { data: allDrafts, loading: draftsLoading } = useCollection<ApprovalRequest>(allDraftsQuery);

    const userDrafts = useMemo(() => {
        if (!user || !allDrafts) return [];

        let draftsForUser: ApprovalRequest[];

        if (role === 'Manager' && userDepartment) {
            draftsForUser = allDrafts.filter(draft => draft.department === userDepartment);
        } else if (role === 'Administrator' || role === 'Executive' || role === 'Procurement Officer') {
            draftsForUser = allDrafts;
        } else { // Requester
            draftsForUser = allDrafts.filter(draft => draft.submittedById === user.uid);
        }
        
        // We filter out the currently active draft from the "other drafts" list
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
    const { data: budgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);

    const recurringItemsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(
            collection(firestore, 'recurringItems'), 
            where('active', '==', true), 
            where('departmentId', '==', selectedDepartmentId)
        );
    }, [firestore, selectedDepartmentId]);
    const { data: recurringItems, loading: recurringLoading } = useCollection<RecurringItem>(recurringItemsQuery);
    
    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);

    const usersQuery = useMemo(() => collection(firestore, 'users'), [firestore]);
    const { data: allUsers, loading: usersLoading } = useCollection<UserProfileData>(usersQuery);

    const previousSubmissionsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(
            collection(firestore, 'procurementRequests'),
            where('departmentId', '==', selectedDepartmentId),
            where('status', 'in', ['Completed', 'Approved', 'In Fulfillment']),
            orderBy('updatedAt', 'desc')
        );
    }, [firestore, selectedDepartmentId]);
    const { data: previousSubmissions, loading: previousSubmissionsLoading } = useCollection<ApprovalRequest>(previousSubmissionsQuery);

    const auditLogsQuery = useMemo(() => {
        if (!firestore || !editingRequestId) return null;
        return query(
            collection(firestore, 'auditLogs'), 
            where('entity.id', '==', editingRequestId)
        );
    }, [firestore, editingRequestId]);
    const { data: unsortedAuditLogs, loading: auditLogsLoading } = useCollection<AuditEvent>(auditLogsQuery);
    const auditLogs = useMemo(() => {
        if (!unsortedAuditLogs) return null;
        return [...unsortedAuditLogs].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    }, [unsortedAuditLogs]);

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
        const validStatus = ['Pending Manager Approval', 'Pending Executive', 'Queries Raised'];
        return validStatus.includes(activeRequest.status);
    }, [role, activeRequest]);

    const departmentCategories = useMemo(() => {
        const categoriesFromBudget = budgetItems?.map(item => item.category).filter(Boolean) || [];
        const categoriesFromCurrentItems = draftItems.map(item => item.category).filter(Boolean);
        const combined = new Set([...categoriesFromBudget, ...categoriesFromCurrentItems, ...procurementCategories]);
        if (!combined.has('Uncategorized')) {
            combined.add('Uncategorized');
        }
        return Array.from(combined).sort();
    }, [budgetItems, draftItems]);

    // Handle incoming query params to resume a draft
    const initialParamsProcessed = useRef(false);
    useEffect(() => {
        if (initialParamsProcessed.current || deptsLoading || !departments) return;
    
        const deptId = searchParams.get('deptId');
        const period = searchParams.get('period');
    
        if (deptId && period) {
            if (departments.some(d => d.id === deptId)) {
                // We use replace to prevent this action from creating a new history entry
                router.replace('/dashboard/procurement', { scroll: false });
                setSelectedDepartmentId(deptId);
                setSelectedPeriod(period);
            }
            initialParamsProcessed.current = true;
        }
    }, [searchParams, departments, deptsLoading, router]);

    const departmentsForUser = useMemo(() => {
        if (!departments) return [];
        if (role === 'Administrator' || role === 'Procurement Officer' || (role === 'Executive' && (!reportingDepartments || reportingDepartments.length === 0))) {
            return departments;
        }
        if (role === 'Executive') {
            return departments.filter(d => d.id && reportingDepartments && reportingDepartments.includes(d.id));
        }
        if (role === 'Manager' || role === 'Requester') {
            return departments.filter(d => d.name === userDepartment);
        }
        return [];
    }, [departments, role, userDepartment, reportingDepartments]);

    // Set default department based on user role and data
    useEffect(() => {
        if (deptsLoading || !departmentsForUser) return;
        if (!selectedDepartmentId && departmentsForUser.length > 0) {
            setSelectedDepartmentId(departmentsForUser[0].id);
        }
    }, [departmentsForUser, deptsLoading, selectedDepartmentId]);

    const baseGeneratedPeriods = useMemo(() => {
        const periods = [];
        const now = new Date();
        for (let i = 0; i < 18; i++) {
            periods.push(format(addMonths(now, i), "MMMM yyyy"));
        }
        return periods;
    }, []);

    // Update the list of open periods and selectedPeriod when the department changes
    useEffect(() => {
        if (!selectedDepartmentId || !departments) {
            setOpenPeriods([]);
            setSelectedPeriod('');
            return;
        }
    
        const dept = departments.find(d => d.id === selectedDepartmentId);
        const periodSettings = dept?.periodSettings || {};
        const allKnownPeriods = new Set(baseGeneratedPeriods);
        Object.keys(periodSettings).forEach(p => allKnownPeriods.add(p));
        const periods = Array.from(allKnownPeriods).filter(period => periodSettings[period]?.status === 'Open');
        periods.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        setOpenPeriods(periods);
        
        // Only update selectedPeriod if it's not in the new list of open periods
        if (!periods.includes(selectedPeriod)) {
            setSelectedPeriod(periods[0] || '');
        }
    }, [selectedDepartmentId, departments, baseGeneratedPeriods, selectedPeriod]);


    // Effect to initialize or load a draft, now with logic to sync recurring items.
    useEffect(() => {
        if (periodRequestsLoading || recurringLoading || !selectedDepartmentId || !selectedPeriod) {
            if (!selectedPeriod) setDraftItems([]);
            return;
        }

        const existingRequest = periodRequests?.find(req => !['Archived'].includes(req.status));

        // Prepare a function to convert master recurring items to submission items
        const mapRecurringToSubmissionItem = (item: RecurringItem): ApprovalItem => ({
            id: item.id,
            type: "Recurring",
            expenseType: item.expenseType || 'Operational', // Use from master, default to Operational
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
            setSelectedCompanyId(existingRequest.companyId || '');

            // ...and also add any NEW recurring items from the master list that are not already present.
            const savedItemDescriptions = new Set(savedItems.map(i => i.description));
            const newRecurringItems = recurringItems
                ?.filter(masterItem => masterItem.active && !savedItemDescriptions.has(masterItem.name))
                .map(mapRecurringToSubmissionItem) || [];

            setDraftItems([...savedItems, ...newRecurringItems]);

        } else {
            // This is a brand new submission for the period.
            setEditingRequestId(null);
            setSelectedCompanyId('');
            
            // Start with all active recurring items from the master list.
            const initialItems = recurringItems
                ?.filter(item => item.active)
                .map(mapRecurringToSubmissionItem) || [];
            setDraftItems(initialItems);
        }
    }, [selectedDepartmentId, selectedPeriod, periodRequests, periodRequestsLoading, recurringItems, recurringLoading]);

    const departmentName = useMemo(() => departments?.find(d => d.id === selectedDepartmentId)?.name || '', [selectedDepartmentId, departments]);

    const isLockedByWorkflow = useMemo(() => {
        if (!selectedDepartmentId || !selectedPeriod) return false;
        const periodStatusInfo = periodRequests?.find(req => !['Archived'].includes(req.status));

        if (!periodStatusInfo) return false;

        const { status } = periodStatusInfo;
        
        // These statuses always lock the form for editing.
        if (['Completed', 'Approved', 'In Fulfillment'].includes(status)) {
            return true;
        }

        if (role === 'Requester' && status === 'Pending Manager Approval') {
             return true;
        }
        
        return false;
    }, [selectedDepartmentId, selectedPeriod, periodRequests, role]);

    const isLocked = isLockedByWorkflow || !selectedPeriod;

    const { operationalSummary, capitalSummary } = useBudgetSummary(draftItems, selectedDepartmentId, selectedPeriod, budgetItems, departments);

    const handleRequestEdit = async () => {
        if (!user || !firestore || !editingRequestId) return;
        if (!editRequestReason.trim()) {
            toast({
                variant: "destructive",
                title: "Reason Required",
                description: "Please provide a reason for requesting to edit this submission.",
            });
            return;
        }
        const action = 'request.edit_request';
        try {
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: `${profile?.displayName || user.email} (${role || 'N/A'})`,
                action: action,
                details: `User requested to edit locked submission with reason: "${editRequestReason}"`,
                entity: { type: 'procurementRequest', id: editingRequestId },
                timestamp: serverTimestamp()
            });
            toast({
              title: "Edit Request Sent",
              description: "Your manager has been notified of your request to edit this submission.",
            });
            setIsRequestEditDialogOpen(false);
            setEditRequestReason('');
        } catch (error: any) {
            console.error("Request Edit Error:", error);
            toast({
                variant: 'destructive',
                title: 'Request Failed',
                description: error.message || 'Could not send the edit request.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: `${profile?.displayName || user.email} (${role || 'N/A'})`,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        }
    };

    const handleSaveRequest = async (isDraft: boolean) => {
        if (!user || !profile || !departmentName || !selectedDepartmentId || !firestore) {
            toast({ variant: "destructive", title: "Cannot save", description: "User or department information is missing." });
            return;
        }
        
        const selectedCompany = companies?.find(c => c.id === selectedCompanyId);
        if (associatedCompanies.length > 0 && !selectedCompanyId && !isDraft) {
            toast({
                variant: "destructive",
                title: "Company Required",
                description: "Please select a company for this submission.",
            });
            return;
        }

        const activePipelineRequest = periodRequests?.find(req => 
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

        setLastAction(isDraft ? 'draft' : 'submit');
        setSaveStatus('saving');
        
        const department = departments?.find(d => d.id === selectedDepartmentId);
        if (!department) {
            toast({ variant: "destructive", title: "Cannot save", description: "Selected department not found." });
            setSaveStatus('idle');
            return;
        }

        const isSubmitterTheDeptManager = user.uid === department.managerId;
        const actorString = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;
        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        
        let newStatus: ApprovalRequest['status'];
        const departmentWorkflow = department?.workflow;

        let timeline: ApprovalRequest['timeline'] = departmentWorkflow && departmentWorkflow.length > 0
            ? departmentWorkflow.map((stage) => ({
                stage: stage.name,
                actor: String(stage.role) || 'System',
                date: null,
                status: 'waiting' as const,
            }))
            : [
                { stage: "Request Submission", actor: "Requester", date: null, status: 'waiting' as const },
                { stage: "Manager Review", actor: "Manager", date: null, status: 'waiting' as const },
                { stage: "Executive Approval", actor: "Executive", date: null, status: 'waiting' as const },
                { stage: "Procurement Processing", actor: "Procurement", date: null, status: 'waiting' as const },
                { stage: "In Fulfillment", actor: "Procurement", date: null, status: 'waiting' as const },
                { stage: "Completed", actor: "System", date: null, status: 'waiting' as const },
            ];

        if (timeline.length > 0) {
            timeline[0] = { ...timeline[0], actor: actorString, date: currentDate, status: 'completed' as const };
        }

        if (isDraft) {
            newStatus = 'Draft';
        } else {
            newStatus = (role === 'Administrator' || isSubmitterTheDeptManager) 
                ? 'Pending Executive' 
                : 'Pending Manager Approval';
    
            // Set timeline based on final status
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
            department: departmentName,
            departmentId: selectedDepartmentId,
            companyId: selectedCompanyId,
            companyName: selectedCompany?.name || '',
            period: selectedPeriod,
            total: submissionTotal,
            status: newStatus,
            isEmergency: false,
            submittedBy: actorString,
            submittedById: user.uid,
            timeline: timeline,
            comments: editingRequestId ? periodRequests?.find(r => r.id === editingRequestId)?.comments || [] : [],
            items: draftItems,
            updatedAt: serverTimestamp() as any,
        };

        const action = isDraft ? 'request.draft_save' : 'request.submit';
        
        try {
            let docId: string;
            if (editingRequestId) {
                const docRef = doc(firestore, 'procurementRequests', editingRequestId);
                await updateDoc(docRef, baseRequestData);
                docId = editingRequestId;
            } else {
                const docRef = await addDoc(collection(firestore, 'procurementRequests'), { ...baseRequestData, createdAt: serverTimestamp() as any });
                docId = docRef.id;
            }

            if (!editingRequestId && docId) {
                setEditingRequestId(docId);
            }
            setSaveStatus('saved');
            toast({ 
                title: isDraft ? "Draft Saved" : "Request Submitted", 
                description: `Your procurement request for ${selectedPeriod} has been successfully ${isDraft ? 'saved' : 'submitted'}.` 
            });

            setTimeout(() => {
                setSaveStatus('idle');
                setLastAction(null);
            }, 3000);

            const auditLogData = {
                userId: user.uid,
                userName: actorString,
                action: action,
                details: `${isDraft ? (editingRequestId ? 'Updated draft' : 'Created draft') : 'Submitted request'} for ${selectedPeriod}.`,
                entity: { type: 'procurementRequest', id: docId },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
        } catch (error: any) {
            console.error("Save Request Error:", error);
            setSaveStatus('idle');
            setLastAction(null);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save your request. Check your connection.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: actorString,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        }
    };

    const handleApprove = async () => {
        if (!activeRequest || !editingRequestId || !user || !firestore || !allUsers || !profile) return;

        setIsSaving(true);
        let newStatus: ApprovalRequest['status'] = activeRequest.status;
        let newTimeline = [...activeRequest.timeline];
        let toastMessage: {title: string, description: string} | null = null;
        const actorName = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;
        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        

        if (role === 'Executive' || role === 'Administrator') {
            if(activeRequest.status === 'Pending Executive' || activeRequest.status === 'Pending Manager Approval' || activeRequest.status === 'Queries Raised') {
                newStatus = 'Approved';
                toastMessage = { title: "Request Approved", description: `${activeRequest.id}... has been approved and sent for processing.` };
                
                const managerReviewIndex = newTimeline.findIndex(s => s.stage === 'Manager Review');
                const execApprovalIndex = newTimeline.findIndex(s => s.stage === 'Executive Approval');

                if (managerReviewIndex > -1 && newTimeline[managerReviewIndex].status !== 'completed') {
                    newTimeline[managerReviewIndex] = { ...newTimeline[managerReviewIndex], status: 'completed', date: currentDate, actor: actorName };
                }
                if (execApprovalIndex > -1) {
                    newTimeline[execApprovalIndex] = { ...newTimeline[execApprovalIndex], status: 'completed', date: currentDate, actor: actorName };
                }
                const procurementProcessingIndex = newTimeline.findIndex(s => s.stage === 'Procurement Processing');
                if (procurementProcessingIndex > -1) {
                        newTimeline[procurementProcessingIndex] = { ...newTimeline[procurementProcessingIndex], status: 'pending' };
                }
            }
        }

        if (!toastMessage) {
            setIsSaving(false);
            return;
        }

        const requestRef = doc(firestore, 'procurementRequests', editingRequestId);
        const updateData: Partial<ApprovalRequest> = { status: newStatus, timeline: newTimeline };
        const action = 'request.approve';

        const finalToastMessage = toastMessage;
        
        try {
            await updateDoc(requestRef, updateData as { [x: string]: any; });
            toast(finalToastMessage);

            const auditDetails = `Approved request ${activeRequest.id}, new status "${newStatus}"`;

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: actorName,
                action,
                details: auditDetails,
                entity: { type: 'procurementRequest', id: editingRequestId },
                timestamp: serverTimestamp()
            });
            
            if (departments && activeRequest.departmentId) {
                const department = departments.find(d => d.id === activeRequest.departmentId);
                const nextStage = newTimeline.find(step => step.status === 'pending');
                
                if (department && department.workflow && nextStage) {
                    const workflowStageConfig = department.workflow.find(wfStage => wfStage.name === nextStage.stage);
                    
                    if (workflowStageConfig) {
                        const usersCollectionRef = collection(firestore, 'users');
                        const q = query(usersCollectionRef, where('role', '==', workflowStageConfig.role));
                        const querySnapshot = await getDocs(q);
                        
                        const recipients: string[] = [];
                        querySnapshot.forEach(doc => {
                            const userProfile = doc.data();
                            if (userProfile.email) recipients.push(userProfile.email);
                        });
                        
                        const uniqueRecipients = [...new Set(recipients)];
                
                        if (uniqueRecipients.length > 0) {
                            const link = `${window.location.origin}/dashboard/approvals?id=${editingRequestId}`;
                            const emailHtml = requestActionRequiredTemplate(
                                { id: activeRequest.id, department: activeRequest.department, total: activeRequest.total, submittedBy: activeRequest.submittedBy },
                                nextStage.stage,
                                link
                            );

                            await fetch('/api/send-email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    to: uniqueRecipients.join(','),
                                    subject: `Procurement Request Action Required: ${activeRequest.id}`,
                                    html: emailHtml,
                                })
                            });
                        }
                    }
                }
            }
            
        } catch (error: any) {
            console.error("Approval Error:", error);
            toast({
                variant: "destructive",
                title: "Approval Failed",
                description: error.message || "Could not update the request.",
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleConfirmReject = async () => {
        if (!activeRequest || !editingRequestId || !user || !firestore || !profile) return;
        
        if (!rejectionReason.trim()) {
            toast({
                variant: "destructive",
                title: "Rejection Reason Required",
                description: "Please provide a reason for rejecting this request.",
            });
            return;
        }

        setIsSaving(true);
        const newStatus: ApprovalRequest['status'] = 'Rejected';
        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        
        const actorString = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;
        
        let newTimeline = [...activeRequest.timeline];
        const currentStepIndex = newTimeline.findIndex(step => step.status === 'pending');
        if (currentStepIndex !== -1) {
            newTimeline[currentStepIndex] = {
                ...newTimeline[currentStepIndex],
                status: 'rejected',
                actor: actorString,
                date: currentDate,
            };
        }
        
        const commentData = {
            actor: actorString,
            actorId: user.uid,
            text: `REJECTED: ${rejectionReason}`,
            timestamp: new Date().toLocaleString("en-GB"),
        };

        const requestRef = doc(firestore, 'procurementRequests', editingRequestId);
        try {
            await updateDoc(requestRef, { 
                status: newStatus, 
                timeline: newTimeline,
                comments: arrayUnion(commentData)
            });
            toast({
                title: "Request Rejected",
                description: `Request ${activeRequest.id} has been rejected.`,
            });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: actorString,
                action: 'request.reject',
                details: `Rejected request ${activeRequest.id}`,
                entity: { type: 'procurementRequest', id: editingRequestId },
                timestamp: serverTimestamp()
            });

            const userDocRef = doc(firestore, 'users', activeRequest.submittedById);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const submitterProfile = userDocSnap.data() as UserProfileData;
                if (submitterProfile.email) {
                    const link = `${window.location.origin}/dashboard/approvals?id=${editingRequestId}`;
                    const emailHtml = requestRejectedTemplate(activeRequest, commentData, link);
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: submitterProfile.email, subject: `Procurement Request Rejected: ${activeRequest.id}`, html: emailHtml })
                    });
                }
            }

            setRejectionReason('');
            setIsRejectDialogOpen(false);
        } catch(error: any) {
            console.error("Reject Error:", error);
            toast({
                variant: "destructive",
                title: "Reject Failed",
                description: error.message || "Could not update the request.",
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteDraft = async () => {
        if (!deletingRequestId || !user || !firestore || !profile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not archive draft.' });
            return;
        }

        const draftToArchive = userDrafts?.find(req => req.id === deletingRequestId);
        if (!draftToArchive) return;

        const action = 'request.draft_archive';
        try {
            const docRef = doc(firestore, 'procurementRequests', deletingRequestId);
            await updateDoc(docRef, { status: 'Archived', updatedAt: serverTimestamp() as any });
            
            toast({ title: 'Draft Archived', description: 'The draft has been moved to the recycle bin.' });

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: `${profile?.displayName || user.email} (${role || 'N/A'})`,
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
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: `${profile?.displayName || user.email} (${role || 'N/A'})`,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setDeletingRequestId(null);
            setIsDeleteDialogOpen(false);
        }
    };

    const handleArchiveCurrentDraft = async () => {
        if (!editingRequestId || !user || !firestore || !profile) return;
        if (!archiveReason.trim()) {
            toast({ variant: 'destructive', title: 'Reason Required', description: 'Please provide a reason for archiving this draft.' });
            return;
        }
        
        const draftToArchive = allDrafts?.find(req => req.id === editingRequestId);
        if (!draftToArchive) {
             toast({ variant: 'destructive', title: 'Error', description: 'Cannot find the draft to archive.' });
            return;
        }
        
        const actorString = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;
        const action = 'request.draft_archive_with_reason';
        try {
            const docRef = doc(firestore, 'procurementRequests', editingRequestId);
            await updateDoc(docRef, { 
                status: 'Archived', 
                updatedAt: serverTimestamp() as any,
                comments: arrayUnion({
                    actor: actorString,
                    actorId: user.uid,
                    text: `ARCHIVED: ${archiveReason}`,
                    timestamp: new Date().toLocaleString("en-GB"),
                })
            });
            
            toast({ title: 'Draft Archived', description: 'The draft has been moved to the recycle bin.' });

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: actorString,
                action: action,
                details: `Archived draft for ${draftToArchive.period} with reason: ${archiveReason}`,
                entity: { type: 'procurementRequest', id: editingRequestId },
                timestamp: serverTimestamp()
            });

            setEditingRequestId(null);
            setDraftItems([]);
        } catch (error: any) {
             console.error("Archive current draft error:", error);
             toast({ variant: 'destructive', title: 'Archive Failed', description: error.message });
             await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: actorString,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setArchiveReason('');
            setIsArchiveCurrentDialogOpen(false);
        }
    };

    const handleLoadPrevious = () => {
        if (!previousSubmissionToLoad || !previousSubmissions || !user || !profile) return;
        const submissionToLoad = previousSubmissions.find(s => s.id === previousSubmissionToLoad);
        if (!submissionToLoad) return;
    
        const newItems = submissionToLoad.items.map((item, index) => ({
            ...item,
            id: Date.now() + index, // Give it a new temporary ID for the client
            type: 'One-Off' as const, // Treat all loaded items as one-off
            expenseType: item.expenseType || 'Operational', // Default to Operational
            addedById: user.uid,
            addedByName: `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`,
            fulfillmentStatus: 'Pending' as const, // Reset fulfillment state
            receivedQty: 0,
            fulfillmentComments: [],
        }));
    
        setDraftItems(newItems);
        setEditingRequestId(null); // This becomes a new draft, not an edit of the old one.
        toast({ title: 'Submission Loaded', description: `Loaded ${newItems.length} items as a new draft.` });
        setIsLoadConfirmDialogOpen(false);
        setPreviousSubmissionToLoad(null); // Reset select
    };

    const handleNotifyManager = async () => {
        if (!user || !profile || !firestore || !selectedDepartmentId || !departments || !allUsers) {
            toast({ variant: "destructive", title: "Cannot notify", description: "Missing required data to find manager." });
            return;
        }
        
        setIsNotifying(true);
        const action = 'request.notify_manager';
        const actorString = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;
    
        try {
            const department = departments.find(d => d.id === selectedDepartmentId);
            if (!department || !department.managerId) {
                throw new Error("No manager is assigned to this department.");
            }
    
            const managerDocRef = doc(firestore, 'users', department.managerId);
            const managerDocSnap = await getDoc(managerDocRef);
            if (!managerDocSnap.exists()) {
                throw new Error("Manager's profile could not be found.");
            }
            
            const manager = managerDocSnap.data() as UserProfileData;
            if (!manager.email) {
                throw new Error("Manager's email address could not be found.");
            }
            
            const link = `${window.location.origin}/dashboard/procurement?deptId=${selectedDepartmentId}&period=${encodeURIComponent(selectedPeriod)}`;
            const emailHtml = submissionReadyForReviewTemplate(
                { department: department.name, period: selectedPeriod, requesterName: actorString },
                link
            );
    
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: manager.email,
                    subject: `Procurement Submission Ready for Review: ${department.name} - ${selectedPeriod}`,
                    html: emailHtml,
                })
            });
    
            const responseData = await response.json();
            if (!response.ok) {
              throw new Error(responseData.error || 'Failed to send email');
            }
    
            toast({ title: 'Manager Notified', description: `An email has been sent to ${manager.displayName}.` });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: actorString,
                action: 'notification.sent',
                details: `Manager notification sent to ${manager.displayName} for period ${selectedPeriod} in ${department.name}`,
                entity: { type: 'procurementRequest', id: editingRequestId || 'new' },
                timestamp: serverTimestamp()
            });
    
        } catch (error: any) {
            console.error("Notify Manager Error:", error);
            toast({
                variant: "destructive",
                title: "Notification Failed",
                description: error.message,
            });
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: actorString,
                action: 'notification.failed',
                details: `Failed to send manager notification: ${error.message}`,
                entity: { type: 'procurementRequest', id: editingRequestId || 'new' },
                timestamp: serverTimestamp()
            });
        } finally {
            setIsNotifying(false);
        }
    };

    const loading = userLoading || draftsLoading || periodRequestsLoading || deptsLoading || budgetsLoading || recurringLoading || metadataLoading || usersLoading || previousSubmissionsLoading || companiesLoading || auditLogsLoading;
    
    if (loading || !user || !profile || !role) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const operationalBudgetProgress = useMemo(() => {
        const { procurement, forecast } = operationalSummary.totals;
        if (forecast <= 0) return procurement > 0 ? 100 : 0;
        return Math.min(Math.round((procurement / forecast) * 100), 100);
    }, [operationalSummary]);

    const capitalBudgetProgress = useMemo(() => {
        const { procurement, forecast } = capitalSummary.totals;
        if (forecast <= 0) return procurement > 0 ? 100 : 0;
        return Math.min(Math.round((procurement / forecast) * 100), 100);
    }, [capitalSummary]);

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
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 items-end gap-4">
                        <div className="grid items-center gap-1.5">
                            <Label htmlFor="department">Department</Label>
                            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId} disabled={deptsLoading || departmentsForUser.length <= 1}>
                                <SelectTrigger id="department">
                                    <SelectValue placeholder={deptsLoading ? "Loading..." : "Select department"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {departmentsForUser?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid items-center gap-1.5">
                           <Label htmlFor="company">Company</Label>
                            <Select 
                                value={selectedCompanyId} 
                                onValueChange={setSelectedCompanyId}
                                disabled={isLocked || associatedCompanies.length === 0}
                            >
                                <SelectTrigger id="company">
                                    <SelectValue placeholder={associatedCompanies.length === 0 ? "No companies linked" : "Select company..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {associatedCompanies.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid items-center gap-1.5">
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
                        <div className="grid items-center gap-1.5">
                            <Label htmlFor="load-previous">Load from Previous</Label>
                            <Select 
                                onValueChange={val => {
                                    if(draftItems.length > 0) {
                                        setPreviousSubmissionToLoad(val);
                                        setIsLoadConfirmDialogOpen(true);
                                    } else {
                                        setPreviousSubmissionToLoad(val);
                                        handleLoadPrevious(); 
                                    }
                                }}
                                value={previousSubmissionToLoad || ""}
                                disabled={!selectedDepartmentId || previousSubmissionsLoading || isLocked}
                            >
                                <SelectTrigger id="load-previous" disabled={!selectedDepartmentId || previousSubmissionsLoading || isLocked}>
                                    <SelectValue placeholder={previousSubmissionsLoading ? "Loading..." : "Select a past submission..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {previousSubmissions && previousSubmissions.length > 0 ? previousSubmissions.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{`${s.period} - ${s.id} (${s.items.length} items)`}</SelectItem>
                                    )) : <div className="p-4 text-sm text-muted-foreground">No previous submissions found.</div>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {userDrafts && userDrafts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary"/>Your Other Drafts</CardTitle>
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
                <Collapsible>
                    <CollapsibleTrigger className="w-full p-5 flex flex-row items-center justify-between cursor-pointer rounded-t-lg hover:bg-muted/50">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-primary">
                                <History className="h-6 w-6" />
                                Monthly Recurring Master List
                            </CardTitle>
                            <CardDescription>
                                Items defined here are automatically added to every period submission. Expand to manage items and their recurrence.
                            </CardDescription>
                        </div>
                        <ChevronDown className="h-5 w-5 transition-transform data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <CardContent className="border-t pt-5">
                            <RecurringClient items={recurringItems || []} view="list" categories={departmentCategories} />
                        </CardContent>
                    </CollapsibleContent>
                </Collapsible>
            </Card>
            <Card>
                <Tabs defaultValue="submission" className="w-full">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>Period Submission {activeRequest && `(Submitted by ${activeRequest.submittedBy})`}</CardTitle>
                                <CardDescription>Manage line items and compare against the budget forecast for this period.</CardDescription>
                            </div>
                            <TabsList>
                                <TabsTrigger value="submission">Submission Items</TabsTrigger>
                                <TabsTrigger value="summary">Budget Summary</TabsTrigger>
                            </TabsList>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <TabsContent value="submission">
                            <SubmissionClient 
                                user={user}
                                profile={profile}
                                userRole={role} 
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
                        <TabsContent value="summary">
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <div className="p-4 border rounded-lg bg-muted/50">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-semibold text-lg">Operational Budget vs. Actuals: {selectedPeriod}</h3>
                                                <p className="text-sm text-muted-foreground">Live comparison of your draft items against the forecast.</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold">{formatCurrency(operationalSummary.totals.procurement)}</p>
                                                <p className="text-sm text-muted-foreground">vs forecast of {formatCurrency(operationalSummary.totals.forecast)}</p>
                                            </div>
                                        </div>
                                        <Progress value={operationalBudgetProgress} className="mt-4" />
                                    </div>
                                    <div className="overflow-auto rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="font-bold">Category</TableHead>
                                                    <TableHead className="text-right font-bold">Request Total</TableHead>
                                                    <TableHead className="text-right font-bold">Forecast Total</TableHead>
                                                    <TableHead className="text-right font-bold">Variance</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {operationalSummary.lines.length > 0 ? operationalSummary.lines.map((item) => (
                                                    <Fragment key={item.category}>
                                                        <TableRow
                                                            onClick={() => setOpenCategory(openCategory === item.category ? null : item.category)}
                                                            className={cn("cursor-pointer", item.isOverBudget && "bg-red-50 dark:bg-red-900/20")}
                                                        >
                                                            <TableCell className="font-medium flex items-center gap-2">
                                                                <ChevronRight className={cn("h-4 w-4 transition-transform", openCategory === item.category && "rotate-90")} />
                                                                {item.category}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(item.procurementTotal)}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(item.forecastTotal)}</TableCell>
                                                            <TableCell className={cn("text-right font-mono font-semibold", item.isOverBudget && "text-red-500 flex items-center justify-end gap-2")}>
                                                                {item.isOverBudget && <AlertTriangle className="h-4 w-4" />}
                                                                {formatCurrency(item.variance)}
                                                            </TableCell>
                                                        </TableRow>
                                                        {openCategory === item.category && (
                                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                <TableCell colSpan={4} className="p-2">
                                                                    <div className="p-2 bg-background rounded-md border">
                                                                        <Table>
                                                                            <TableHeader>
                                                                                <TableRow>
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
                                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No operational budget data.</TableCell></TableRow>}
                                            </TableBody>
                                            <TableFooter><TableRow><TableCell>Subtotal</TableCell><TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.procurement)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.forecast)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.variance)}</TableCell></TableRow></TableFooter>
                                        </Table>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                     <div className="p-4 border rounded-lg bg-muted/50">
                                        <div className="flex justify-between items-center">
                                            <div><h3 className="font-semibold text-lg">Capital Budget vs. Actuals: {selectedPeriod}</h3></div>
                                            <div className="text-right"><p className="text-2xl font-bold">{formatCurrency(capitalSummary.totals.procurement)}</p><p className="text-sm text-muted-foreground">vs forecast of {formatCurrency(capitalSummary.totals.forecast)}</p></div>
                                        </div>
                                        <Progress value={capitalBudgetProgress} className="mt-4" />
                                    </div>
                                    <div className="overflow-auto rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="font-bold">Category</TableHead>
                                                    <TableHead className="text-right font-bold">Request Total</TableHead>
                                                    <TableHead className="text-right font-bold">Forecast Total</TableHead>
                                                    <TableHead className="text-right font-bold">Variance</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                 {capitalSummary.lines.length > 0 ? capitalSummary.lines.map((item) => (
                                                    <Fragment key={item.category}>
                                                        <TableRow
                                                            onClick={() => setOpenCapitalCategory(openCapitalCategory === item.category ? null : item.category)}
                                                            className={cn("cursor-pointer", item.isOverBudget && "bg-red-50 dark:bg-red-900/20")}
                                                        >
                                                            <TableCell className="font-medium flex items-center gap-2">
                                                                <ChevronRight className={cn("h-4 w-4 transition-transform", openCapitalCategory === item.category && "rotate-90")} />
                                                                {item.category}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(item.procurementTotal)}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(item.forecastTotal)}</TableCell>
                                                            <TableCell className={cn("text-right font-mono font-semibold", item.isOverBudget && "text-red-500 flex items-center justify-end gap-2")}>
                                                                {item.isOverBudget && <AlertTriangle className="h-4 w-4" />}
                                                                {formatCurrency(item.variance)}
                                                            </TableCell>
                                                        </TableRow>
                                                        {openCapitalCategory === item.category && (
                                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                <TableCell colSpan={4} className="p-2">
                                                                    <div className="p-2 bg-background rounded-md border">
                                                                        <Table>
                                                                            <TableHeader>
                                                                                <TableRow>
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
                                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No capital items in this submission.</TableCell></TableRow>}
                                            </TableBody>
                                            <TableFooter><TableRow><TableCell>Subtotal</TableCell><TableCell className="text-right font-mono">{formatCurrency(capitalSummary.totals.procurement)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(capitalSummary.totals.forecast)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(capitalSummary.totals.variance)}</TableCell></TableRow></TableFooter>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </CardContent>
                </Tabs>
                <CardFooter className="flex justify-between items-center border-t pt-6">
                    <div className="flex-1">
                        {isLocked && (
                            <div className="flex items-center gap-3 text-yellow-800">
                                <Globe className="h-5 w-5"/>
                                <div className="text-sm font-medium">
                                    <p>{isLockedByWorkflow ? "This submission is locked as it is already in the approval pipeline." : "Select an open period to begin."}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        {canApproveOrReject ? (
                            <>
                                <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)} disabled={isSaving}>
                                    {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                                    <X className="mr-2 h-4 w-4" />Reject
                                </Button>
                                <Button onClick={handleApprove} disabled={isSaving}>
                                    {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                                    <Check className="mr-2 h-4 w-4" />Approve
                                </Button>
                            </>
                        ) : isLockedByWorkflow ? (
                            <Button onClick={() => setIsRequestEditDialogOpen(true)}>Request Edit</Button>
                        ) : (
                            <>
                                <Button variant="destructive" onClick={() => setIsArchiveCurrentDialogOpen(true)} disabled={!editingRequestId || isLocked}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Draft
                                </Button>
                                <Button variant="ghost" onClick={() => handleSaveRequest(true)} disabled={saveStatus === 'saving' || isLocked}>
                                    {saveStatus === 'saving' && lastAction === 'draft' ? (
                                        <Loader className="mr-2 h-4 w-4 animate-spin"/>
                                    ) : saveStatus === 'saved' && lastAction === 'draft' ? (
                                        <Check className="mr-2 h-4 w-4" />
                                    ) : null}
                                    {saveStatus === 'saving' && lastAction === 'draft' ? 'Saving Draft...' : saveStatus === 'saved' && lastAction === 'draft' ? 'Saved' : 'Save as Draft'}
                                </Button>
                                
                                {role === 'Requester' ? (
                                    <Button onClick={handleNotifyManager} disabled={isLocked || isNotifying || saveStatus === 'saving'}>
                                        {isNotifying ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Bell className="mr-2 h-4 w-4" />}
                                        Notify Manager
                                    </Button>
                                ) : (
                                    <Button className="shadow-lg shadow-primary/20" onClick={() => handleSaveRequest(false)} disabled={saveStatus === 'saving' || isLocked}>
                                        {saveStatus === 'saving' && lastAction === 'submit' ? (
                                            <Loader className="mr-2 h-4 w-4 animate-spin"/>
                                        ) : saveStatus === 'saved' && lastAction === 'submit' ? (
                                            <Check className="mr-2 h-4 w-4" />
                                        ) : null}
                                        {saveStatus === 'saving' && lastAction === 'submit' ? 'Saving Submission...' : saveStatus === 'saved' && lastAction === 'submit' ? 'Submitted' : 'Submit For Approval'}
                                    </Button>
                                )}
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

            <Dialog open={isRequestEditDialogOpen} onOpenChange={setIsRequestEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request to Edit Submission</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for requesting to edit this locked submission. This will be sent to your manager.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="e.g., 'Need to add an urgent item that was missed.'" 
                            value={editRequestReason} 
                            onChange={(e) => setEditRequestReason(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRequestEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleRequestEdit}>Send Request</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isLoadConfirmDialogOpen} onOpenChange={setIsLoadConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Load Previous Submission?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will replace all items in your current draft with the items from the selected submission. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPreviousSubmissionToLoad(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLoadPrevious}>Load Items</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <Dialog open={isArchiveCurrentDialogOpen} onOpenChange={setIsArchiveCurrentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Archive Current Draft?</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for archiving this draft. It will be moved to the recycle bin, and the current form will be cleared.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="e.g., 'Duplicate submission, starting over.'" 
                            value={archiveReason} 
                            onChange={(e) => setArchiveReason(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsArchiveCurrentDialogOpen(false); setArchiveReason(''); }}>Cancel</Button>
                        <Button variant="destructive" onClick={handleArchiveCurrentDraft}>Archive Draft</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Request</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this request. This will be added to the communication log.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Enter rejection reason here..." 
                            value={rejectionReason} 
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={5}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsRejectDialogOpen(false); setRejectionReason(''); }}>Cancel</Button>
                        <Button variant="destructive" onClick={handleConfirmReject} disabled={isSaving}>
                            {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
