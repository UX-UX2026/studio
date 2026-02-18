"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, List } from "lucide-react";

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

export function RecurringClient({ items }: { items: RecurringItem[] }) {
    const [view, setView] = useState<'grid' | 'list'>('grid');
    const [itemStatus, setItemStatus] = useState<Record<string, boolean>>(
        items.reduce((acc, item) => ({...acc, [item.id]: item.active }), {})
    );

    const handleStatusChange = (itemId: string, newStatus: boolean) => {
        setItemStatus(prev => ({ ...prev, [itemId]: newStatus }));
        // Here you would typically call an API to update the backend
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
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

            {view === 'grid' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map(item => (
                        <Card key={item.id} className="flex flex-col justify-between hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-sm font-medium uppercase text-primary tracking-wider">{item.category}</CardTitle>
                                    <Switch id={`switch-grid-${item.id}`} checked={itemStatus[item.id]} onCheckedChange={(checked) => handleStatusChange(item.id, checked)} aria-label="Toggle item status"/>
                                </div>
                                <CardDescription className="!mt-2 text-base font-semibold text-foreground">{item.name}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-black">{formatCurrency(item.amount)}</p>
                                <div className="flex justify-between items-end mt-2">
                                    <p className="text-xs text-muted-foreground">Next Auto-Load: {item.nextLoad}</p>
                                    <p className="text-xs font-semibold text-primary">{item.frequency}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Frequency</TableHead>
                            <TableHead>Next Auto-Load</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center w-[100px]">Active</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="font-semibold">{item.name}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell>{item.frequency}</TableCell>
                                <TableCell>{item.nextLoad}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                                <TableCell className="flex justify-center">
                                    <Switch id={`switch-list-${item.id}`} checked={itemStatus[item.id]} onCheckedChange={(checked) => handleStatusChange(item.id, checked)} aria-label="Toggle item status"/>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
