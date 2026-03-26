
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Lock, Plus, Trash2, Upload, Paperclip, History, Loader } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type User, type UserRole, type UserProfile } from "@/firebase/auth/use-user";
import { cn } from "@/lib/utils";
import { procurementCategories } from "@/lib/procurement-categories";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { Label } from "@/components/ui/label";
import * as XLSX from 'xlsx';


type Item = {
  id: number | string;
  type: "Recurring" | "One-Off";
  expenseType: 'Operational' | 'Capital';
  description: string;
  brand: string;
  qty: number;
  category: string;
  unitPrice: number;
  fulfillmentStatus: 'Pending' | 'Sourcing' | 'Quoted' | 'Ordered' | 'Completed';
  receivedQty: number;
  fulfillmentComments: string[];
  comments?: string;
  addedById?: string;
  addedByName?: string;
};

type RecurringItem = {
    id: string;
    category: string;
    name: string;
    amount: number;
    active: boolean;
    expenseType?: 'Operational' | 'Capital';
};

type BudgetItem = {
    id: string;
    departmentId: string;
    category: string;
    expenseType?: 'Operational' | 'Capital';
    forecasts: number[];
    yearTotal: number;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
};

const ExpenseTable = ({
    title,
    items,
    canEditItem,
    canRemoveItem,
    handleItemChange,
    handleRemoveItem,
    isLocked,
    onAddItem,
    onImport,
    categories,
} : {
    title: string;
    items: Item[];
    canEditItem: (item: Item) => boolean;
    canRemoveItem: (item: Item) => boolean;
    handleItemChange: (id: string | number, field: keyof Item, value: any) => void;
    handleRemoveItem: (id: string | number) => void;
    isLocked: boolean;
    onAddItem: () => void;
    onImport: () => void;
    categories: string[];
}) => {
    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                {!isLocked && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onImport}>
                            <Upload className="h-4 w-4 mr-2" /> Import CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={onAddItem}>
                            <Plus className="w-4 h-4 mr-2" /> Add Item
                        </Button>
                    </div>
                )}
            </div>
            <div className="overflow-auto border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead>Item / Service Description</TableHead>
                        <TableHead className="w-[150px]">Brand</TableHead>
                        <TableHead className="w-[80px]">Qty</TableHead>
                        <TableHead className="w-[250px]">Category</TableHead>
                        <TableHead className="w-[200px]">Comments</TableHead>
                        <TableHead className="w-[150px]">Added By</TableHead>
                        <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                        <TableHead className="w-[120px] text-right">Total</TableHead>
                        <TableHead className="w-[80px] text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => (
                        <TableRow key={item.id} className={cn(item.type === 'Recurring' ? 'bg-muted/50' : '', isLocked && 'text-muted-foreground')}>
                            <TableCell>
                            <Badge variant={item.type === "Recurring" ? "secondary" : "outline"}>
                                {item.type}
                            </Badge>
                            </TableCell>
                            <TableCell>
                            <Input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                                readOnly={!canEditItem(item)}
                            />
                            </TableCell>
                            <TableCell>
                            <Input
                                type="text"
                                value={item.brand}
                                onChange={(e) => handleItemChange(item.id, "brand", e.target.value)}
                                readOnly={!canEditItem(item)}
                            />
                            </TableCell>
                            <TableCell>
                            <Input
                                type="number"
                                value={item.qty}
                                onChange={(e) => handleItemChange(item.id, "qty", parseInt(e.target.value, 10))}
                                readOnly={!canEditItem(item)}
                                className="w-16"
                            />
                            </TableCell>
                            <TableCell>
                            <Select
                                    value={item.category}
                                    onValueChange={(value) => handleItemChange(item.id, "category", value)}
                                    disabled={!canEditItem(item)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell>
                            <Input
                                type="text"
                                value={item.comments || ""}
                                onChange={(e) => handleItemChange(item.id, "comments", e.target.value)}
                                readOnly={isLocked}
                                placeholder="Add a comment..."
                            />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                                {item.addedByName || 'System'}
                            </TableCell>
                            <TableCell>
                            <Input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(item.id, "unitPrice", parseFloat(e.target.value))}
                                readOnly={!canEditItem(item)}
                                className="w-24 text-right"
                            />
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                            {formatCurrency(item.qty * item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-center">
                            {canRemoveItem(item) ? (
                                <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={isLocked}
                                >
                                <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            ) : (
                                <Lock className="h-4 w-4 mx-auto text-muted-foreground" />
                            )}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export function SubmissionClient({ 
    user,
    profile,
    userRole, 
    items,
    setItems,
    isLocked,
    recurringItems,
    recurringLoading,
    departmentId,
    departmentName,
    budgetItems,
}: { 
    user: User,
    profile: UserProfile | null,
    userRole: UserRole, 
    items: Item[],
    setItems: React.Dispatch<React.SetStateAction<Item[]>>,
    isLocked: boolean,
    recurringItems: RecurringItem[] | null,
    recurringLoading: boolean,
    departmentId: string,
    departmentName: string,
    budgetItems: BudgetItem[] | null,
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firestore = useFirestore();
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [isCreateRecurringDialogOpen, setIsCreateRecurringDialogOpen] = useState(false);

  const [newRecurringName, setNewRecurringName] = useState('');
  const [newRecurringCategory, setNewRecurringCategory] = useState('');
  const [newRecurringAmount, setNewRecurringAmount] = useState(0);
  const [newRecurringFrequency, setNewRecurringFrequency] = useState('Monthly');
  const [isCreatingRecurring, setIsCreatingRecurring] = useState(false);

  const availableRecurringItems = useMemo(() => {
    if (!recurringItems) return [];
    const submissionItemDescriptions = new Set(items.map(item => item.description));
    return recurringItems.filter(item => !submissionItemDescriptions.has(item.name));
  }, [items, recurringItems]);

    const departmentCategories = useMemo(() => {
        const categoriesFromBudget = budgetItems?.map(item => item.category).filter(Boolean) || [];
        const categoriesFromCurrentItems = items.map(item => item.category).filter(Boolean);
        const combined = new Set([...categoriesFromBudget, ...categoriesFromCurrentItems]);
        if (!combined.has('Uncategorized')) {
            combined.add('Uncategorized');
        }
        return Array.from(combined).sort();
    }, [budgetItems, items]);

  const canEditItem = (item: Item) => {
    if (isLocked) return false;
    // Admins and Managers can edit anything.
    if (userRole === 'Administrator' || userRole === 'Manager') return true;

    // Nobody other than Admin/Manager can edit recurring items.
    if (item.type === 'Recurring') return false; 
    
    // Requesters can edit their own one-off items.
    if (userRole === 'Requester' && item.addedById === user.uid) return true;
    
    // Allow editing of legacy one-off items without an owner
    if (item.type === 'One-Off' && !item.addedById) return true; 

    return false;
  };

  const canRemoveItem = (item: Item) => {
    if (isLocked) return false;
    // Admins and Managers can remove anything from a draft.
    if (userRole === 'Administrator' || userRole === 'Manager') return true; 
    
    // Requesters can remove items they added themselves.
    if (userRole === 'Requester' && item.addedById === user.uid) return true;

    // For legacy ONE-OFF items without an owner, let requesters remove them.
    if (userRole === 'Requester' && !item.addedById && item.type === 'One-Off') return true;

    return false;
  }

  const handleItemChange = (id: number | string, field: keyof Item, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddItem = (expenseType: 'Operational' | 'Capital') => {
    const newItem: Item = {
      id: Date.now(),
      type: "One-Off",
      expenseType: expenseType,
      description: "",
      brand: "",
      qty: 1,
      category: "",
      unitPrice: 0,
      fulfillmentStatus: 'Pending',
      receivedQty: 0,
      fulfillmentComments: [],
      comments: "",
      addedById: user.uid,
      addedByName: profile?.displayName || user.email || 'User',
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id: number | string) => {
    setItems(prev => prev.filter((item) => item.id !== id));
  };

  const handleAddRecurringFromMaster = (itemToAdd: RecurringItem) => {
    const newItem: Item = {
      id: itemToAdd.id, // Use master item ID
      type: "Recurring",
      expenseType: itemToAdd.expenseType || 'Operational', // Use from master, default to Operational
      description: itemToAdd.name,
      brand: itemToAdd.name.split(" ")[0] || '',
      qty: 1,
      category: itemToAdd.category,
      unitPrice: itemToAdd.amount,
      fulfillmentStatus: 'Pending',
      receivedQty: 0,
      fulfillmentComments: [],
      addedById: user.uid,
      addedByName: profile?.displayName || user.email || 'User',
    };
    setItems(prev => [...prev, newItem]);
    toast({ title: "Item Added", description: `Added "${itemToAdd.name}" to the submission.`})
  };
  
  const handleImportClick = (expenseType: 'Operational' | 'Capital') => {
    if (fileInputRef.current) {
        fileInputRef.current.setAttribute('data-expense-type', expenseType);
        fileInputRef.current.click();
    }
  };

  const handleCreateNewRecurringItem = async () => {
    if (!user || !profile || !firestore || !departmentId || !departmentName) {
        toast({ variant: "destructive", title: "Cannot create item", description: "User or department information is missing." });
        return;
    }
    if (!newRecurringName.trim() || !newRecurringCategory.trim()) {
        toast({ variant: "destructive", title: "Missing fields", description: "Name and Category are required." });
        return;
    }

    setIsCreatingRecurring(true);
    const action = 'recurringItem.create_from_submission';

    const newRecurringData = {
        name: newRecurringName,
        category: newRecurringCategory,
        amount: newRecurringAmount,
        frequency: newRecurringFrequency,
        expenseType: 'Operational', // New recurring items default to Operational
        nextLoad: 'TBD',
        active: true,
        departmentId: departmentId,
        departmentName: departmentName,
    };

    try {
        const docRef = await addDoc(collection(firestore, 'recurringItems'), newRecurringData);
        toast({ title: "New Recurring Item Created", description: `"${newRecurringName}" was added to the master list.` });
        
        await addDoc(collection(firestore, 'auditLogs'), {
            userId: user.uid,
            userName: profile.displayName || user.email,
            action,
            details: `Created recurring item "${newRecurringName}" from submission page for ${departmentName}`,
            entity: { type: 'recurringItem', id: docRef.id },
            timestamp: serverTimestamp()
        });

        const itemForSubmission: Item = {
            id: docRef.id,
            type: "Recurring",
            expenseType: 'Operational',
            description: newRecurringData.name,
            brand: newRecurringData.name.split(" ")[0] || '',
            qty: 1,
            category: newRecurringData.category,
            unitPrice: newRecurringData.amount,
            fulfillmentStatus: 'Pending',
            receivedQty: 0,
            fulfillmentComments: [],
            addedById: user.uid,
            addedByName: profile.displayName || user.email || 'User',
        };
        setItems(prev => [...prev, itemForSubmission]);

        setNewRecurringName('');
        setNewRecurringCategory('');
        setNewRecurringAmount(0);
        setNewRecurringFrequency('Monthly');
        setIsCreateRecurringDialogOpen(false);
        setIsRecurringDialogOpen(false);
    } catch (error: any) {
        console.error("Create Recurring Item Error:", error);
        toast({ variant: 'destructive', title: 'Create Failed', description: error.message });
        await logErrorToFirestore(firestore, {
            userId: user.uid,
            userName: profile.displayName || user.email,
            action,
            errorMessage: error.message,
            errorStack: error.stack,
        });
    } finally {
        setIsCreatingRecurring(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const expenseType = event.currentTarget.getAttribute('data-expense-type') as 'Operational' | 'Capital' | undefined;
    const file = event.target.files?.[0];
    if (!file || !expenseType) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (rows.length < 2) throw new Error("CSV file must have a header and at least one data row.");

            const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
            const descIndex = headers.indexOf('description');
            const qtyIndex = headers.indexOf('qty');
            const priceIndex = headers.indexOf('unitprice');
            const brandIndex = headers.indexOf('brand');
            const categoryIndex = headers.indexOf('category');
            const commentsIndex = headers.indexOf('comments');

            if (descIndex === -1 || qtyIndex === -1 || priceIndex === -1) {
                throw new Error("CSV is missing required columns: description, qty, unitPrice.");
            }

            const newItems: Item[] = rows.slice(1).map((row, i) => {
                if (row.every(cell => cell === null || cell === '')) return null; // skip empty rows

                return {
                    id: Date.now() + i,
                    type: "One-Off",
                    expenseType: expenseType,
                    description: String(row[descIndex] || ''),
                    brand: brandIndex > -1 ? String(row[brandIndex] || '') : '',
                    qty: parseInt(String(row[qtyIndex]), 10) || 1,
                    category: categoryIndex > -1 ? String(row[categoryIndex] || '') : 'Uncategorized',
                    unitPrice: parseFloat(String(row[priceIndex])) || 0,
                    fulfillmentStatus: 'Pending',
                    receivedQty: 0,
                    fulfillmentComments: [],
                    comments: commentsIndex > -1 ? String(row[commentsIndex] || '') : "",
                    addedById: user.uid,
                    addedByName: profile?.displayName || user.email || 'User',
                };
            }).filter((item): item is Item => item !== null);
            
            setItems(prev => [...prev, ...newItems]);

            toast({ title: "Import Successful", description: `${newItems.length} ${expenseType.toLowerCase()} items were added.` });
        } catch (error: any) {
            console.error("CSV Parsing Error:", error);
            toast({ variant: "destructive", title: "Import Failed", description: error.message || "Could not parse the file." });
        } finally {
            if (event.target) event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const operationalItems = items.filter(item => item.expenseType === 'Operational' || !item.expenseType);
  const capitalItems = items.filter(item => item.expenseType === 'Capital');

  return (
    <>
    <div className="space-y-6">
       <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileChange}
        />
      
      {isLocked && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-100/80 border border-yellow-300 text-yellow-800">
              <Lock className="h-5 w-5"/>
              <div className="text-sm font-medium">
                  <p>This submission is locked.</p>
                  <p className="text-xs">It may be in the approval process or administratively locked.</p>
              </div>
          </div>
      )}

      <div className="space-y-8">
        <ExpenseTable 
            title="Operational Expenses"
            items={operationalItems}
            canEditItem={canEditItem}
            canRemoveItem={canRemoveItem}
            handleItemChange={handleItemChange}
            handleRemoveItem={handleRemoveItem}
            isLocked={isLocked}
            onAddItem={() => handleAddItem('Operational')}
            onImport={() => handleImportClick('Operational')}
            categories={departmentCategories}
        />
        <ExpenseTable 
            title="Capital Expenses"
            items={capitalItems}
            canEditItem={canEditItem}
            canRemoveItem={canRemoveItem}
            handleItemChange={handleItemChange}
            handleRemoveItem={handleRemoveItem}
            isLocked={isLocked}
            onAddItem={() => handleAddItem('Capital')}
            onImport={() => handleImportClick('Capital')}
            categories={departmentCategories}
        />
      </div>

      <div className="flex items-center justify-start pt-6 mt-6 border-t">
        <div className="flex gap-2 flex-wrap">
             <Button variant="outline" onClick={() => setIsRecurringDialogOpen(true)} disabled={isLocked}>
                <History className="w-4 h-4 mr-2" />
                Add Recurring Item
            </Button>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span tabIndex={0}>
                            <Button variant="outline" disabled>
                                <Paperclip className="h-4 w-4 mr-2" /> Attach Files
                            </Button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>File attachment integration (e.g., Google Drive) is planned for a future update.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
      </div>
    </div>
    
    <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Add Recurring Item to Submission</DialogTitle>
                <DialogDescription>
                    Select a master recurring item to add it to your current submission. Items already in the submission are not shown.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
                {recurringLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[100px] text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {availableRecurringItems.length > 0 ? (
                                availableRecurringItems.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>{item.category}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                                        <TableCell className="text-center">
                                            <Button size="sm" onClick={() => handleAddRecurringFromMaster(item)}>
                                                <Plus className="h-4 w-4 mr-2" /> Add
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        All master recurring items are already in this submission.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>
            <DialogFooter className="border-t pt-4 mt-4">
                <Button variant="outline" onClick={() => setIsCreateRecurringDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Recurring Item
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={isCreateRecurringDialogOpen} onOpenChange={setIsCreateRecurringDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create New Master Recurring Item</DialogTitle>
                <DialogDescription>
                    This item will be saved to the master list for <span className="font-bold">{departmentName}</span> and can be used in future submissions.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="rec-name" className="text-right">Name</Label>
                    <Input id="rec-name" value={newRecurringName} onChange={e => setNewRecurringName(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="rec-category" className="text-right">Category</Label>
                    <Select value={newRecurringCategory} onValueChange={setNewRecurringCategory}>
                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a category" /></SelectTrigger>
                        <SelectContent>
                            {departmentCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="rec-amount" className="text-right">Amount</Label>
                    <Input id="rec-amount" type="number" value={newRecurringAmount} onChange={e => setNewRecurringAmount(parseFloat(e.target.value) || 0)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="rec-frequency" className="text-right">Frequency</Label>
                    <Select value={newRecurringFrequency} onValueChange={setNewRecurringFrequency}>
                        <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                            <SelectItem value="Annually">Annually</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateRecurringDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateNewRecurringItem} disabled={isCreatingRecurring}>
                    {isCreatingRecurring && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                    Create and Add
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
