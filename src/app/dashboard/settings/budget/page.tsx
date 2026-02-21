
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Loader, Banknote, Upload, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
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
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

type Department = {
    id: string;
    name: string;
    budgetHeaders?: string[];
};

type BudgetItem = {
    id: string;
    departmentId: string;
    departmentName?: string;
    category: string;
    forecasts: number[];
    yearTotal: number;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
};

const excelDateToJSDate = (serial: number) => {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
};

export default function BudgetPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

    // State for mapping dialog
    const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
    const [originalFileData, setOriginalFileData] = useState<(string | number | null)[][]>([]);
    const [startRow, setStartRow] = useState(1);
    const [endRow, setEndRow] = useState(0);
    const [columnMappings, setColumnMappings] = useState<{
        category: string;
        yearTotal: string;
        forecastStart: string;
        forecastEnd: string;
    }>({ category: '', yearTotal: '', forecastStart: '', forecastEnd: '' });

    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const budgetsQuery = useMemo(() => {
        if (!firestore || !selectedDepartmentId) return null;
        return query(collection(firestore, 'budgets'), where('departmentId', '==', selectedDepartmentId));
    }, [firestore, selectedDepartmentId]);
    
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
    
    const loading = userLoading || deptsLoading || (selectedDepartmentId && budgetsLoading);
    
    const selectedDepartment = useMemo(() => {
        return departments?.find(d => d.id === selectedDepartmentId);
    }, [selectedDepartmentId, departments]);

    const monthHeaders = useMemo(() => {
        return selectedDepartment?.budgetHeaders || [];
    }, [selectedDepartment]);

    const selectedDepartmentName = selectedDepartment?.name || '';

    const { derivedHeaders, derivedPreview, dataRowsForImport } = useMemo(() => {
        if (!originalFileData || originalFileData.length === 0 || startRow === 0) {
            return { derivedHeaders: [], derivedPreview: [], dataRowsForImport: [] };
        }

        const startIndex = startRow > 0 ? startRow - 1 : 0;
        const endIndex = endRow > 0 ? endRow : originalFileData.length;
        const rowsToParse = originalFileData.slice(startIndex, endIndex);

        if (rowsToParse.filter(r => r && r.some(c => c !== null && c !== '')).length < 1) {
            return { derivedHeaders: [], derivedPreview: [], dataRowsForImport: [] };
        }

        let headerIndex = -1;
        for (let i = 0; i < rowsToParse.length; i++) {
            if (rowsToParse[i] && rowsToParse[i].some(c => c !== null && c !== '')) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) {
            return { derivedHeaders: [], derivedPreview: [], dataRowsForImport: [] };
        }

        const headerRow = rowsToParse[headerIndex];
        const dataRows = rowsToParse.slice(headerIndex + 1);
        const headers = (headerRow as (string | number | null)[]).map(h => {
            if (h === null || h === undefined) return "";
            const numHeader = Number(h);
            if (!isNaN(numHeader) && numHeader > 30000 && numHeader < 60000) { // Plausible range for Excel date serials
                const date = excelDateToJSDate(numHeader);
                if (!isNaN(date.getTime())) {
                    return format(date, "MMM yyyy"); // Format as "Jun 2026"
                }
            }
            return String(h);
        });

        return {
            derivedHeaders: headers,
            derivedPreview: dataRows.slice(0, 3).map(row => row.map(cell => cell === null ? "" : cell)),
            dataRowsForImport: dataRows,
        };
    }, [originalFileData, startRow, endRow]);

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

        let initialMappings = { category: '', yearTotal: '', forecastStart: '', forecastEnd: '' };
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
            initialMappings.forecastEnd = forecastColumns[forecastColumns.length - 1];
        }

        setColumnMappings(initialMappings);
    }, [derivedHeaders]);

    const handleImportClick = () => {
        if (!selectedDepartmentId) {
            toast({ variant: 'destructive', title: 'No Department Selected', description: 'Please select a department before importing.' });
            return;
        }
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (!budgetItems || budgetItems.length === 0) {
            toast({ title: "No Data to Export", description: "There is no budget data to export for this department." });
            return;
        }
        
        const exportMonthHeaders = selectedDepartment?.budgetHeaders || [];
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
        link.setAttribute('download', `budget_${selectedDepartmentName.replace(/ /g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedDepartmentId) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false, cellDates: false });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];

                const allData: (string|number|null)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                
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

                let startRowIndex = -1;
                let endRowIndex = visibleData.length;

                for (let i = 0; i < visibleData.length; i++) {
                    const row = visibleData[i];
                    if (startRowIndex === -1 && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('actuals vs budget'))) {
                        startRowIndex = i;
                    }
                    if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('subtotal cash expenses'))) {
                        endRowIndex = i;
                        break; 
                    }
                }
                
                setStartRow(startRowIndex !== -1 ? startRowIndex + 1 : 1);
                setEndRow(endRowIndex < visibleData.length ? endRowIndex : visibleData.length);
                
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
    
    const handleConfirmImport = async () => {
        if (!user || !firestore) return;
        const { category, yearTotal, forecastStart, forecastEnd } = columnMappings;

        const stringifiedHeaders = derivedHeaders.map(h => String(h));

        const categoryIndex = stringifiedHeaders.indexOf(category);
        const yearTotalIndex = yearTotal ? stringifiedHeaders.indexOf(yearTotal) : -1;
        const forecastStartIndex = stringifiedHeaders.indexOf(forecastStart);
        const forecastEndIndex = stringifiedHeaders.indexOf(forecastEnd);


        if (categoryIndex === -1 || forecastStartIndex === -1 || forecastEndIndex === -1) {
            toast({ variant: "destructive", title: "Invalid Mapping", description: "Please map 'Category' and 'Forecast' columns." });
            return;
        }
        
        if (forecastStartIndex > forecastEndIndex) {
            toast({ variant: "destructive", title: "Invalid Range", description: "The 'Forecast Start Column' must come before the 'Forecast End Column'." });
            return;
        }

        const newMonthHeaders = derivedHeaders.slice(forecastStartIndex, forecastEndIndex + 1);
        
        try {
            const forecastIndices = Array.from({ length: forecastEndIndex - forecastStartIndex + 1 }, (_, i) => forecastStartIndex + i);

            const newItems: Omit<BudgetItem, 'id'>[] = dataRowsForImport.map(row => {
                const categoryValue = row[categoryIndex] ? String(row[categoryIndex]).trim() : '';
                if (!categoryValue) return null; // Skip empty rows

                const forecasts = forecastIndices.map(index => {
                    const forecastValueRaw = row[index];
                    return parseFloat(String(forecastValueRaw || '0').replace(/,/g, '')) || 0;
                });
                
                let yearTotalValue: number;
                if (yearTotalIndex !== -1) {
                    const yearTotalValueRaw = row[yearTotalIndex];
                    yearTotalValue = parseFloat(String(yearTotalValueRaw || '0').replace(/,/g, '')) || 0;
                } else {
                    yearTotalValue = forecasts.reduce((sum, current) => sum + current, 0);
                }

                return {
                    departmentId: selectedDepartmentId,
                    departmentName: selectedDepartmentName,
                    category: categoryValue,
                    forecasts,
                    yearTotal: yearTotalValue,
                };
            }).filter((item): item is Omit<BudgetItem, 'id'> => item !== null);
            
            if (budgetItems) {
                for (const item of budgetItems) {
                    await deleteDoc(doc(firestore, 'budgets', item.id));
                }
            }

            const deptRef = doc(firestore, 'departments', selectedDepartmentId);
            await setDoc(deptRef, { budgetHeaders: newMonthHeaders }, { merge: true });

            for (const item of newItems) {
                await addDoc(collection(firestore, 'budgets'), item);
            }

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: 'budget.import',
                details: `Imported ${newItems.length} budget items for department ${selectedDepartmentName}.`,
                entity: { type: 'department', id: selectedDepartmentId },
                timestamp: serverTimestamp()
            });

            toast({ title: "Import Successful", description: `${newItems.length} budget items were imported for ${selectedDepartmentName}.` });
            setIsMappingDialogOpen(false);
        } catch (error: any) {
             console.error("Budget Import Error:", error);
             toast({ variant: "destructive", title: "Import Failed", description: error.message || "An error occurred during import." });
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
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
            />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Banknote className="h-6 w-6 text-primary" />
                        Budget Integration by Department
                    </CardTitle>
                    <CardDescription>
                        Import, view, and export departmental budget data from a CSV or Excel file. Select a department to begin.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <Label htmlFor="department-select">Department:</Label>
                            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                                <SelectTrigger className="w-[250px]" id="department-select">
                                    <SelectValue placeholder={deptsLoading ? "Loading..." : "Select a department"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments?.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={handleImportClick} disabled={!selectedDepartmentId}>
                                <Upload className="h-4 w-4 mr-2" /> Import Budget
                            </Button>
                            <Button variant="outline" onClick={handleExport} disabled={!selectedDepartmentId || !budgetItems || budgetItems.length === 0}>
                                <Download className="h-4 w-4 mr-2" /> Export Budget
                            </Button>
                        </div>
                    </div>
                    {loading ? (
                         <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg">
                            <Loader className="h-8 w-8 animate-spin" />
                        </div>
                    ) : selectedDepartmentId ? (
                        <div className="overflow-auto border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-bold min-w-[250px]">EXPENSES</TableHead>
                                        {monthHeaders.map(month => (
                                            <TableHead key={month} className="text-right">{month}</TableHead>
                                        ))}
                                        <TableHead className="text-right font-bold">Year Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {budgetItems && budgetItems.length > 0 ? (
                                        budgetItems.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.category}</TableCell>
                                                {item.forecasts.map((forecast, index) => (
                                                    <TableCell key={index} className="text-right font-mono">
                                                        {forecast ? formatCurrency(forecast) : '-'}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right font-mono font-bold">{formatCurrency(item.yearTotal)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={monthHeaders.length + 2} className="h-24 text-center text-muted-foreground">
                                                No budget data found for this department. Use the 'Import Budget' button to add data.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground">Please select a department to view or manage its budget.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
                <DialogContent className="max-w-4xl flex flex-col max-h-[90dvh]">
                    <DialogHeader>
                        <DialogTitle>Map Your File Columns</DialogTitle>
                        <DialogDescription>
                            Define the data range and match the columns from your file to the required budget fields. Hidden rows/columns are ignored.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 space-y-6 py-4 overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 gap-4 border-b pb-6">
                           <div className="space-y-2">
                                <Label>Start Row</Label>
                                <Input type="number" value={startRow} onChange={e => setStartRow(parseInt(e.target.value) || 1)} min={1} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Row (0 for end of file)</Label>
                                <Input type="number" value={endRow} onChange={e => setEndRow(parseInt(e.target.value) || 0)} min={0} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                                <Label>Category / Line Item Column</Label>
                                <Select value={columnMappings.category} onValueChange={v => setColumnMappings(m => ({ ...m, category: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                                    <SelectContent>
                                        {derivedHeaders.filter(h => String(h).trim() !== '').map((h, i) => <SelectItem key={`${h}-${i}`} value={String(h)}>{String(h)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Year Total Column (Optional)</Label>
                                <Select 
                                    value={columnMappings.yearTotal || '--none--'} 
                                    onValueChange={v => setColumnMappings(m => ({ ...m, yearTotal: v === '--none--' ? '' : v }))}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="--none--">None (will be calculated)</SelectItem>
                                        {derivedHeaders.filter(h => String(h).trim() !== '').map((h, i) => <SelectItem key={`${h}-${i}`} value={String(h)}>{String(h)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Forecast Start Column</Label>
                                <Select value={columnMappings.forecastStart} onValueChange={v => setColumnMappings(m => ({ ...m, forecastStart: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                                    <SelectContent>
                                        {derivedHeaders.filter(h => String(h).trim() !== '').map((h, i) => <SelectItem key={`${h}-${i}`} value={String(h)}>{String(h)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Forecast End Column</Label>
                                <Select value={columnMappings.forecastEnd} onValueChange={v => setColumnMappings(m => ({ ...m, forecastEnd: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                                    <SelectContent>
                                        {derivedHeaders.filter(h => String(h).trim() !== '').map((h, i) => <SelectItem key={`${h}-${i}`} value={String(h)}>{String(h)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Data Preview</Label>
                            <div className="mt-2 overflow-auto border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {derivedHeaders.map((header, i) => {
                                                if (!header && derivedHeaders.every(h => !h)) return null;
                                                const stringifiedHeaders = derivedHeaders.map(h => String(h));
                                                const forecastStartIndex = stringifiedHeaders.indexOf(columnMappings.forecastStart);
                                                const forecastEndIndex = stringifiedHeaders.indexOf(columnMappings.forecastEnd);
                                                
                                                return (
                                                    <TableHead key={`${header}-${i}`} className={cn(
                                                        columnMappings.category === String(header) && "bg-blue-100 dark:bg-blue-900/50",
                                                        columnMappings.yearTotal === String(header) && "bg-green-100 dark:bg-green-900/50",
                                                        forecastStartIndex !== -1 && forecastEndIndex !== -1 && i >= forecastStartIndex && i <= forecastEndIndex && "bg-yellow-100 dark:bg-yellow-900/50",
                                                    )}>{String(header) || `Column ${i+1}`}</TableHead>
                                                )
                                            })}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {derivedPreview.map((row, rowIndex) => (
                                            <TableRow key={`preview-${rowIndex}`}>
                                                {row.map((cell, cellIndex) => <TableCell key={`cell-${rowIndex}-${cellIndex}`}>{String(cell)}</TableCell>)}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsMappingDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmImport}>Confirm & Import</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
