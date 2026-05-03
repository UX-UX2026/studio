'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef, Fragment } from "react";
import { Loader, Trash2, History, ChevronDown, Upload, Download, FileSpreadsheet, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc, orderBy } from "firebase/firestore";
import type { ApprovalRequest, RecurringItem, BudgetItem, Department, Company, ApprovalItem, AppMetadata } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SubmissionClient } from "@/components/app/submission-client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { format, addMonths } from "date-fns";
import { useBudgetSummary } from "@/hooks/use-budget-summary";
import { RecurringClient } from "@/components/app/recurring-client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { procurementCategories } from "@/lib/procurement-categories";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export default function ProcurementQuickSubmitPage() {
    const { user, profile, role, department: userDepartment, reportingDepartments, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [draftItems, setDraftItems] = useState<ApprovalItem[]>([]);
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [archiveReason, setArchiveReason] = useState('');
    const [isArchiveCurrentDialogOpen, setIsArchiveCurrentDialogOpen] = useState(false);
    const [previousSubmissionToLoad, setPreviousSubmissionToLoad] = useState<string | null>(null);
    const [isLoadConfirmDialogOpen, setIsLoadConfirmDialogOpen] = useState(false);

    const lastLoadedKey = useRef<string>('');

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
    
    const previousSubmissionsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(collection(firestore, 'procurementRequests'), where('departmentId', '==', selectedDepartmentId), where('status', 'in', ['Completed', 'Approved', 'In Fulfillment']), orderBy('updatedAt', 'desc'));
    }, [firestore, selectedDepartmentId]);
    const { data: previousSubmissions } = useCollection<ApprovalRequest>(previousSubmissionsQuery);

    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata } = useDoc<AppMetadata>(appMetadataRef);

    const associatedCompanies = useMemo(() => {
        if (!selectedDepartmentId || !departments || !companies) return [];
        const dept = departments.find(d => d.id === selectedDepartmentId);
        if (!dept || !dept.companyIds) return [];
        return companies.filter(c => dept.companyIds!.includes(c.id));
    }, [selectedDepartmentId, departments, companies]);

    const departmentName = useMemo(() => {
        if (!departments || !selectedDepartmentId) return 'Unassigned';
        return departments.find(d => d.id === selectedDepartmentId)?.name || 'Unassigned';
    }, [selectedDepartmentId, departments]);

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
        for (let i = 0; i < 18; i++) p.push(format(addMonths(now, i), "MMMM yyyy"));
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

    // Rule detection logic
    const categoryIssues = useMemo(() => {
        if (!appMetadata?.budgetRules) return [];
        const { 
            overSpendType, overSpendAllowedPercentage, overSpendAllowedAmount, 
            underSpendType, underSpendAlertPercentage, underSpendAlertAmount 
        } = appMetadata.budgetRules;
        
        const allLines = [...operationalSummary.lines, ...capitalSummary.lines];

        return allLines.map(line => {
            const overageAmt = line.procurementTotal - line.forecastTotal;
            const overagePct = line.forecastTotal > 0 ? (overageAmt / line.forecastTotal) * 100 : 0;

            const underageAmt = line.forecastTotal - line.procurementTotal;
            const underagePct = line.forecastTotal > 0 ? (underageAmt / line.forecastTotal) * 100 : 0;

            if (overageAmt > 0) {
                const isOver = overSpendType === 'percentage' 
                    ? overagePct > (overSpendAllowedPercentage || 0)
                    : overageAmt > (overSpendAllowedAmount || 0);

                if (isOver) {
                    return { category: line.category, type: 'critical', message: `Budget Exceeded: ${line.category} is over by ${formatCurrency(overageAmt)} (${overagePct.toFixed(1)}%)` };
                }
            }

            if (underageAmt > 0) {
                const isUnder = underSpendType === 'percentage'
                    ? underagePct > (underSpendAlertPercentage || 0)
                    : underageAmt > (underSpendAlertAmount || 0);

                if (isUnder) {
                    return { category: line.category, type: 'warning', message: `Under Budget Alert: ${line.category} is under by ${formatCurrency(underageAmt)} (${underagePct.toFixed(1)}%)` };
                }
            }
            return null;
        }).filter(Boolean);
    }, [operationalSummary, capitalSummary, appMetadata]);

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
            toast({ title: isDraft ? "Draft Saved" : "Submitted" });
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e: any) { 
            setSaveStatus('idle'); 
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message }); 
        }
    };

    const downloadTemplate = () => {
        const headers = ["type", "expenseType", "description", "brand", "qty", "category", "unitPrice", "comments"];
        const sampleData = [
            ["One-Off", "Operational", "Sample Laptop", "Dell", "1", "IT Hardware", "15000", "Replacement for staff"],
            ["One-Off", "Capital", "Office AC Unit", "Samsung", "2", "Hardware Purchase", "8500", "New wing install"]
        ];
        
        const csvContent = [headers.join(","), ...sampleData.map(row => row.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "procurement_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) throw new Error("File is empty.");

                const importedItems: ApprovalItem[] = jsonData.map((row, index) => ({
                    id: Date.now() + index,
                    type: (row.type as any) || "One-Off",
                    expenseType: (row.expenseType as any) || "Operational",
                    description: String(row.description || ""),
                    brand: String(row.brand || ""),
                    qty: parseInt(row.qty) || 1,
                    category: String(row.category || "Uncategorized"),
                    unitPrice: parseFloat(row.unitPrice) || 0,
                    fulfillmentStatus: 'Pending',
                    receivedQty: 0,
                    fulfillmentComments: [],
                    comments: String(row.comments || ""),
                    addedById: user!.uid,
                    addedByName: profile?.displayName || user!.email || "Imported User"
                }));

                setDraftItems(prev => [...prev, ...importedItems]);
                toast({ title: "Import Successful", description: `Added ${importedItems.length} items to your draft.` });
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Import Failed', description: err.message });
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    if (userLoading || deptsLoading || recurringLoading || periodRequestsLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader className="animate-spin" />
            </div>
        );
    }

    const opProg = operationalSummary.totals.forecast > 0 ? (operationalSummary.totals.procurement / operationalSummary.totals.forecast) * 100 : 0;
    const capProg = capitalSummary.totals.forecast > 0 ? (capitalSummary.totals.procurement / capitalSummary.totals.forecast) * 100 : 0;

    return (
        <div className="space-y-6">
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleImportFile} />
            
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Procurement Quick Submit</CardTitle>
                        <CardDescription>Manage your department's requests with powerful import tools.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                            <Download className="h-4 w-4" /> Template
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                            <Upload className="h-4 w-4" /> Import Sheet
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 items-end gap-4">
                        <div className="grid gap-1.5"><Label>Department</Label><Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{departmentsForUser.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-1.5"><Label>Company</Label><Select value={selectedCompanyId} onValueChange={setSelectedCompanyId} disabled={isLocked || associatedCompanies.length === 0}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{associatedCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-1.5"><Label>Period</Label><Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={!selectedDepartmentId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{openPeriods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-1.5"><Label>History</Label><Select onValueChange={v => { setPreviousSubmissionToLoad(v); setIsLoadConfirmDialogOpen(true); }} disabled={isLocked}><SelectTrigger><SelectValue placeholder="Load Past" /></SelectTrigger><SelectContent>{previousSubmissions?.map(s => <SelectItem key={s.id} value={s.id}>{s.period}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                </CardContent>
            </Card>

            {categoryIssues.length > 0 && (
                <div className="space-y-2">
                    {categoryIssues.map((issue, idx) => (
                        <div key={idx} className={cn("p-4 rounded-lg flex items-center gap-3 border", 
                            issue?.type === 'critical' ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
                        )}>
                            {issue?.type === 'critical' ? <AlertCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                            <span className="text-sm font-semibold">{issue?.message}</span>
                        </div>
                    ))}
                </div>
            )}

            <Card>
                <Collapsible><CollapsibleTrigger className="w-full p-5 flex items-center justify-between rounded-t-lg hover:bg-muted/50"><div><CardTitle className="flex items-center gap-2"><History />Monthly Recurring List</CardTitle></div><ChevronDown /></CollapsibleTrigger><CollapsibleContent className="border-t p-5"><RecurringClient items={recurringItems || []} view="list" categories={departmentCategories} /></CollapsibleContent></Collapsible>
            </Card>

            <Card>
                <Tabs defaultValue="submission">
                    <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Submission Items</CardTitle><TabsList><TabsTrigger value="submission">Items</TabsTrigger><TabsTrigger value="summary">Summary</TabsTrigger></TabsList></CardHeader>
                    <CardContent>
                        <TabsContent value="submission"><SubmissionClient user={user!} profile={profile} userRole={role!} items={draftItems} setItems={setDraftItems} isLocked={isLocked} recurringItems={recurringItems} recurringLoading={recurringLoading} departmentId={selectedDepartmentId} departmentName={departmentName} budgetItems={budgetItems} /></TabsContent>
                        <TabsContent value="summary" className="space-y-4">
                            <div className="p-4 border rounded-lg bg-muted/50"><div className="flex justify-between"><div>Operational Impact</div><div className="font-bold">{formatCurrency(operationalSummary.totals.procurement)}</div></div><Progress value={opProg} className="mt-2" /></div>
                            <div className="p-4 border rounded-lg bg-muted/50"><div className="flex justify-between"><div>Capital Impact</div><div className="font-bold">{formatCurrency(capitalSummary.totals.procurement)}</div></div><Progress value={capProg} className="mt-2" /></div>
                        </TabsContent>
                    </CardContent>
                </Tabs>
                <CardFooter className="flex justify-between items-center border-t pt-6">
                    <div>{isLocked && <div className="text-yellow-800 text-sm font-medium">Submission is locked.</div>}</div>
                    <div className="flex gap-3">
                        <Button variant="destructive" onClick={() => setIsArchiveCurrentDialogOpen(true)} disabled={!editingRequestId || isLocked}><Trash2 className="mr-2 h-4 w-4" />Archive</Button>
                        <Button variant="ghost" onClick={() => handleSaveRequest(true)} disabled={saveStatus === 'saving' || isLocked}>{saveStatus === 'saving' && <Loader className="mr-2 h-4 w-4 animate-spin"/>}Save Draft</Button>
                        <Button onClick={() => handleSaveRequest(false)} disabled={saveStatus === 'saving' || isLocked}>Submit For Approval</Button>
                    </div>
                </CardFooter>
            </Card>
            
            <Dialog open={isArchiveCurrentDialogOpen} onOpenChange={setIsArchiveCurrentDialogOpen}><DialogContent><DialogHeader><DialogTitle>Archive Draft?</DialogTitle></DialogHeader><Textarea placeholder="Reason" value={archiveReason} onChange={e => setArchiveReason(e.target.value)} /><DialogFooter><Button variant="destructive" onClick={async () => { if (!editingRequestId) return; await updateDoc(doc(firestore, 'procurementRequests', editingRequestId), { status: 'Archived', updatedAt: serverTimestamp() }); setEditingRequestId(null); setDraftItems([]); setIsArchiveCurrentDialogOpen(false); }}>Confirm Archive</Button></DialogFooter></DialogContent></Dialog>
            <AlertDialog open={isLoadConfirmDialogOpen} onOpenChange={setIsLoadConfirmDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Load Items?</AlertDialogTitle><AlertDialogDescription>This replaces your current list.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { const sub = previousSubmissions?.find(s => s.id === previousSubmissionToLoad); if (sub) setDraftItems(sub.items.map(i => ({ ...i, id: Date.now() + Math.random(), receivedQty: 0, fulfillmentStatus: 'Pending' }))); setIsLoadConfirmDialogOpen(false); }}>Load</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
    );
}
