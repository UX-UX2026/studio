
'use client';

import { useUser, type UserRole, type UserProfile } from "@/firebase/auth/use-user";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Fragment } from "react";
import { Loader, AlertTriangle, Globe, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, setDoc, updateDoc } from "firebase/firestore";
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
import { format, addMonths } from "date-fns";
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
    managerId?: string;
    budgetHeaders?: string[];
    workflow?: WorkflowStage[];
    budgetYear?: number;
    periodSettings?: {
        [period: string]: {
            status: 'Open' | 'Locked';
        }
    },
    companyIds?: string[];
};

type Company = {
    id: string;
    name: string;
    logoUrl?: string;
};

type AppMetadata = {
    id: string;
    limitToOneSubmissionPerPeriod?: boolean;
}

type BudgetItem = {
    id: string;
    departmentId: string;
    category: string;
    expenseType?: 'Operational' | 'Capital';
    forecasts: number[];
    yearTotal: number;
};

type Item = {
  id: number | string;
  type: "Recurring" | "One-Off";
  expenseType: 'Operational' | 'Capital';
  description: string;
  brand: string;
  qty: number;
  category: string;
  unitPrice: number;
  fulfillmentStatus: 'Pending' | 'Sourcing' | 'Quoted' | 'Ordered' | 'Completed';
  receivedQty: number;
  fulfillmentComments: string[];
  comments?: string;
  addedById?: string;
  addedByName?: string;
};

type WorkflowStage = {
    id: string;
    name: string;
    role: any;
    permissions: string[];
};

export default function EmergencyProcurementPage() {
    const { user, profile, role, department: userDepartment, reportingDepartments, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    
    const [draftItems, setDraftItems] = useState<Item[]>([]);
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Data fetching
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const companiesQuery = useMemo(() => collection(firestore, 'companies'), [firestore]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);

    const periodRequestsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId || !selectedPeriod) return null;
        return query(
            collection(firestore, 'procurementRequests'),
            where('departmentId', '==', selectedDepartmentId),
            where('period', '==', selectedPeriod),
            where('isEmergency', '==', true)
        );
    }, [firestore, selectedDepartmentId, selectedPeriod]);
    const { data: periodRequests, loading: periodRequestsLoading } = useCollection<ApprovalRequest>(periodRequestsQuery);

    const budgetsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(collection(firestore, 'budgets'), where('departmentId', '==', selectedDepartmentId));
    }, [firestore, selectedDepartmentId]);
    const { data: budgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);

    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);

    const associatedCompanies = useMemo(() => {
        if (!selectedDepartmentId || !departments || !companies) return [];
        const dept = departments.find(d => d.id === selectedDepartmentId);
        if (!dept || !dept.companyIds) return [];
        return companies.filter(c => dept.companyIds!.includes(c.id));
    }, [selectedDepartmentId, departments, companies]);

    // Handle incoming query params to resume a draft
    useEffect(() => {
        const deptId = searchParams.get('deptId');
        const period = searchParams.get('period');

        if (deptId && period) {
            if (departments?.some(d => d.id === deptId)) {
                setSelectedDepartmentId(deptId);
                setSelectedPeriod(period);
                router.replace('/dashboard/procurement/emergency', { scroll: false });
            }
        }
    }, [searchParams, departments, router]);

    const departmentsForUser = useMemo(() => {
        if (!departments) return [];
        if (role === 'Administrator' || role === 'Procurement Officer' || (role === 'Executive' && (!reportingDepartments || reportingDepartments.length === 0))) {
            return departments;
        }
        if (role === 'Executive') {
            return departments.filter(d => reportingDepartments.includes(d.id));
        }
        if (role === 'Manager' || role === 'Requester') {
            return departments.filter(d => d.name === userDepartment);
        }
        return [];
    }, [departments, role, userDepartment, reportingDepartments]);

    // Set default department and period
    useEffect(() => {
        if (deptsLoading || !departmentsForUser) return;
        if (!selectedDepartmentId && departmentsForUser.length > 0) {
            setSelectedDepartmentId(departmentsForUser[0].id);
        }
        if (!selectedPeriod) {
            setSelectedPeriod(format(new Date(), "MMMM yyyy"));
        }
    }, [departmentsForUser, deptsLoading, selectedDepartmentId, selectedPeriod]);

    // Effect to initialize or load a draft
    useEffect(() => {
        if (periodRequestsLoading || !selectedDepartmentId || !selectedPeriod) {
            if (!selectedPeriod) setDraftItems([]);
            return;
        }

        const existingRequest = periodRequests?.find(req => !['Archived'].includes(req.status));

        if (existingRequest) {
            setDraftItems(existingRequest.items);
            setEditingRequestId(existingRequest.id);
            setSelectedCompanyId(existingRequest.companyId || '');
        } else {
            setDraftItems([]);
            setEditingRequestId(null);
            setSelectedCompanyId('');
        }
    }, [selectedDepartmentId, selectedPeriod, periodRequests, periodRequestsLoading]);

    const departmentName = useMemo(() => departments?.find(d => d.id === selectedDepartmentId)?.name || '', [selectedDepartmentId, departments]);
    const isLocked = !selectedPeriod;
    const { operationalSummary, capitalSummary } = useBudgetSummary(draftItems, selectedDepartmentId, selectedPeriod, budgetItems, departments);

    const handleSaveRequest = async (isDraft: boolean) => {
        if (!user || !profile || !departmentName || !selectedDepartmentId || !firestore) {
            toast({ variant: "destructive", title: "Cannot save", description: "User or department information is missing." });
            return;
        }
        
        const selectedCompany = companies?.find(c => c.id === selectedCompanyId);
        if (associatedCompanies.length > 0 && !selectedCompanyId && !isDraft) {
            toast({ variant: "destructive", title: "Company Required", description: "Please select a company for this submission." });
            return;
        }

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

        let timeline = departmentWorkflow && departmentWorkflow.length > 0
            ? departmentWorkflow.map((stage) => ({ stage: stage.name, actor: String(stage.role) || 'System', date: null, status: 'waiting' as const }))
            : [
                { stage: "Request Submission", actor: "Requester", date: null, status: 'waiting' as const },
                { stage: "Manager Review", actor: "Manager", date: null, status: 'waiting' as const },
                { stage: "Executive Approval", actor: "Executive", date: null, status: 'waiting' as const },
                { stage: "Procurement Processing", actor: "Procurement", date: null, status: 'waiting' as const },
            ];

        if (timeline.length > 0) {
            timeline[0] = { ...timeline[0], actor: actorString, date: currentDate, status: 'completed' };
        }

        if (isDraft) {
            newStatus = 'Draft';
        } else {
            if (role === 'Administrator' || isSubmitterTheDeptManager) {
                newStatus = 'Approved';
            } else {
                newStatus = 'Pending Executive';
            }
            
            if (newStatus === 'Pending Executive') {
                const execIndex = timeline.findIndex(s => s.stage === 'Executive Approval');
                if (execIndex > -1) timeline[execIndex].status = 'pending';
            } else if (newStatus === 'Approved') {
                const procIndex = timeline.findIndex(s => s.stage === 'Procurement Processing');
                for (let i = 0; i < procIndex; i++) {
                    if (timeline[i].status !== 'completed') {
                        timeline[i] = { ...timeline[i], status: 'completed', actor: 'System (Emergency)', date: currentDate };
                    }
                }
                if (procIndex > -1) timeline[procIndex].status = 'pending';
            }
        }

        const submissionTotal = draftItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);

        const baseRequestData = {
            department: departmentName,
            departmentId: selectedDepartmentId,
            companyId: selectedCompanyId,
            companyName: selectedCompany?.name || '',
            period: selectedPeriod,
            total: submissionTotal,
            status: newStatus,
            isEmergency: true,
            submittedBy: actorString,
            submittedById: user.uid,
            timeline: timeline,
            comments: editingRequestId ? periodRequests?.find(r => r.id === editingRequestId)?.comments || [] : [],
            items: draftItems,
            updatedAt: serverTimestamp(),
        };

        const action = isDraft ? 'request.draft_save' : 'request.submit';
        
        try {
            let docId: string;
            if (editingRequestId) {
                const docRef = doc(firestore, 'procurementRequests', editingRequestId);
                await updateDoc(docRef, baseRequestData);
                docId = editingRequestId;
            } else {
                const docRef = await addDoc(collection(firestore, 'procurementRequests'), { ...baseRequestData, createdAt: serverTimestamp() });
                docId = docRef.id;
            }

            if (!editingRequestId && docId) {
                setEditingRequestId(docId);
            }
            setSaveStatus('saved');
            toast({ title: isDraft ? "Draft Saved" : "Emergency Request Submitted", description: `Your request for ${selectedPeriod} has been successfully ${isDraft ? 'saved' : 'submitted'}.` });
            setTimeout(() => { setSaveStatus('idle'); }, 3000);

        } catch (error: any) {
            console.error("Save Request Error:", error);
            setSaveStatus('idle');
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'Could not save your request.' });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: actorString, action, errorMessage: error.message, errorStack: error.stack });
        }
    };

    const loading = userLoading || deptsLoading || periodRequestsLoading || budgetsLoading || metadataLoading || companiesLoading;

    if (loading) {
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
                    <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive" />Emergency / Unplanned Submission</CardTitle>
                    <CardDescription>Create and submit an emergency or unplanned request that may bypass standard approval stages.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 items-end gap-4">
                        <div className="grid items-center gap-1.5">
                            <Label htmlFor="department">Department</Label>
                            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId} disabled={deptsLoading || departmentsForUser.length <= 1}>
                                <SelectTrigger id="department"><SelectValue placeholder={deptsLoading ? "Loading..." : "Select department"} /></SelectTrigger>
                                <SelectContent>{departmentsForUser?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid items-center gap-1.5">
                           <Label htmlFor="company">Company</Label>
                            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId} disabled={isLocked || associatedCompanies.length === 0}>
                                <SelectTrigger id="company"><SelectValue placeholder={associatedCompanies.length === 0 ? "No companies linked" : "Select company..."} /></SelectTrigger>
                                <SelectContent>{associatedCompanies.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid items-center gap-1.5">
                            <Label htmlFor="period">Procurement Period</Label>
                             <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={!selectedDepartmentId}>
                                <SelectTrigger id="period"><SelectValue placeholder="Select a period..." /></SelectTrigger>
                                <SelectContent>{[...Array(12)].map((_, i) => format(addMonths(new Date(), i), "MMMM yyyy")).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <Tabs defaultValue="submission" className="w-full">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div><CardTitle>Submission Items</CardTitle><CardDescription>Add items for this emergency request.</CardDescription></div>
                            <TabsList><TabsTrigger value="submission">Items</TabsTrigger><TabsTrigger value="summary">Budget Impact</TabsTrigger></TabsList>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <TabsContent value="submission">
                            <SubmissionClient 
                                user={user} profile={profile} userRole={role} items={draftItems} setItems={setDraftItems}
                                isLocked={isLocked} recurringItems={null} recurringLoading={false} departmentId={selectedDepartmentId}
                                departmentName={departmentName} budgetItems={budgetItems}
                            />
                        </TabsContent>
                        <TabsContent value="summary">
                           <div className="space-y-4">
                                <div className="p-4 border rounded-lg bg-muted/50">
                                    <div className="flex justify-between items-center">
                                        <div><h3 className="font-semibold text-lg">Operational Budget Impact: {selectedPeriod}</h3></div>
                                        <div className="text-right"><p className="text-2xl font-bold">{formatCurrency(operationalSummary.totals.procurement)}</p><p className="text-sm text-muted-foreground">vs forecast of {formatCurrency(operationalSummary.totals.forecast)}</p></div>
                                    </div>
                                    <Progress value={useMemo(() => Math.min(Math.round((operationalSummary.totals.procurement / (operationalSummary.totals.forecast || 1)) * 100), 100), [operationalSummary])} className="mt-4" />
                                </div>
                                <div className="p-4 border rounded-lg bg-muted/50">
                                    <div className="flex justify-between items-center">
                                        <div><h3 className="font-semibold text-lg">Capital Budget Impact: {selectedPeriod}</h3></div>
                                        <div className="text-right"><p className="text-2xl font-bold">{formatCurrency(capitalSummary.totals.procurement)}</p><p className="text-sm text-muted-foreground">vs forecast of {formatCurrency(capitalSummary.totals.forecast)}</p></div>
                                    </div>
                                    <Progress value={useMemo(() => Math.min(Math.round((capitalSummary.totals.procurement / (capitalSummary.totals.forecast || 1)) * 100), 100), [capitalSummary])} className="mt-4" />
                                </div>
                            </div>
                        </TabsContent>
                    </CardContent>
                </Tabs>
                <CardFooter className="flex justify-end items-center border-t pt-6">
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => handleSaveRequest(true)} disabled={saveStatus === 'saving' || isLocked}>
                            {saveStatus === 'saving' ? (<Loader className="mr-2 h-4 w-4 animate-spin"/>) : null}
                            Save as Draft
                        </Button>
                        <Button className="shadow-lg shadow-primary/20" onClick={() => handleSaveRequest(false)} disabled={saveStatus === 'saving' || isLocked}>
                            {saveStatus === 'saving' ? (<Loader className="mr-2 h-4 w-4 animate-spin"/>) : <Check className="mr-2 h-4 w-4" />}
                            Submit Emergency Request
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

