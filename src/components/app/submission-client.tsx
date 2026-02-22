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
import { Lock, Plus, Trash2, Wand2, Upload, Download } from "lucide-react";
import {
  suggestProcurementCategory,
  SuggestProcurementCategoryOutput,
} from "@/ai/flows/suggest-procurement-category-flow";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { type UserRole } from "@/firebase/auth/use-user";
import { cn } from "@/lib/utils";

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
};

type ApprovalRequest = {
    id: string;
    department: string;
    period: string;
    total: number;
    status: "Pending Executive" | "Completed" | "Queries Raised" | "Pending Manager Approval" | "Approved" | 'Rejected' | 'Draft' | 'In Fulfillment';
    submittedBy: string;
    timeline: { stage: string; actor: string; date: string | null; status: 'completed' | 'pending' | 'waiting' }[];
    comments: { actor: string; actorId: string; text: string; timestamp: string }[];
    items: Item[];
};

const categories = [
  "Operational Lease/Rental - SA",
  "Tech Support - SA",
  "ICT Maintenance - SA",
  "Software Licenses",
  "Hardware Purchase",
  "Office Supplies",
  "Consulting Services",
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
};

export function SubmissionClient({ 
    userRole, 
    items,
    setItems,
    selectedPeriod,
    onSubmit,
    allRequests,
}: { 
    userRole: UserRole, 
    items: Item[],
    setItems: React.Dispatch<React.SetStateAction<Item[]>>,
    selectedPeriod: string,
    onSubmit: () => void,
    allRequests: ApprovalRequest[],
}) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SuggestProcurementCategoryOutput | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const periodStatuses = useMemo(() => {
      const statuses: Record<string, { status: ApprovalRequest['status'], id: string }> = {};
      if (allRequests) {
          allRequests.forEach(req => {
              statuses[req.period] = { status: req.status, id: req.id };
          });
      }
      return statuses;
  }, [allRequests]);


  const isLocked = useMemo(() => {
      const periodStatusInfo = periodStatuses[selectedPeriod];
      if (!periodStatusInfo) return false;

      const { status } = periodStatusInfo;
      
      if (status === 'Completed' || status === 'Pending Executive' || status === 'Approved' || status === 'In Fulfillment') {
          return true;
      }
      if (userRole === 'Requester' && status === 'Pending Manager Approval') {
          return true;
      }
      if (userRole === 'Manager' && status === 'Pending Executive') {
          return true;
      }

      return false;
  }, [selectedPeriod, periodStatuses, userRole]);


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
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id: number | string) => {
    setItems(prev => prev.filter((item) => item.id !== id));
  };
  
  const handleGetSuggestion = async (description: string, itemId: number | string) => {
    if (!description) {
      toast({
        variant: "destructive",
        title: "No Description",
        description: "Please enter an item description to get suggestions.",
      });
      return;
    }
    setIsLoadingAi(true);
    setSuggestions(null);
    try {
      const result = await suggestProcurementCategory({ itemDescription: description });
      setSuggestions(result);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "AI Suggestion Failed",
        description: "Could not fetch procurement category suggestions.",
      });
    } finally {
      setIsLoadingAi(false);
    }
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExport = () => {
    if (items.length === 0) {
        toast({ title: "No Data to Export", description: "There are no submission items to export." });
        return;
    }

    const headers: (keyof Item)[] = ['id', 'type', 'description', 'brand', 'qty', 'category', 'unitPrice', 'comments'];
    const csvContent = [
        headers.join(','),
        ...items.map(item =>
            headers.map(header => `"${(item as any)[header] || ''}"`).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'submission-items.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
  
  const handleRequestEdit = () => {
    toast({
      title: "Edit Request Sent",
      description: "Your manager has been notified of your request to edit this submission. This is a placeholder action.",
    });
  };

  return (
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
                  <p className="text-xs">It has been submitted for approval and can no longer be edited.</p>
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
              <TableHead className="w-[250px]">Line Item</TableHead>
              <TableHead className="w-[200px]">Comments</TableHead>
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
                    readOnly={isLocked || item.type === "Recurring"}
                    className="bg-transparent border-0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    value={item.brand}
                    onChange={(e) => handleItemChange(item.id, "brand", e.target.value)}
                    readOnly={isLocked || item.type === "Recurring"}
                    className="bg-transparent border-0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.qty}
                    onChange={(e) => handleItemChange(item.id, "qty", parseInt(e.target.value, 10))}
                    readOnly={isLocked || (item.type === 'Recurring' && userRole !== 'Manager' && userRole !== 'Administrator')}
                    className="w-16 bg-transparent border-0"
                  />
                </TableCell>
                <TableCell className="flex items-center gap-1">
                   <Select
                        value={item.category}
                        onValueChange={(value) => handleItemChange(item.id, "category", value)}
                        disabled={isLocked || item.type === 'Recurring'}
                    >
                        <SelectTrigger className="w-full bg-transparent border-0">
                            <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  {item.type === 'One-Off' && (
                    <Popover onOpenChange={() => setSuggestions(null)}>
                      <PopoverTrigger asChild>
                         <Button variant="ghost" size="icon" onClick={() => handleGetSuggestion(item.description, item.id)} disabled={isLocked || isLoadingAi}>
                           <Wand2 className={`h-4 w-4 ${isLoadingAi ? 'animate-pulse' : ''}`}/>
                         </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Suggested..." />
                          <CommandList>
                            <CommandEmpty>{isLoadingAi ? 'Getting suggestions...' : 'No suggestions found.'}</CommandEmpty>
                            <CommandGroup>
                              {suggestions?.suggestedCategories.map((suggestion) => (
                                <CommandItem
                                  key={suggestion}
                                  value={suggestion}
                                  onSelect={(currentValue) => {
                                      handleItemChange(item.id, "category", currentValue === item.category ? "" : currentValue)
                                  }}
                                >
                                  {suggestion}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
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
                <TableCell>
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(item.id, "unitPrice", parseFloat(e.target.value))}
                    readOnly={isLocked || item.type === "Recurring"}
                    className="w-24 text-right bg-transparent border-0"
                  />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(item.qty * item.unitPrice)}
                </TableCell>
                <TableCell className="text-center">
                  {item.type === "One-Off" && !isLocked ? (
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

      <div className="flex items-center justify-between pt-4">
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleAddItem} disabled={isLocked}>
            <Plus className="w-4 h-4 mr-2" />
            Add Manual Item
            </Button>
            <Button variant="outline" onClick={handleImportClick} disabled={isLocked}>
                <Upload className="h-4 w-4 mr-2" /> Import
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isLocked}>
                <Download className="h-4 w-4 mr-2" /> Export
            </Button>
        </div>
        <div className="flex gap-3">
          {isLocked ? (
            <Button onClick={handleRequestEdit}>Request Edit</Button>
          ): (
            <>
              <Button variant="ghost">Save as Draft</Button>
              <Button className="shadow-lg shadow-primary/20" onClick={onSubmit}>Submit Period Request</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
