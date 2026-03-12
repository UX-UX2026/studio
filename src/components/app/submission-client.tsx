
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
import { type User, type UserRole } from "@/firebase/auth/use-user";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


type Item = {
  id: number | string;
  type: "Recurring" | "One-Off";
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
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
};

export function SubmissionClient({ 
    user,
    userRole, 
    items,
    setItems,
    isLocked,
    recurringItems,
    recurringLoading,
}: { 
    user: User,
    userRole: UserRole, 
    items: Item[],
    setItems: React.Dispatch<React.SetStateAction<Item[]>>,
    isLocked: boolean,
    recurringItems: RecurringItem[] | null,
    recurringLoading: boolean,
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);

  const availableRecurringItems = useMemo(() => {
    if (!recurringItems) return [];
    const submissionItemDescriptions = new Set(items.map(item => item.description));
    return recurringItems.filter(item => !submissionItemDescriptions.has(item.name));
  }, [items, recurringItems]);

  const canEditItem = (item: Item) => {
    if (isLocked) return false;
    if (userRole === 'Administrator' || userRole === 'Manager') return true;
    if (item.type === 'Recurring' && (userRole === 'Manager' || userRole === 'Administrator')) return true;
    if (item.type === 'Recurring') return false; // Requesters can't edit recurring items
    if (!item.addedById) return true; // Allow editing of legacy items without an owner
    if (userRole === 'Requester' && item.addedById === user.uid) return true;
    return false;
  };

  const handleItemChange = (id: number | string, field: keyof Item, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddItem = () => {
    const newItem: Item = {
      id: Date.now(),
      type: "One-Off",
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
      addedByName: user.displayName || user.email || 'User',
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
      description: itemToAdd.name,
      brand: itemToAdd.name.split(" ")[0] || '',
      qty: 1,
      category: itemToAdd.category,
      unitPrice: itemToAdd.amount,
      fulfillmentStatus: 'Pending',
      receivedQty: 0,
      fulfillmentComments: [],
    };
    setItems(prev => [...prev, newItem]);
    toast({ title: "Item Added", description: `Added "${itemToAdd.name}" to the submission.`})
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
            const rows = text.split('\n').filter(row => row.trim());
            if (rows.length < 2) throw new Error("CSV file must have a header and at least one data row.");

            const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
            
            const newItems: Item[] = rows.slice(1).map(row => {
                const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
                let item: any = {};
                headers.forEach((header, index) => {
                    item[header] = values[index];
                });

                if (item.type === 'Recurring') return null; // Don't import recurring items

                if (!item.description || !item.qty || !item.unitPrice) {
                    throw new Error("CSV for one-off items is missing required columns: description, qty, unitPrice.");
                }

                return {
                    id: item.id || Date.now() + Math.random(),
                    type: "One-Off",
                    description: item.description,
                    brand: item.brand || '',
                    qty: parseInt(item.qty, 10) || 1,
                    category: item.category || '',
                    unitPrice: parseFloat(item.unitPrice) || 0,
                    fulfillmentStatus: 'Pending',
                    receivedQty: 0,
                    fulfillmentComments: [],
                    comments: item.comments || "",
                    addedById: user.uid,
                    addedByName: user.displayName || user.email || 'User',
                };
            }).filter((item): item is Item => item !== null);
            
            setItems(prev => [...prev, ...newItems]);

            toast({ title: "Import Successful", description: `${newItems.length} one-off items were added.` });
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
    <div className="space-y-6">
       <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv"
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
            {items.map((item, index) => (
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
                    className="bg-transparent border-0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    value={item.brand}
                    onChange={(e) => handleItemChange(item.id, "brand", e.target.value)}
                    readOnly={!canEditItem(item)}
                    className="bg-transparent border-0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.qty}
                    onChange={(e) => handleItemChange(item.id, "qty", parseInt(e.target.value, 10))}
                    readOnly={!canEditItem(item)}
                    className="w-16 bg-transparent border-0"
                  />
                </TableCell>
                <TableCell>
                   <Select
                        value={item.category}
                        onValueChange={(value) => handleItemChange(item.id, "category", value)}
                        disabled={!canEditItem(item)}
                    >
                        <SelectTrigger className="w-full bg-transparent border-0">
                            <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                            {procurementCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    value={item.comments || ""}
                    onChange={(e) => handleItemChange(item.id, "comments", e.target.value)}
                    readOnly={isLocked}
                    className="bg-transparent border-0"
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
                    className="w-24 text-right bg-transparent border-0"
                  />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(item.qty * item.unitPrice)}
                </TableCell>
                <TableCell className="text-center">
                  {(item.type === "One-Off" && canEditItem(item)) ? (
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

      <div className="flex items-center justify-start pt-4">
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleAddItem} disabled={isLocked}>
                <Plus className="w-4 h-4 mr-2" />
                Add Manual Item
            </Button>
             <Button variant="outline" onClick={() => setIsRecurringDialogOpen(true)} disabled={isLocked}>
                <History className="w-4 h-4 mr-2" />
                Add Recurring Item
            </Button>
            <Button variant="outline" onClick={handleImportClick} disabled={isLocked}>
                <Upload className="h-4 w-4 mr-2" /> Import from CSV
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
        </DialogContent>
    </Dialog>
    </>
  );
}
