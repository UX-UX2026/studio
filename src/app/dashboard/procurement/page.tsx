'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef, Fragment } from "react";
import { 
    Loader, 
    Trash2, 
    History, 
    ChevronDown, 
    Upload, 
    Download, 
    FileSpreadsheet, 
    AlertTriangle, 
    AlertCircle, 
    Info, 
    Check, 
    Save, 
    FileUp, 
    FileText 
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
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
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const lastLoadedKey = useRef<string>('');

    const departmentsQuery = useMemo(() => firestore ? collection(firestore, 'departments') : null, [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const companiesQuery = useMemo(() => firestore ? collection(firestore, 'companies') : null, [firestore]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);

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

    const appMetadataRef = useMemo(() => firestore ? doc(firestore, 'app', 'metadata') : null, [firestore]);
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
            ["Recurring", "Operational", "Internet Subscription", "Telkom", "1", "Connectivity", "1500", "Monthly core fiber"],
            ["Recurring", "Operational", "Office Cleaning", "CleanCo", "1", "Facilities Maintenance - SA", "4500", "Weekly services"],
            ["One-Off", "Operational", "Sample Laptop", "Dell", "1", "IT Hardware", "15000", "Replacement for staff"],
            ["One-Off", "Capital", "Office AC Unit", "Samsung", "2", "Hardware Purchase", "8500", "New wing install"]
        ];
        
        const csvContent = [headers.join(","), ...sampleData.map(row => row.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "procureease_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportFile = (event: React.ChangeEvent<HTMLInputElement> | FileList) => {
        let files: FileList | null = null;
        if ('target' in event) {
            files = event.target.files;
        } else {
            files = event;
        }
        
        const file = files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) throw new Error("File is empty.");

                const importedItems: ApprovalItem[] = jsonData.map((row, index) => {
                    const type = (String(row.type || '').toLowerCase().startsWith('rec')) ? "Recurring" : "One-Off";
                    const expenseType = (String(row.expenseType || '').toLowerCase().startsWith('cap')) ? "Capital" : "Operational";
                    
                    return {
                        id: Date.now() + index + Math.random(),
                        type,
                        expenseType,
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
                    };
                });

                setDraftItems(prev => [...prev, ...importedItems]);
                toast({ title: "Import Successful", description: `Added ${importedItems.length} items to your draft.` });
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Import Failed', description: err.message });
            } finally {
                if ('target' in event && event.target) event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (isLocked) return;
        handleImportFile(e.dataTransfer.files);
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
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleImportFile} />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Quick Submit</h1>
                    <p className="text-muted-foreground">Import items and submit your departmental request in seconds.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                        <Download className="h-4 w-4" /> Template
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/procurement/history')} className="gap-2">
                        <History className="h-4 w-4" /> History
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card 
                        className={cn(
                            "relative border-2 border-dashed transition-all cursor-pointer group",
                            isDraggingOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50",
                            isLocked && "opacity-50 cursor-not-allowed"
                        )}
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                        onDragLeave={() => setIsDraggingOver(false)}
                        onDrop={onDrop}
                        onClick={() => !isLocked && fileInputRef.current?.click()}
                    >
                        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                            <div className="mb-4 rounded-full bg-primary/10 p-4 group-hover:scale-110 transition-transform">
                                <FileUp className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold">Import Submission Sheet</h3>
                            <p className="text-muted-foreground mt-2 max-w-sm">
                                Drag and drop your .csv or .xlsx file here to bulk-add One-Off and Recurring items.
                            </p>
                            {!isLocked && (
                                <Button variant="secondary" className="mt-6">
                                    Select File from Computer
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {categoryIssues.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">Budget Alerts</h4>
                            {categoryIssues.map((issue, idx) => (
                                <div key={idx} className={cn("p-4 rounded-lg flex items-center gap-3 border animate-in fade-in slide-in-from-top-2", 
                                    issue?.type === 'critical' ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
                                )}>
                                    {issue?.type === 'critical' ? <AlertCircle className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
                                    <span className="text-sm font-semibold">{issue?.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" /> 
                                Submission Workspace
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Tabs defaultValue="submission">
                                <div className="px-6 border-b">
                                    <TabsList className="bg-transparent border-0 h-12">
                                        <TabsTrigger value="submission" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full">Line Items ({draftItems.length})</TabsTrigger>
                                        <TabsTrigger value="recurring" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full">Master Recurring List</TabsTrigger>
                                    </TabsList>
                                </div>
                                <TabsContent value="submission" className="m-0">
                                    <div className="p-6">
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
                                    </div>
                                </TabsContent>
                                <TabsContent value="recurring" className="m-0">
                                    <div className="p-6">
                                        <div className="mb-4 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground flex gap-3">
                                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                            These items are defined in your department's master list and are automatically included in every new submission.
                                        </div>
                                        <RecurringClient items={recurringItems || []} view="list" categories={departmentCategories} />
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="sticky top-20 shadow-lg border-primary/10 overflow-hidden">
                        <div className="h-1.5 bg-primary w-full" />
                        <CardHeader className="pb-2 bg-muted/20">
                            <CardTitle>Submission Details</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-4">
                                <div className="grid gap-1.5">
                                    <Label>Department</Label>
                                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                                        <SelectTrigger className="bg-background"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>{departmentsForUser.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Legal Entity / Company</Label>
                                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId} disabled={isLocked || associatedCompanies.length === 0}>
                                        <SelectTrigger className="bg-background"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>{associatedCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Procurement Period</Label>
                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={!selectedDepartmentId}>
                                        <SelectTrigger className="bg-background"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>{openPeriods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Quick Restore</Label>
                                    <Select onValueChange={v => { setPreviousSubmissionToLoad(v); setIsLoadConfirmDialogOpen(true); }} disabled={isLocked}>
                                        <SelectTrigger className="bg-background"><SelectValue placeholder="Restore Previous Items" /></SelectTrigger>
                                        <SelectContent>{previousSubmissions?.map(s => <SelectItem key={s.id} value={s.id}>{s.period}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <span className="text-sm font-semibold uppercase text-muted-foreground">Grand Total</span>
                                    <span className="text-2xl font-black text-primary">{formatCurrency(draftItems.reduce((a, i) => a + i.qty * i.unitPrice, 0))}</span>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span>Operational Budget</span>
                                        <span className={cn(opProg > 100 ? "text-red-600" : "text-green-600")}>{Math.round(opProg)}%</span>
                                    </div>
                                    <Progress value={opProg} className={cn("h-1.5", opProg > 100 ? "bg-red-100" : "")} />
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span>Capital Budget</span>
                                        <span className={cn(capProg > 100 ? "text-red-600" : "text-green-600")}>{Math.round(capProg)}%</span>
                                    </div>
                                    <Progress value={capProg} className={cn("h-1.5", capProg > 100 ? "bg-red-100" : "")} />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/30 flex flex-col gap-2 pt-6">
                            <Button className="w-full shadow-md" size="lg" onClick={() => handleSaveRequest(false)} disabled={saveStatus === 'saving' || isLocked}>
                                {saveStatus === 'saving' ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                                Submit For Approval
                            </Button>
                            <Button variant="ghost" className="w-full text-xs" onClick={() => handleSaveRequest(true)} disabled={saveStatus === 'saving' || isLocked}>
                                {saveStatus === 'saving' ? "Saving..." : "Save Draft"}
                            </Button>
                            {isLocked && <p className="text-[10px] text-center text-amber-800 font-bold uppercase tracking-widest mt-2">Locked for Submission</p>}
                        </CardFooter>
                    </Card>
                    
                    {editingRequestId && (
                        <Button variant="outline" className="w-full text-destructive border-destructive/20 hover:bg-destructive/5" onClick={() => setIsArchiveCurrentDialogOpen(true)} disabled={isLocked}>
                            <Trash2 className="mr-2 h-4 w-4" /> Move to Recycle Bin
                        </Button>
                    )}
                </div>
            </div>
            
            <Dialog open={isArchiveCurrentDialogOpen} onOpenChange={setIsArchiveCurrentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Archive Draft?</DialogTitle>
                        <DialogDescription>The submission will be moved to the recycle bin. You can restore it later if needed.</DialogDescription>
                    </DialogHeader>
                    <Textarea placeholder="Optional: Reason for archiving..." value={archiveReason} onChange={e => setArchiveReason(e.target.value)} rows={3} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsArchiveCurrentDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={async () => { if (!editingRequestId) return; await updateDoc(doc(firestore, 'procurementRequests', editingRequestId), { status: 'Archived', updatedAt: serverTimestamp() }); setEditingRequestId(null); setDraftItems([]); setIsArchiveCurrentDialogOpen(false); }}>Confirm Archive</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <AlertDialog open={isLoadConfirmDialogOpen} onOpenChange={setIsLoadConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Replace Current Items?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will clear your current submission list and replace it with items from your {previousSubmissions?.find(s => s.id === previousSubmissionToLoad)?.period} submission. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { 
                            const sub = previousSubmissions?.find(s => s.id === previousSubmissionToLoad); 
                            if (sub) setDraftItems(sub.items.map(i => ({ ...i, id: Date.now() + Math.random(), receivedQty: 0, fulfillmentStatus: 'Pending', addedById: user!.uid, addedByName: profile?.displayName || user!.email || 'User' }))); 
                            setIsLoadConfirmDialogOpen(false); 
                        }}>
                            Load Previous Items
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
