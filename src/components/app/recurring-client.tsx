
"use client";

import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { Input } from "../ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { procurementCategories } from "@/lib/procurement-categories";
import { Label } from "../ui/label";

type RecurringItem = {
    id: string;
    category: string;
    name: string;
    amount: number;
    expenseType: 'Operational' | 'Capital';
    nextLoad: string;
    active: boolean;
    frequency: string;
    departmentId?: string;
    departmentName?: string;
};

// This component now only handles rendering the items
export function RecurringClient({ items, view = 'list' }: { items: RecurringItem[], view?: 'grid' | 'list' }) {
    const firestore = useFirestore();
    const { user, role } = useUser();
    const { toast } = useToast();

    // Requesters and Managers can manage recurring items for their own department.
    // Admins and Procurement staff can manage all.
    const canManage = useMemo(() => {
        if (!role) return false;
        return ['Administrator', 'Procurement Officer', 'Manager', 'Requester'].includes(role);
    }, [role]);

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

    if (view === 'grid') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items && items.map(item => (
                    <Card key={item.id} className="flex flex-col justify-between hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <div className="flex justify-between items-start gap-2">
                                 <Select value={item.category} onValueChange={(value) => handleItemChange(item.id, 'category', value)} disabled={!canManage}>
                                    <SelectTrigger className="text-sm font-medium uppercase text-primary tracking-wider bg-transparent border-0 border-b rounded-none focus-visible:ring-0 p-0 h-auto">
                                        <SelectValue placeholder="Category"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {procurementCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Switch id={`switch-grid-${item.id}`} checked={item.active} onCheckedChange={(checked) => handleItemChange(item.id, 'active', checked)} aria-label="Toggle item status" disabled={!canManage}/>
                            </div>
                            <Input 
                                defaultValue={item.name} 
                                onBlur={e => handleItemChange(item.id, 'name', e.target.value)} 
                                className="!mt-2 text-base font-semibold text-foreground bg-transparent border-0 border-b rounded-none focus-visible:ring-0 px-0 h-auto"
                                placeholder="Item Name"
                                readOnly={!canManage}
                            />
                        </CardHeader>
                        <CardContent>
                            <Input 
                                type="number"
                                defaultValue={item.amount}
                                onBlur={e => handleItemChange(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                className="text-3xl font-black h-auto p-0 bg-transparent border-0 border-b rounded-none focus-visible:ring-0" 
                                placeholder="Amount"
                                readOnly={!canManage}
                            />
                             <div className="mt-2">
                                <Label className="text-xs text-muted-foreground">Expense Type</Label>
                                <Select value={item.expenseType || 'Operational'} onValueChange={(value) => handleItemChange(item.id, 'expenseType', value as any)} disabled={!canManage}>
                                    <SelectTrigger className="text-xs h-8 mt-1">
                                        <SelectValue/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Operational">Operational</SelectItem>
                                        <SelectItem value="Capital">Capital</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-between items-end mt-2">
                                <div className="space-y-1">
                                     <Input 
                                        defaultValue={item.nextLoad} 
                                        onBlur={e => handleItemChange(item.id, 'nextLoad', e.target.value)}
                                        className="text-xs text-muted-foreground bg-transparent border-0 border-b rounded-none h-auto p-0 focus-visible:ring-0" 
                                        placeholder="Next Load Date"
                                        readOnly={!canManage}
                                    />
                                    <Input
                                        defaultValue={item.frequency}
                                        onBlur={e => handleItemChange(item.id, 'frequency', e.target.value)}
                                        className="text-xs font-semibold text-primary bg-transparent border-0 border-b rounded-none h-auto p-0 focus-visible:ring-0" 
                                        placeholder="Frequency"
                                        readOnly={!canManage}
                                    />
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} disabled={!canManage}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="overflow-auto rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Expense Type</TableHead>
                        {(role === 'Administrator' || role === 'Procurement Officer') && <TableHead>Department</TableHead>}
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
                                <Input defaultValue={item.name} onBlur={e => handleItemChange(item.id, 'name', e.target.value)} className="bg-transparent border-0" readOnly={!canManage}/>
                            </TableCell>
                            <TableCell>
                                 <Select value={item.category} onValueChange={(value) => handleItemChange(item.id, 'category', value)} disabled={!canManage}>
                                    <SelectTrigger className="bg-transparent border-0">
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {procurementCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell>
                                <Select value={item.expenseType || 'Operational'} onValueChange={(value) => handleItemChange(item.id, 'expenseType', value as any)} disabled={!canManage}>
                                    <SelectTrigger className="bg-transparent border-0">
                                        <SelectValue/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Operational">Operational</SelectItem>
                                        <SelectItem value="Capital">Capital</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>
                             {(role === 'Administrator' || role === 'Procurement Officer') && <TableCell>{item.departmentName || 'N/A'}</TableCell>}
                            <TableCell>
                                <Input defaultValue={item.frequency} onBlur={e => handleItemChange(item.id, 'frequency', e.target.value)} className="bg-transparent border-0" readOnly={!canManage}/>
                            </TableCell>
                            <TableCell>
                                <Input defaultValue={item.nextLoad} onBlur={e => handleItemChange(item.id, 'nextLoad', e.target.value)} className="bg-transparent border-0" readOnly={!canManage}/>
                            </TableCell>
                            <TableCell className="text-right">
                                <Input type="number" defaultValue={item.amount} onBlur={e => handleItemChange(item.id, 'amount', parseFloat(e.target.value) || 0)} className="w-24 text-right bg-transparent border-0 font-mono" readOnly={!canManage}/>
                            </TableCell>
                            <TableCell className="flex justify-center">
                                <Switch id={`switch-list-${item.id}`} checked={item.active} onCheckedChange={(checked) => handleItemChange(item.id, 'active', checked)} aria-label="Toggle item status" disabled={!canManage}/>
                            </TableCell>
                            <TableCell className="text-center">
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} disabled={!canManage}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

    