"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, List, Plus, Trash2 } from "lucide-react";
import { Input } from "../ui/input";

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

export function RecurringClient({ items: initialItems }: { items: RecurringItem[] }) {
    const [items, setItems] = useState<RecurringItem[]>(initialItems);
    const [view, setView] = useState<'grid' | 'list'>('grid');

    const handleItemChange = (id: string, field: keyof RecurringItem, value: any) => {
        setItems((prevItems) =>
            prevItems.map((item) =>
              item.id === id ? { ...item, [field]: value } : item
            )
        );
    };

    const handleAddItem = () => {
        const newItem: RecurringItem = {
          id: `rec-${Date.now()}`,
          name: "",
          category: "",
          amount: 0,
          nextLoad: "",
          frequency: "Monthly",
          active: true,
        };
        setItems([...items, newItem]);
        setView('list'); // Switch to list view for easier editing
    };
    
    const handleRemoveItem = (id: string) => {
        setItems(items.filter((item) => item.id !== id));
    };


    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <Button onClick={handleAddItem} className="shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4 mr-2"/>
                    New Recurring Item
                </Button>
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
                                    <Switch id={`switch-grid-${item.id}`} checked={item.active} onCheckedChange={(checked) => handleItemChange(item.id, 'active', checked)} aria-label="Toggle item status"/>
                                </div>
                                <CardDescription className="!mt-2 text-base font-semibold text-foreground">{item.name}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-black">{formatCurrency(item.amount)}</p>
                                <div className="flex justify-between items-end mt-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Next Auto-Load: {item.nextLoad}</p>
                                        <p className="text-xs font-semibold text-primary">{item.frequency}</p>
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
                        {items.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <Input value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} className="bg-transparent border-0" />
                                </TableCell>
                                <TableCell>
                                    <Input value={item.category} onChange={e => handleItemChange(item.id, 'category', e.target.value)} className="bg-transparent border-0" />
                                </TableCell>
                                <TableCell>
                                    <Input value={item.frequency} onChange={e => handleItemChange(item.id, 'frequency', e.target.value)} className="bg-transparent border-0" />
                                </TableCell>
                                <TableCell>
                                    <Input value={item.nextLoad} onChange={e => handleItemChange(item.id, 'nextLoad', e.target.value)} className="bg-transparent border-0" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Input type="number" value={item.amount} onChange={e => handleItemChange(item.id, 'amount', parseFloat(e.target.value) || 0)} className="w-24 text-right bg-transparent border-0 font-mono" />
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
            )}
        </div>
    );
}
