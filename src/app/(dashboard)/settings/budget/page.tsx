'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Loader, Banknote, Plus, Trash2, Edit, Upload, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, getDocs, query } from "firebase/firestore";

type BudgetItem = {
    id: string;
    category: string;
    forecasts: number[];
    yearTotal: number;
};

const initialBudgetData: Omit<BudgetItem, 'id'>[] = [
    { category: 'Salaries - SA', forecasts: [47288.02, 47288.02, 47288.02, 47288.02, 47288.02, 47288.02, 47288.02, 47288.02, 47288.02, 47288.02, 47288.02, 47288.02], yearTotal: 567456.24 },
    { category: 'Benefits - SA', forecasts: [13572.10, 13572.10, 13572.10, 13572.10, 13572.10, 13572.10, 13572.10, 13572.10, 13572.10, 13572.10, 13572.10, 13572.10], yearTotal: 162865.20 },
    { category: 'Workshops & Meetings - SA', forecasts: [0, 0, 1500.00, 0, 0, 0, 0, 1500.00, 0, 0, 0, 0], yearTotal: 3000.00 },
    { category: 'Professional Fees - SA', forecasts: [332065.81, 332065.81, 332065.81, 332065.81, 332065.81, 332065.81, 332065.81, 332065.81, 332065.81, 332065.81, 332065.81, 332065.81], yearTotal: 3984789.73 },
    { category: 'Supplies - SA', forecasts: [15600.00, 15274.00, 16172.00, 10774.00, 11274.00, 11274.00, 23724.00, 15274.00, 9274.00, 10774.00, 11274.00, 10774.00], yearTotal: 161462.00 },
    { category: 'Staff Travel - SA', forecasts: [980.00, 980.00, 980.00, 980.00, 980.00, 440.00, 560.00, 980.00, 980.00, 980.00, 980.00, 980.00], yearTotal: 10800.00 },
    { category: 'Fuel & Maintenance - SA', forecasts: [14000.00, 22000.00, 14750.00, 14000.00, 14000.00, 26475.00, 11800.00, 15800.00, 14750.00, 14000.00, 14750.00, 28675.00], yearTotal: 205000.00 },
    { category: 'Operational Lease/Rental - SA', forecasts: [64802.01, 64802.01, 64802.01, 64802.01, 64802.01, 64802.01, 64802.01, 64802.01, 64802.01, 64802.01, 64802.01, 64802.01], yearTotal: 777624.12 },
    { category: 'Tech Support - SA', forecasts: [50793.50, 19174.50, 0, 50793.50, 15000.00, 0, 50793.50, 19174.50, 0, 48793.50, 17000.00, 0], yearTotal: 271523.00 },
    { category: 'Annual License Fees - SA', forecasts: [742420.87, 17473.65, 269222.57, 17473.65, 17473.65, 204608.96, 56213.65, 17473.65, 17473.65, 17473.65, 17473.65, 17473.65], yearTotal: 1412255.24 },
    { category: 'Communications - SA', forecasts: [6634.67, 6084.67, 6084.67, 6634.67, 6084.67, 6084.67, 6634.67, 6084.67, 6084.67, 6634.67, 6084.67, 6084.67], yearTotal: 75216.04 },
    { category: 'Internet - SA', forecasts: [14675.00, 14675.00, 14675.00, 14675.00, 14675.00, 14675.00, 14675.00, 14675.00, 14675.00, 14675.00, 14675.00, 14675.00], yearTotal: 176100.00 },
    { category: 'Facilities Maintenance - SA', forecasts: [267063.15, 101347.96, 99249.68, 75107.09, 49919.68, 118919.68, 114674.04, 99347.96, 90549.68, 65107.09, 49919.68, 52919.68], yearTotal: 1184125.37 },
    { category: 'Security', forecasts: [174100.00, 174100.00, 174100.00, 174100.00, 174100.00, 174100.00, 174100.00, 174100.00, 174100.00, 174100.00, 174100.00, 174100.00], yearTotal: 2089200.00 },
    { category: 'Cleaning', forecasts: [78700.00, 78700.00, 78700.00, 78700.00, 78700.00, 75900.00, 75900.00, 78700.00, 78700.00, 78700.00, 78700.00, 78700.00], yearTotal: 938800.00 },
    { category: 'Utilities', forecasts: [81300.00, 81300.00, 81300.00, 81300.00, 81300.00, 56700.00, 56700.00, 81300.00, 81300.00, 81300.00, 81300.00, 81300.00], yearTotal: 926400.00 },
    { category: 'Insurance - SA', forecasts: [60295.32, 60295.32, 60295.32, 60295.32, 60295.32, 60295.32, 60295.32, 60295.32, 60295.32, 60295.32, 60295.32, 60295.32], yearTotal: 723543.84 },
];

const monthHeaders = ['Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26'];

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

    const budgetsQuery = useMemo(() => collection(firestore, 'budgets'), [firestore]);
    const { data: budgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);
    
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

     useEffect(() => {
        if (!budgetsLoading && (!budgetItems || budgetItems.length === 0) && firestore) {
            const seedBudgets = async () => {
                const budgetCol = collection(firestore, 'budgets');
                const snapshot = await getDocs(query(budgetCol));
                if (snapshot.empty) {
                    for (const item of initialBudgetData) {
                        await addDoc(budgetCol, item);
                    }
                }
            };
            seedBudgets();
        }
    }, [budgetItems, budgetsLoading, firestore]);

    useEffect(() => {
        if (!userLoading && (!user || role !== 'Administrator')) {
            router.push('/');
        }
    }, [user, role, userLoading, router]);
    
    const loading = userLoading || budgetsLoading;

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (!budgetItems || budgetItems.length === 0) {
            toast({ title: "No Data to Export", description: "There is no budget data to export." });
            return;
        }

        const headers = ['category', ...monthHeaders.map(h => h.replace(' ', '').toLowerCase()), 'yearTotal'];
        
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
        link.setAttribute('download', 'budget.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            try {
                const rows = text.split('\n').filter(row => row.trim());
                if (rows.length < 2) throw new Error("CSV file must have a header and at least one data row.");

                const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const forecastHeaders = monthHeaders.map(h => h.replace(' ', '').toLowerCase());
                
                const newItems: Omit<BudgetItem, 'id'>[] = rows.slice(1).map(row => {
                    const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
                    let item: any = {};
                    headers.forEach((header, index) => {
                        item[header] = values[index];
                    });

                    if (!item.category || !item.yearTotal) {
                        throw new Error("CSV is missing required columns: category, yearTotal.");
                    }
                    
                    const forecasts = forecastHeaders.map(fh => parseFloat(item[fh]) || 0);

                    return {
                        category: item.category,
                        forecasts,
                        yearTotal: parseFloat(item.yearTotal) || 0,
                    };
                });
                
                for (const item of newItems) {
                    await addDoc(collection(firestore, 'budgets'), item);
                }

                toast({ title: "Import Successful", description: `${newItems.length} budget items were added/updated.` });
            } catch (error: any) {
                console.error("CSV Parsing Error:", error);
                toast({ variant: "destructive", title: "Import Failed", description: error.message || "Could not parse the CSV file." });
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
            />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Banknote className="h-6 w-6 text-primary" />
                        Budget Integration
                    </CardTitle>
                    <CardDescription>
                        Import, view, and export budget data from an external sheet.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={handleImportClick}>
                            <Upload className="h-4 w-4 mr-2" /> Import
                        </Button>
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4 mr-2" /> Export
                        </Button>
                    </div>
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
                                {budgetItems && budgetItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.category}</TableCell>
                                        {item.forecasts.map((forecast, index) => (
                                            <TableCell key={index} className="text-right font-mono">
                                                {forecast ? formatCurrency(forecast) : '-'}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right font-mono font-bold">{formatCurrency(item.yearTotal)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
