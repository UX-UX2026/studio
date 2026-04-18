
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Loader, Banknote, Upload, Download, AlertCircle, History, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, getDocs, query, where, serverTimestamp, writeBatch } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { logErrorToFirestore } from "@/lib/error-logger";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BudgetItem } from "@/lib/approvals-mock-data";

type Department = {
    id: string;
    name: string;
    budgetHeaders?: string[];
    budgetYear?: number;
};

type BudgetUpload = {
    id: string;
    departmentId: string;
    departmentName: string;
    financialYear: number;
    uploadedAt: { seconds: number, nanoseconds: number };
    uploadedById: string;
    uploadedByName: string;
    monthHeaders: string[];
    isActive: boolean;
    uploadType: 'Operational' | 'Capital';
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
};

export default function BudgetPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [financialYear, setFinancialYear] = useState<number>(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState<'Operational' | 'Capital'>('Operational');

    // State for mapping dialog
    const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
    const [originalFileData, setOriginalFileData] = useState<any[][]>([]);
    const [headerRow, setHeaderRow] = useState(1);
    const [startRow, setStartRow] = useState(2);
    const [endRow, setEndRow] = useState(0);
    const [isImporting, setIsImporting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [columnMappings, setColumnMappings] = useState<{
        category: string;
        yearTotal: string;
        forecastStart: string;
    }>({ category: '', yearTotal: '', forecastStart: '' });
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    // State for delete dialog
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null);

    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const budgetUploadsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(
            collection(firestore, 'budgetUploads'), 
            where('departmentId', '==', selectedDepartmentId), 
            where('financialYear', '==', financialYear),
            where('uploadType', '==', activeTab)
        );
    }, [firestore, selectedDepartmentId, financialYear, activeTab]);
    const { data: budgetUploads, loading: uploadsLoading } = useCollection<BudgetUpload>(budgetUploadsQuery);

    const activeUpload = useMemo(() => {
        return budgetUploads?.find(u => u.isActive) || null;
    }, [budgetUploads]);
    
    const budgetsQuery = useMemo(() => {
        if (!firestore || !activeUpload) return null;
        return query(collection(firestore, 'budgets'), where('budgetUploadId', '==', activeUpload.id));
    }, [firestore, activeUpload]);
    const { data: budgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);

     useEffect(() => {
        const allowedRoles = ['Administrator', 'Procurement Officer'];
        if (userLoading) return;
        if (!user) {
          router.push('/dashboard');
          return;
        }
        if (role && !allowedRoles.includes(role)) {
          router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);
    
    const loading = userLoading || deptsLoading || uploadsLoading || (!!activeUpload && budgetsLoading);
    
    const selectedDepartment = useMemo(() => {
        return departments?.find(d => d.id === selectedDepartmentId);
    }, [selectedDepartmentId, departments]);

    useEffect(() => {
        if (selectedDepartment) {
            setFinancialYear(selectedDepartment.budgetYear || new Date().getFullYear());
        }
    }, [selectedDepartment]);


    const monthHeaders = useMemo(() => {
        return activeUpload?.monthHeaders || [];
    }, [activeUpload]);

    const selectedDepartmentName = selectedDepartment?.name || '';

    const { derivedHeaders, derivedPreview, dataRowsForImport } = useMemo(() => {
        if (!originalFileData || originalFileData.length === 0 || headerRow === 0) {
            return { derivedHeaders: [], derivedPreview: [], dataRowsForImport: [] };
        }

        const headerRowIndex = headerRow > 0 ? headerRow - 1 : 0;
        if (headerRowIndex >= originalFileData.length) {
            return { derivedHeaders: [], derivedPreview: [], dataRowsForImport: [] };
        }

        const rawHeaders = originalFileData[headerRowIndex];
        const headers = (rawHeaders as any[]).map(h => {
            if (h === null || h === undefined) return "";
            if (h instanceof Date) {
                return format(h, "MMM yy");
            }
            return String(h);
        });

        const dataStartIndex = startRow > 0 ? startRow - 1 : headerRowIndex + 1;
        const dataEndIndex = endRow > 0 ? endRow : originalFileData.length;
        const dataRows = originalFileData.slice(dataStartIndex, dataEndIndex);

        const previewRows = dataRows.map(row => row.map(cell => {
            if (cell === null || cell === undefined) return "";
            if (cell instanceof Date) {
                return format(cell, "yyyy-MM-dd");
            }
            if (typeof cell === 'number') {
                return cell.toLocaleString();
            }
            return String(cell);
        }));

        return {
            derivedHeaders: headers,
            derivedPreview: previewRows,
            dataRowsForImport: dataRows,
        };
    }, [originalFileData, headerRow, startRow, endRow]);

    useEffect(() => {
        if (derivedHeaders.length === 0) return;

        const guessMapping = (h: string | number) => {
            if (!h) return null;
            const lowerH = String(h).toLowerCase().trim();
            if (['category', 'line item', 'description', 'expenses'].includes(lowerH)) return 'category';
            if (['yeartotal', 'year total', 'total'].includes(lowerH)) return 'yearTotal';
            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            if (monthNames.some(m => lowerH.startsWith(m))) return 'forecast';
            return null;
        }

        let initialMappings = { category: '', yearTotal: '', forecastStart: '' };
        const forecastColumns: string[] = [];

        derivedHeaders.forEach(h => {
            if (!h) return;
            const mapping = guessMapping(h);
            const stringH = String(h);
            if (mapping === 'category' && !initialMappings.category) {
                initialMappings.category = stringH;
            } else if (mapping === 'yearTotal' && !initialMappings.yearTotal) {
                initialMappings.yearTotal = stringH;
            } else if (mapping === 'forecast') {
                forecastColumns.push(stringH);
            }
        });
        
        if (forecastColumns.length > 0) {
            initialMappings.forecastStart = forecastColumns[0];
        }

        setColumnMappings(initialMappings);
    }, [derivedHeaders]);

    const handleImportClick = () => {
        if (!selectedDepartmentId) {
            toast({ variant: 'destructive', title: 'No Department Selected', description: 'Please select a department before importing.' });
            return;
        }
        if (!financialYear) {
            toast({ variant: 'destructive', title: 'Financial Year Not Set', description: 'Please set a financial year before importing.' });
            return;
        }
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (!budgetItems || budgetItems.length === 0) {
            toast({ title: "No Data to Export", description: "There is no budget data to export for this department and type." });
            return;
        }
        
        const exportMonthHeaders = activeUpload?.monthHeaders || [];
        const headers = ['category', ...exportMonthHeaders, 'yearTotal'];
        
        const csvContent = [
            headers.join(','),
            ...budgetItems.map(item => {
                const forecastData = item.forecasts.map(f => `"${f}"`).join(',');
                return `"${item.category}",${forecastData},"${item.yearTotal}"`;
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `budget_${selectedDepartmentName.replace(/ /g, '_')}_${financialYear}_${activeTab}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!selectedDepartmentId) {
            toast({ variant: 'destructive', title: 'No Department Selected', description: 'Please select a department before importing.' });
            return;
        }
        if (!financialYear) {
            toast({ variant: 'destructive', title: 'Financial Year Not Set', description: 'Please set a financial year before importing.' });
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false, raw: false });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];

                const allData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false, cellDates: true } as any);
                
                const hiddenRowIndices = new Set<number>();
                if (worksheet['!rows']) {
                    worksheet['!rows'].forEach((row, i) => {
                        if (row && row.hidden) hiddenRowIndices.add(i);
                    });
                }

                const hiddenColIndices = new Set<number>();
                if (worksheet['!cols']) {
                    worksheet['!cols'].forEach((col, i) => {
                        if (col && col.hidden) hiddenColIndices.add(i);
                    });
                }
                
                const visibleData = allData
                    .filter((_, i) => !hiddenRowIndices.has(i))
                    .map(row => row.filter((_, i) => !hiddenColIndices.has(i)));
                
                setOriginalFileData(visibleData);

                setHeaderRow(1);
                setStartRow(2);
                setEndRow(visibleData.length);
                
                setIsMappingDialogOpen(true);

            } catch (error: any) {
                console.error("File Parsing Error:", error);
                toast({ variant: "destructive", title: "Import Failed", description: error.message || "Could not parse the file." });
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    
        if (!selectedDepartmentId) {
            toast({ variant: 'destructive', title: 'No Department Selected', description: 'Please select a department before importing.' });
            return;
        }
        if (!financialYear) {
            toast({ variant: 'destructive', title: 'Financial Year Not Set', description: 'Please set a financial year before importing.' });
            return;
        }
        
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const syntheticEvent = {
                target: {
                    files: files
                }
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            handleFileChange(syntheticEvent);
        }
    };
    
    const handleConfirmImport = async () => {
        if (!user || !firestore) return;
        setIsImporting(true);
        const action = 'budget.import_revision';

        const parseNumericValue = (value: any): number => {
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const cleanedValue = value.replace(/[^0-9.-]+/g, "");
                if (cleanedValue === "") return 0;
                const parsedValue = parseFloat(cleanedValue);
                return isNaN(parsedValue) ? 0 : parsedValue;
            }
            return 0;
        };

        try {
            if (headerRow >= startRow) throw new Error('Header row must be before the start data row.');
            if (startRow > endRow && endRow !== 0) throw new Error('Start data row cannot be after end row.');

            const { category, yearTotal, forecastStart } = columnMappings;
            const stringifiedHeaders = derivedHeaders.map(h => String(h));
            const categoryIndex = stringifiedHeaders.indexOf(category);
            const yearTotalIndex = yearTotal ? stringifiedHeaders.indexOf(yearTotal) : -1;
            const forecastStartIndex = stringifiedHeaders.indexOf(forecastStart);
            
            if (categoryIndex === -1 || forecastStartIndex === -1) throw new Error("Please map 'Category' and 'First Forecast Month' columns.");
            if (forecastStartIndex + 11 >= stringifiedHeaders.length) throw new Error("Not enough columns for a 12-month forecast starting from your selection.");

            const newMonthHeaders = derivedHeaders.slice(forecastStartIndex, forecastStartIndex + 12);
            const forecastIndices = Array.from({ length: 12 }, (_, i) => forecastStartIndex + i);

            const newItems = dataRowsForImport.map(row => {
                const categoryValue = row[categoryIndex] ? String(row[categoryIndex]).trim() : '';
                if (!categoryValue) return null;
                const forecasts = forecastIndices.map(index => parseNumericValue(row[index]));
                const yearTotalValue = (yearTotalIndex !== -1) ? parseNumericValue(row[yearTotalIndex]) : forecasts.reduce((sum, current) => sum + current, 0);
                return { departmentId: selectedDepartmentId, departmentName: selectedDepartmentName, category: categoryValue, forecasts, yearTotal: yearTotalValue, expenseType: activeTab };
            }).filter(Boolean);
            
            const batch = writeBatch(firestore);
            const activeUploadsQuery = query(collection(firestore, 'budgetUploads'), where('departmentId', '==', selectedDepartmentId), where('financialYear', '==', financialYear), where('isActive', '==', true), where('uploadType', '==', activeTab));
            const activeUploadsSnapshot = await getDocs(activeUploadsQuery);
            activeUploadsSnapshot.forEach(doc => batch.update(doc.ref, { isActive: false }));

            const newUploadRef = doc(collection(firestore, 'budgetUploads'));
            const newUploadData: Omit<BudgetUpload, 'id'> = {
                departmentId: selectedDepartmentId,
                departmentName: selectedDepartmentName,
                financialYear: financialYear,
                uploadedAt: serverTimestamp() as any,
                uploadedById: user.uid,
                uploadedByName: user.displayName || 'N/A',
                monthHeaders: newMonthHeaders,
                isActive: true,
                uploadType: activeTab,
            };
            batch.set(newUploadRef, newUploadData);

            const budgetsCollectionRef = collection(firestore, 'budgets');
            newItems.forEach(item => {
                const newDocRef = doc(budgetsCollectionRef);
                batch.set(newDocRef, { ...item, budgetUploadId: newUploadRef.id });
            });

            // Only update department if it's an operational budget to avoid overwriting with capital headers
            if (activeTab === 'Operational') {
                const deptRef = doc(firestore, 'departments', selectedDepartmentId);
                batch.update(deptRef, { budgetHeaders: newMonthHeaders, budgetYear: financialYear });
            }

            await batch.commit();

            toast({ title: "Import Successful", description: `${newItems.length} ${activeTab.toLowerCase()} budget items were imported for ${selectedDepartmentName}.` });
            setIsMappingDialogOpen(false);
            await addDoc(collection(firestore, 'auditLogs'), { userId: user.uid, userName: user.displayName, action, details: `Imported new ${activeTab.toLowerCase()} budget version for ${selectedDepartmentName} - FY${financialYear}.`, entity: { type: 'department', id: selectedDepartmentId }, timestamp: serverTimestamp() });
        } catch (error: any) {
             console.error("Budget Import Error:", error);
             toast({ variant: "destructive", title: "Import Failed", description: error.message || "An unknown error occurred during the import process. Check console for details." });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: user.displayName, action, errorMessage: error.message, errorStack: error.stack });
        } finally {
            setIsImporting(false);
        }
    };
    
    const handleSetActive = async (uploadIdToActivate: string) => {
        if (!user || !firestore || !budgetUploads) return;
        setIsSaving(true);
        const action = 'budget.activate_revision';
        
        try {
            const batch = writeBatch(firestore);
            budgetUploads.forEach(upload => batch.update(doc(firestore, 'budgetUploads', upload.id), { isActive: false }));
            const newActiveUploadRef = doc(firestore, 'budgetUploads', uploadIdToActivate);
            batch.update(newActiveUploadRef, { isActive: true });
            
            const newActiveUploadData = budgetUploads.find(u => u.id === uploadIdToActivate);
            if (newActiveUploadData && newActiveUploadData.uploadType === 'Operational') {
                const deptRef = doc(firestore, 'departments', selectedDepartmentId);
                batch.update(deptRef, { budgetHeaders: newActiveUploadData.monthHeaders, budgetYear: newActiveUploadData.financialYear });
            }

            await batch.commit();
            toast({ title: "Budget Version Activated", description: "The selected budget is now active for this type." });
            await addDoc(collection(firestore, 'auditLogs'), { userId: user.uid, userName: user.displayName, action, details: `Activated ${activeTab} budget version for ${selectedDepartmentName} - FY${financialYear}.`, entity: { type: 'department', id: selectedDepartmentId }, timestamp: serverTimestamp() });
        } catch (error: any) {
            console.error("Budget Activation Error:", error);
            toast({ variant: "destructive", title: "Activation Failed", description: error.message });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: user.displayName, action, errorMessage: error.message, errorStack: error.stack });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteUpload = async () => {
        if (!user || !firestore || !deletingUploadId) return;

        const uploadToDelete = budgetUploads?.find(u => u.id === deletingUploadId);
        if (!uploadToDelete || uploadToDelete.isActive) {
            toast({ variant: 'destructive', title: 'Cannot Delete', description: 'Active budgets cannot be deleted.' });
            setIsDeleteDialogOpen(false);
            return;
        }

        setIsSaving(true);
        const action = 'budget.delete_revision';

        try {
            const batch = writeBatch(firestore);
            const budgetItemsQuery = query(collection(firestore, 'budgets'), where('budgetUploadId', '==', deletingUploadId));
            const budgetItemsSnapshot = await getDocs(budgetItemsQuery);
            budgetItemsSnapshot.forEach(doc => batch.delete(doc.ref));
            const uploadRef = doc(firestore, 'budgetUploads', deletingUploadId);
            batch.delete(uploadRef);
            await batch.commit();

            toast({ title: 'Budget Version Deleted', description: `Successfully deleted upload from ${uploadToDelete.uploadedByName}.` });
            await addDoc(collection(firestore, 'auditLogs'), { userId: user.uid, userName: user.displayName, action, details: `Deleted budget upload ${deletingUploadId} for ${uploadToDelete.departmentName} - FY${uploadToDelete.financialYear}.`, entity: { type: 'budgetUpload', id: deletingUploadId }, timestamp: serverTimestamp() });
        } catch (error: any) {
            console.error("Delete Budget Upload Error:", error);
            toast({ variant: "destructive", title: "Delete Failed", description: error.message });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: user.displayName, action, errorMessage: error.message, errorStack: error.stack });
        } finally {
            setIsSaving(false);
            setDeletingUploadId(null);
            setIsDeleteDialogOpen(false);
        }
    };

    const allowedRoles = useMemo(() => ['Administrator', 'Procurement Officer'], []);
    if (userLoading || !user || !role || !allowedRoles.includes(role)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <>
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} />
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Banknote className="h-6 w-6 text-primary" />
                            Budget Integration by Department
                        </CardTitle>
                        <CardDescription>
                            Import, view, and manage departmental budget forecasts for Operational and Capital expenses.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6 flex flex-wrap items-center gap-4 p-4 border rounded-lg bg-muted/50">
                            <div className="grid gap-1.5">
                                <Label htmlFor="department-select">Department</Label>
                                <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                                    <SelectTrigger className="w-[250px] bg-background" id="department-select">
                                        <SelectValue placeholder={deptsLoading ? "Loading..." : "Select a department"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments?.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="financial-year">Financial Year</Label>
                                <Input id="financial-year" type="number" value={financialYear} onChange={(e) => setFinancialYear(parseInt(e.target.value, 10))} className="w-[120px] bg-background" placeholder="e.g., 2026" disabled={!selectedDepartmentId} />
                            </div>
                        </div>

                         <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="Operational">Operational Budget</TabsTrigger>
                                <TabsTrigger value="Capital">Capital Budget</TabsTrigger>
                            </TabsList>
                            <TabsContent value="Operational" className="space-y-6 pt-6">
                                <BudgetTabContent 
                                    handleDragLeave={handleDragLeave}
                                    handleDragOver={handleDragOver}
                                    handleDrop={handleDrop}
                                    handleImportClick={handleImportClick}
                                    handleExport={handleExport}
                                    isDraggingOver={isDraggingOver}
                                    loading={loading}
                                    budgetItems={budgetItems}
                                    budgetUploads={budgetUploads}
                                    uploadsLoading={uploadsLoading}
                                    monthHeaders={monthHeaders}
                                    selectedDepartmentId={selectedDepartmentId}
                                    selectedDepartmentName={selectedDepartmentName}
                                    financialYear={financialYear}
                                    handleSetActive={handleSetActive}
                                    isSaving={isSaving}
                                    setDeletingUploadId={setDeletingUploadId}
                                    setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                                />
                            </TabsContent>
                             <TabsContent value="Capital" className="space-y-6 pt-6">
                                <BudgetTabContent 
                                    handleDragLeave={handleDragLeave}
                                    handleDragOver={handleDragOver}
                                    handleDrop={handleDrop}
                                    handleImportClick={handleImportClick}
                                    handleExport={handleExport}
                                    isDraggingOver={isDraggingOver}
                                    loading={loading}
                                    budgetItems={budgetItems}
                                    budgetUploads={budgetUploads}
                                    uploadsLoading={uploadsLoading}
                                    monthHeaders={monthHeaders}
                                    selectedDepartmentId={selectedDepartmentId}
                                    selectedDepartmentName={selectedDepartmentName}
                                    financialYear={financialYear}
                                    handleSetActive={handleSetActive}
                                    isSaving={isSaving}
                                    setDeletingUploadId={setDeletingUploadId}
                                    setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                                />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
            
            <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
                <DialogContent className="max-w-7xl flex flex-col max-h-[90dvh]">
                    <DialogHeader>
                        <DialogTitle>Map Your File Columns for {activeTab} Budget</DialogTitle>
                        <DialogDescription>Define the data range and match the columns from your file to the required budget fields. Hidden rows/columns are ignored.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 space-y-4 py-4 overflow-y-auto pr-4">
                        <div className="p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-semibold text-foreground mb-4">1. Define Data Range</h3>
                            <div className="grid grid-cols-3 gap-4">
                               <div className="space-y-2"><Label>Header Row</Label><Input type="number" value={headerRow} onChange={e => setHeaderRow(parseInt(e.target.value) || 1)} min={1} /></div>
                                <div className="space-y-2"><Label>Start Data Row</Label><Input type="number" value={startRow} onChange={e => setStartRow(parseInt(e.target.value) || 1)} min={1} /></div>
                                <div className="space-y-2"><Label>End Data Row (0 for end)</Label><Input type="number" value={endRow} onChange={e => setEndRow(parseInt(e.target.value) || 0)} min={0} /></div>
                            </div>
                        </div>
                        <div className="p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-semibold text-foreground mb-4">2. Map Columns</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                               <div className="space-y-2"><Label>Category / Line Item Column</Label><Select value={columnMappings.category} onValueChange={v => setColumnMappings(m => ({ ...m, category: v }))}><SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger><SelectContent>{derivedHeaders.filter(h => String(h).trim() !== '').map((h, i) => <SelectItem key={`${h}-cat-${i}`} value={String(h)}>{String(h)}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-2"><Label>Year Total Column (Optional)</Label><Select value={columnMappings.yearTotal || '--none--'} onValueChange={v => setColumnMappings(m => ({ ...m, yearTotal: v === '--none--' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger><SelectContent><SelectItem value="--none--">None (will be auto-calculated)</SelectItem>{derivedHeaders.filter(h => String(h).trim() !== '').map((h, i) => <SelectItem key={`${h}-total-${i}`} value={String(h)}>{String(h)}</SelectItem>)}</SelectContent></Select></div>
                                 <div className="space-y-2"><Label>First Forecast Month Column</Label><Select value={columnMappings.forecastStart} onValueChange={v => setColumnMappings(m => ({ ...m, forecastStart: v }))}><SelectTrigger><SelectValue placeholder="Select starting month..." /></SelectTrigger><SelectContent>{derivedHeaders.filter(h => String(h).trim() !== '').map((h, i) => <SelectItem key={`${h}-start-${i}`} value={String(h)}>{String(h)}</SelectItem>)}</SelectContent></Select></div>
                            </div>
                        </div>
                        <div className="p-4 border rounded-lg bg-muted/50"><h3 className="font-semibold text-foreground mb-4">3. Preview Data</h3><div className="mt-2 overflow-auto border rounded-lg max-h-64"><Table><TableHeader><TableRow><TableHead className="w-16 font-bold sticky left-0 bg-muted/95 z-10 text-center">Row</TableHead>{derivedHeaders.map((header, i) => { if (!header && derivedHeaders.every(h => !h)) return null; const stringifiedHeaders = derivedHeaders.map(h => String(h)); const forecastStartIndex = stringifiedHeaders.indexOf(columnMappings.forecastStart); const forecastEndIndex = forecastStartIndex !== -1 ? forecastStartIndex + 11 : -1; return (<TableHead key={`${header}-${i}`} className={cn("whitespace-nowrap", columnMappings.category === String(header) && "bg-blue-100 dark:bg-blue-900/50", columnMappings.yearTotal === String(header) && "bg-green-100 dark:bg-green-900/50", forecastStartIndex !== -1 && i >= forecastStartIndex && i <= forecastEndIndex && "bg-yellow-100 dark:bg-yellow-900/50",)}>{String(header) || `Column ${i+1}`}</TableHead>)})}</TableRow></TableHeader><TableBody>{derivedPreview.slice(0, 500).map((row, rowIndex) => (<TableRow key={`preview-${rowIndex}`}><TableCell className="font-mono text-muted-foreground text-center sticky left-0 bg-muted/95 z-10">{startRow + rowIndex}</TableCell>{row.map((cell, cellIndex) => <TableCell key={`cell-${rowIndex}-${cellIndex}`} className="whitespace-nowrap">{String(cell)}</TableCell>)}</TableRow>))}</TableBody></Table></div></div>
                    </div>
                    <DialogFooter className="border-t pt-4"><Button variant="outline" onClick={() => setIsMappingDialogOpen(false)}>Cancel</Button><Button onClick={handleConfirmImport} disabled={isImporting}>{isImporting && <Loader className="h-4 w-4 mr-2 animate-spin" />}Confirm & Import</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this budget version and all its associated line items. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingUploadId(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUpload} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">{isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : null}Yes, delete it</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </>
    );
}


function BudgetTabContent({
    handleDragLeave, handleDragOver, handleDrop, handleImportClick, handleExport, isDraggingOver, loading, budgetItems, budgetUploads, uploadsLoading, monthHeaders, selectedDepartmentId, selectedDepartmentName, financialYear, handleSetActive, isSaving, setDeletingUploadId, setIsDeleteDialogOpen
}: {
    handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    handleImportClick: () => void;
    handleExport: () => void;
    isDraggingOver: boolean;
    loading: boolean;
    budgetItems: BudgetItem[] | null;
    budgetUploads: BudgetUpload[] | null;
    uploadsLoading: boolean;
    monthHeaders: string[];
    selectedDepartmentId: string;
    selectedDepartmentName: string;
    financialYear: number;
    handleSetActive: (id: string) => void;
    isSaving: boolean;
    setDeletingUploadId: (id: string | null) => void;
    setIsDeleteDialogOpen: (open: boolean) => void;
}) {
    return (
        <>
            {selectedDepartmentId && (
                <div 
                    className={cn("relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors mb-6", isDraggingOver ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:border-primary/50")}
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={handleImportClick}
                >
                    <Upload className="mx-auto h-10 w-10 text-muted-foreground"/>
                    <p className="mt-4 text-sm font-medium text-muted-foreground">Drag and drop a budget file here, or click to select a file.</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports .csv, .xlsx, .xls</p>
                </div>
            )}

            {selectedDepartmentId && (
                <div className="p-4 border bg-amber-50 border-amber-200 rounded-lg flex items-start gap-3 text-amber-800 mb-6 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-5 w-5 mt-0.5 shrink-0"/>
                    <div><h4 className="font-semibold">How budget versions work</h4><p className="text-sm">Importing a new forecast creates a new version for the selected year. The latest upload is automatically set as 'Active'. You can view past versions and activate an older forecast from the 'Upload History' table below.</p></div>
                </div>
            )}
            {loading ? (
                <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg"><Loader className="h-8 w-8 animate-spin" /></div>
             ) : selectedDepartmentId ? (
                <div className="space-y-2">
                    <div className="flex justify-between items-center"><h3 className="text-lg font-semibold">{`Active Budget: ${selectedDepartmentName ? ` - FY ${financialYear}` : ''}`}</h3><Button variant="outline" size="sm" onClick={handleExport} disabled={!budgetItems || budgetItems.length === 0}><Download className="h-4 w-4 mr-2" /> Export Active</Button></div>
                    <div className="overflow-auto border rounded-lg">
                        <Table>
                            <TableHeader><TableRow><TableHead className="font-bold min-w-[250px]">Category</TableHead>{monthHeaders.map(month => (<TableHead key={month} className="text-right">{month}</TableHead>))}{<TableHead className="text-right font-bold">Year Total</TableHead>}</TableRow></TableHeader>
                            <TableBody>{budgetItems && budgetItems.length > 0 ? (budgetItems.map((item) => (<TableRow key={item.id}><TableCell className="font-medium">{item.category}</TableCell>{item.forecasts.map((forecast, index) => (<TableCell key={index} className="text-right font-mono">{forecast ? formatCurrency(forecast) : '-'}</TableCell>))}<TableCell className="text-right font-mono font-bold">{formatCurrency(item.yearTotal)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={monthHeaders.length + 2} className="h-24 text-center text-muted-foreground">No active budget found for this department and year. Use the 'Import' button to create one.</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg"><p className="text-muted-foreground">Please select a department to view or manage its budget.</p></div>
            )}

            {selectedDepartmentId && (
                <Card className="mt-6">
                    <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Upload History</CardTitle><CardDescription>History of budget uploads for {selectedDepartmentName} - FY {financialYear}</CardDescription></CardHeader>
                    <CardContent>
                        <div className="overflow-auto border rounded-lg">
                            <Table>
                                <TableHeader><TableRow><TableHead>Upload Date</TableHead><TableHead>Uploaded By</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>{uploadsLoading ? (<TableRow><TableCell colSpan={4} className="text-center h-24"><Loader className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>) : budgetUploads && budgetUploads.length > 0 ? (budgetUploads.sort((a,b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0)).map(upload => (<TableRow key={upload.id}><TableCell>{upload.uploadedAt ? format(new Date(upload.uploadedAt.seconds * 1000), "yyyy-MM-dd, HH:mm") : 'N/A'}</TableCell><TableCell>{upload.uploadedByName}</TableCell><TableCell>{upload.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Archived</Badge>}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleSetActive(upload.id)} disabled={upload.isActive || isSaving}>{isSaving && !upload.isActive ? <Loader className="h-4 w-4 animate-spin"/> : 'Set Active' }</Button><Button variant="ghost" size="icon" onClick={() => { setDeletingUploadId(upload.id); setIsDeleteDialogOpen(true); }} disabled={upload.isActive} title={upload.isActive ? "Cannot delete active budget" : "Delete"}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))) : (<TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No upload history found.</TableCell></TableRow>)}</TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
