
"use client";

import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, List, Plus, Trash2, Upload, Download, Loader } from "lucide-react";
import { Input } from "../ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, addDoc, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { procurementCategories } from "@/lib/procurement-categories";

type RecurringItem = {
    id: string;
    category: string;
    name: string;
    amount: number;
    nextLoad: string;
    active: boolean;
    frequency: string;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
};

export function RecurringClient() {
    const firestore = useFirestore();
    const { user } = useUser();
    const recurringItemsQuery = useMemo(() => query(collection(firestore, 'recurringItems'), orderBy('name')), [firestore]);
    const { data: items, loading } = useCollection<RecurringItem>(recurringItemsQuery);
    
    const [view, setView] = useState<'grid' | 'list'>('list');
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleItemChange = async (id: string, field: keyof RecurringItem, value: any) => {
        if (!user || !firestore) return;
        const itemRef = doc(firestore, 'recurringItems', id);
        const updatePayload = { [field]: value };
        const action = 'recurringItem.update';
        
        try {
            await setDoc(itemRef, updatePayload, { merge: true });
            toast({ title: "Recurring item updated" });

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Updated recurring item (id: ${id.substring(0,6)}...), field '${field}' to '${value}'`,
                entity: { type: 'recurringItem', id },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            console.error("Recurring Item Update Error:", error);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message || 'Could not update recurring item.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        }
    };

    const handleAddItem = async () => {
        if (!user || !firestore) return;
        const newItem: Omit<RecurringItem, 'id'> = {
          name: "New Item",
          category: "Uncategorized",
          amount: 0,
          nextLoad: "TBD",
          frequency: "Monthly",
          active: true,
        };
        const recurringItemsCollectionRef = collection(firestore, 'recurringItems');
        const action = 'recurringItem.create';
        
        try {
            const docRef = await addDoc(recurringItemsCollectionRef, newItem);
            toast({ title: "New item added" });
            setView('list'); // Switch to list view for easier editing

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Created new recurring item: "New Item"`,
                entity: { type: 'recurringItem', id: docRef.id },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            console.error("Add Recurring Item Error:", error);
            toast({
                variant: 'destructive',
                title: 'Add Failed',
                description: error.message || 'Could not add new recurring item.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        }
    };
    
    const handleRemoveItem = async (id: string) => {
        if (!user || !firestore) return;
        const itemToRemove = items?.find(i => i.id === id);
        const itemRef = doc(firestore, 'recurringItems', id);
        const action = 'recurringItem.delete';

        try {
            await deleteDoc(itemRef);
            toast({ title: "Item removed" });
            
            if (itemToRemove) {
                await addDoc(collection(firestore, 'auditLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action: action,
                    details: `Deleted recurring item: "${itemToRemove.name}"`,
                    entity: { type: 'recurringItem', id },
                    timestamp: serverTimestamp()
                });
            }
        } catch (error: any) {
            console.error("Delete Recurring Item Error:", error);
            toast({
                variant: 'destructive',
                title: 'Delete Failed',
                description: error.message || 'Could not delete recurring item.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (!items || items.length === 0) {
            toast({ title: "No Data to Export", description: "There are no recurring items to export." });
            return;
        }

        const headers: (keyof RecurringItem)[] = ['id', 'name', 'category', 'frequency', 'nextLoad', 'amount', 'active'];
        const csvContent = [
            headers.join(','),
            ...items.map(item =>
                headers.map(header => `"${(item as any)[header]}"`).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', 'recurring-items.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !firestore) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            try {
                const rows = text.split('\n').filter(row => row.trim());
                if (rows.length < 2) throw new Error("CSV file must have a header and at least one data row.");

                const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
                
                const newItems: Omit<RecurringItem, 'id'>[] = rows.slice(1).map(row => {
                    const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
                    let item: any = {};
                    headers.forEach((header, index) => {
                        item[header] = values[index];
                    });

                    if (!item.name || !item.category || !item.amount) {
                        throw new Error("CSV is missing required columns: name, category, amount.");
                    }

                    return {
                        name: item.name,
                        category: item.category,
                        frequency: item.frequency || 'Monthly',
                        nextLoad: item.nextLoad || '',
                        amount: parseFloat(item.amount) || 0,
                        active: item.active === 'true',
                    };
                });
                
                for (const item of newItems) {
                    await addDoc(collection(firestore, 'recurringItems'), item);
                }

                toast({ title: "Import Successful", description: `${newItems.length} items were added.` });
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
        <div>
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <Button onClick={handleAddItem} className="shadow-lg shadow-primary/20">
                        <Plus className="h-4 w-4 mr-2"/>
                        New Recurring Item
                    </Button>
                     <Button variant="outline" onClick={handleImportClick}>
                        <Upload className="h-4 w-4 mr-2" /> Import
                    </Button>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" /> Export
                    </Button>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
                   <Button variant={view === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setView('grid')} className="gap-2">
                        <LayoutGrid className="h-4 w-4"/>
                        Grid
                    </Button>
                     <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')} className="gap-2">
                        <List className="h-4 w-4"/>
                        List
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader className="h-8 w-8 animate-spin" />
                </div>
            ) : view === 'grid' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items && items.map(item => (
                        <Card key={item.id} className="flex flex-col justify-between hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex justify-between items-start gap-2">
                                     <Select value={item.category} onValueChange={(value) => handleItemChange(item.id, 'category', value)}>
                                        <SelectTrigger className="text-sm font-medium uppercase text-primary tracking-wider bg-transparent border-0 border-b rounded-none focus-visible:ring-0 p-0 h-auto">
                                            <SelectValue placeholder="Category"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {procurementCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Switch id={`switch-grid-${item.id}`} checked={item.active} onCheckedChange={(checked) => handleItemChange(item.id, 'active', checked)} aria-label="Toggle item status"/>
                                </div>
                                <Input 
                                    defaultValue={item.name} 
                                    onBlur={e => handleItemChange(item.id, 'name', e.target.value)} 
                                    className="!mt-2 text-base font-semibold text-foreground bg-transparent border-0 border-b rounded-none focus-visible:ring-0 px-0 h-auto"
                                    placeholder="Item Name"
                                />
                            </CardHeader>
                            <CardContent>
                                <Input 
                                    type="number"
                                    defaultValue={item.amount}
                                    onBlur={e => handleItemChange(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                    className="text-3xl font-black h-auto p-0 bg-transparent border-0 border-b rounded-none focus-visible:ring-0" 
                                    placeholder="Amount"
                                />
                                <div className="flex justify-between items-end mt-2">
                                    <div className="space-y-1">
                                         <Input 
                                            defaultValue={item.nextLoad} 
                                            onBlur={e => handleItemChange(item.id, 'nextLoad', e.target.value)}
                                            className="text-xs text-muted-foreground bg-transparent border-0 border-b rounded-none h-auto p-0 focus-visible:ring-0" 
                                            placeholder="Next Load Date"
                                        />
                                        <Input
                                            defaultValue={item.frequency}
                                            onBlur={e => handleItemChange(item.id, 'frequency', e.target.value)}
                                            className="text-xs font-semibold text-primary bg-transparent border-0 border-b rounded-none h-auto p-0 focus-visible:ring-0" 
                                            placeholder="Frequency"
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="overflow-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Frequency</TableHead>
                                <TableHead>Next Auto-Load</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-center w-[100px]">Active</TableHead>
                                <TableHead className="text-center w-[80px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items && items.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Input defaultValue={item.name} onBlur={e => handleItemChange(item.id, 'name', e.target.value)} className="bg-transparent border-0" />
                                    </TableCell>
                                    <TableCell>
                                         <Select value={item.category} onValueChange={(value) => handleItemChange(item.id, 'category', value)}>
                                            <SelectTrigger className="bg-transparent border-0">
                                                <SelectValue placeholder="Select Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {procurementCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input defaultValue={item.frequency} onBlur={e => handleItemChange(item.id, 'frequency', e.target.value)} className="bg-transparent border-0" />
                                    </TableCell>
                                    <TableCell>
                                        <Input defaultValue={item.nextLoad} onBlur={e => handleItemChange(item.id, 'nextLoad', e.target.value)} className="bg-transparent border-0" />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Input type="number" defaultValue={item.amount} onBlur={e => handleItemChange(item.id, 'amount', parseFloat(e.target.value) || 0)} className="w-24 text-right bg-transparent border-0 font-mono" />
                                    </TableCell>
                                    <TableCell className="flex justify-center">
                                        <Switch id={`switch-list-${item.id}`} checked={item.active} onCheckedChange={(checked) => handleItemChange(item.id, 'active', checked)} aria-label="Toggle item status"/>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
