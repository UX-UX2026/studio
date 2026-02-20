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
import { collection, doc, addDoc, setDoc, deleteDoc, getDocs, query, where } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from 'xlsx';

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
                    rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                } else {
                    throw new Error("Unsupported file type. Please upload a CSV or Excel file.");
                }

                if (rows.length < 2) throw new Error("File must have a header and at least one data row.");

                const headers = rows[0].map(h => (h ? String(h) : "").trim().replace(/"/g, ''));
                
                const categoryIndex = headers.findIndex(h => h.trim().toLowerCase() === 'category');
                const yearTotalIndex = headers.findIndex(h => h.trim().toLowerCase() === 'yeartotal' || h.trim().toLowerCase() === 'year total');

                if (categoryIndex === -1 || yearTotalIndex === -1) {
                    throw new Error("CSV/Excel must contain 'category' and 'yearTotal' columns.");
                }

                const newMonthHeaders = headers.slice(categoryIndex + 1, yearTotalIndex);

                const newItems: Omit<BudgetItem, 'id'>[] = rows.slice(1).map(row => {
                    const values = row.map(v => String(v || '').trim().replace(/"/g, ''));
                    const category = values[categoryIndex];
                    if (!category) return null; // Skip empty rows

                    const yearTotal = parseFloat(values[yearTotalIndex]) || 0;
                    
                    const forecasts = newMonthHeaders.map((header, index) => {
                        const forecastValueIndex = categoryIndex + 1 + index;
                        const forecastValue = values[forecastValueIndex];
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
        </>
    );
}
