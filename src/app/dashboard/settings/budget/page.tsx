'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Loader, Banknote, Upload, Download, Check, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, getDocs, query, where } from "firebase/firestore";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

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

export default function BudgetPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

    // State for mapping dialog
    const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [filePreview, setFilePreview] = useState<(string|number)[][]>([]);
    const [parsedFileData, setParsedFileData] = useState<(string|number)[][]>([]);
    const [columnMappings, setColumnMappings] = useState<{
        category: string;
        yearTotal: string;
        forecasts: string[];
    }>({ category: '', yearTotal: '', forecasts: [] });

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
                let rows: (string|number)[][];
                const fileExtension = file.name.split('.').pop()?.toLowerCase();

                if (fileExtension === 'csv') {
                    const text = e.target?.result as string;
                    rows = text.split('\n').filter(row => row.trim()).map(r => r.split(','));
                } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                } else {
                    throw new Error("Unsupported file type. Please upload a CSV or Excel file.");
                }

                if (rows.length < 2) throw new Error("File must have a header and at least one data row.");

                const headers = rows[0].map(h => (h ?? '').toString().trim().replace(/"/g, ''));
                
                setParsedFileData(rows);
                setFileHeaders(headers);
                setFilePreview(rows.slice(1, 4));

                // Guess mappings
                const guessMapping = (h: string) => {
                    const lowerH = h.toLowerCase().trim();
                    if (lowerH === 'category') return 'category';
                    if (lowerH === 'yeartotal' || lowerH === 'year total') return 'yearTotal';
                    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                    if (monthNames.some(m => lowerH.startsWith(m))) return 'forecast';
                    return null;
                }

                let initialMappings = { category: '', yearTotal: '', forecasts: [] as string[] };
                headers.forEach(h => {
                    if (!h) return;
                    const mapping = guessMapping(h);
                    if (mapping === 'category' && !initialMappings.category) {
                        initialMappings.category = h;
                    } else if (mapping === 'yearTotal' && !initialMappings.yearTotal) {
                        initialMappings.yearTotal = h;
                    } else if (mapping === 'forecast') {
                        initialMappings.forecasts.push(h);
                    }
                });
                setColumnMappings(initialMappings);
                
                setIsMappingDialogOpen(true);

            } catch (error: any) {
                console.error("File Parsing Error:", error);
                toast({ variant: "destructive", title: "Import Failed", description: error.message || "Could not parse the file." });
            } finally {
                if (event.target) event.target.value = '';
            }
        };

        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };
    
    const handleConfirmImport = async () => {
        const categoryIndex = fileHeaders.indexOf(columnMappings.category);
        const yearTotalIndex = fileHeaders.indexOf(columnMappings.yearTotal);

        if (categoryIndex === -1 || yearTotalIndex === -1 || columnMappings.forecasts.length === 0) {
            toast({ variant: "destructive", title: "Invalid Mapping", description: "Please map 'Category', 'Year Total', and at least one forecast column." });
            return;
        }

        const forecastIndices = columnMappings.forecasts.map(f => fileHeaders.indexOf(f));
        const newMonthHeaders = columnMappings.forecasts;
        
        try {
            const newItems: Omit<BudgetItem, 'id'>[] = parsedFileData.slice(1).map(row => {
                const values = row.map(v => String(v || '').trim().replace(/"/g, ''));
                const category = values[categoryIndex];
                if (!category) return null; // Skip empty rows

                const yearTotal = parseFloat(values[yearTotalIndex]) || 0;
                
                const forecasts = forecastIndices.map(index => {
                    const forecastValue = values[index];
                    return parseFloat(forecastValue) || 0;
                });

                return {
                    departmentId: selectedDepartmentId,
                    departmentName: selectedDepartmentName,
                    category,
                    forecasts,
                    yearTotal,
                };
            }).filter(Boolean) as Omit<BudgetItem, 'id'>[];
            
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

            toast({ title: "Import Successful", description: `${newItems.length} budget items were imported for ${selectedDepartmentName}.` });
            setIsMappingDialogOpen(false);
        } catch (error: any) {
             toast({ variant: "destructive", title: "Import Failed", description: error.message || "An error occurred during import." });
        }
    };

    const allowedRoles = useMemo(() => ['Administrator', 'Procurement Officer'], []);
    if (loading || !user || !role || !allowedRoles.includes(role)) {
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
                        <div className="overflow-x-auto border rounded-lg">
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
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Map Your File Columns</DialogTitle>
                        <DialogDescription>
                            Match the columns from your file to the required budget fields. We've tried to guess the mappings for you.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label>Category Column</Label>
                                <Select value={columnMappings.category} onValueChange={v => setColumnMappings(m => ({ ...m, category: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                                    <SelectContent>
                                        {fileHeaders.filter(h => h).map((h, i) => <SelectItem key={`${h}-${i}`} value={h}>{h}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Year Total Column</Label>
                                <Select value={columnMappings.yearTotal} onValueChange={v => setColumnMappings(m => ({ ...m, yearTotal: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                                    <SelectContent>
                                        {fileHeaders.filter(h => h).map((h, i) => <SelectItem key={`${h}-${i}`} value={h}>{h}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Forecast Columns</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {columnMappings.forecasts.length > 0 ? `${columnMappings.forecasts.length} selected` : "Select columns..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search columns..." />
                                            <CommandList>
                                                <CommandEmpty>No columns found.</CommandEmpty>
                                                <CommandGroup>
                                                    {fileHeaders.filter(h => h).map((header, i) => (
                                                        <CommandItem
                                                            key={`${header}-${i}`}
                                                            value={header}
                                                            onSelect={(currentValue) => {
                                                                const newForecasts = columnMappings.forecasts.includes(header)
                                                                    ? columnMappings.forecasts.filter(f => f !== header)
                                                                    : [...columnMappings.forecasts, header];
                                                                setColumnMappings(m => ({ ...m, forecasts: newForecasts }));
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", columnMappings.forecasts.includes(header) ? "opacity-100" : "opacity-0")} />
                                                            {header}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div>
                            <Label>Data Preview</Label>
                            <div className="mt-2 overflow-x-auto border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {fileHeaders.map((header, i) => (
                                                <TableHead key={`${header}-${i}`} className={cn(
                                                    columnMappings.category === header && "bg-blue-100 dark:bg-blue-900/50",
                                                    columnMappings.yearTotal === header && "bg-green-100 dark:bg-green-900/50",
                                                    columnMappings.forecasts.includes(header) && "bg-yellow-100 dark:bg-yellow-900/50",
                                                )}>{header}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filePreview.map((row, rowIndex) => (
                                            <TableRow key={`preview-${rowIndex}`}>
                                                {row.map((cell, cellIndex) => <TableCell key={`cell-${rowIndex}-${cellIndex}`}>{cell}</TableCell>)}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMappingDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmImport}>Confirm & Import</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
