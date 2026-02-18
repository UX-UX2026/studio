"use client";

import { useState, useMemo, useRef } from "react";
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
import { recurringItems, oneOffSubmissionItems } from "@/lib/mock-data";
import { Label } from "@/components/ui/label";
import { mockDepartments } from "@/lib/departments-mock-data";


type Item = {
  id: number | string;
  type: "Recurring" | "One-Off";
  description: string;
  brand: string;
  qty: number;
  category: string;
  unitPrice: number;
};

// Map recurring items to the submission item format
const recurringSubmissionItems: Item[] = recurringItems
  .filter(item => item.active)
  .map(item => ({
    id: item.id,
    type: "Recurring",
    description: item.name,
    brand: item.name.split(" ")[0], // Simple brand extraction
    qty: 1,
    category: item.category,
    unitPrice: item.amount,
  }));

const initialItems: Item[] = [
    ...recurringSubmissionItems,
    ...oneOffSubmissionItems
];

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

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currentYear = new Date().getFullYear();
const periods = months.map(m => `${m} ${currentYear + 2}`); // Matching the mock data year format


export function SubmissionClient() {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [selectedPeriod, setSelectedPeriod] = useState(periods[1]); // Default to Feb 2026
  const [selectedDepartment, setSelectedDepartment] = useState(mockDepartments.find(d => d.name === 'ICT')?.id || mockDepartments[0].id);

  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SuggestProcurementCategoryOutput | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const total = useMemo(() => {
    return items.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);
  }, [items]);

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
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: number | string) => {
    setItems(items.filter((item) => item.id !== id));
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

    const headers: (keyof Item)[] = ['id', 'type', 'description', 'brand', 'qty', 'category', 'unitPrice'];
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
    <div className="space-y-6">
       <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv"
            onChange={handleFileChange}
        />
      <div className="flex flex-col justify-between gap-4 pb-6 border-b md:flex-row md:items-center">
        <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="grid w-full md:max-w-xs items-center gap-1.5">
                <Label htmlFor="period">Procurement Period</Label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger id="period">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        {periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid w-full md:max-w-xs items-center gap-1.5">
                <Label htmlFor="department">Department</Label>
                 <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger id="department">
                        <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                        {mockDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
        <div className="p-4 text-right rounded-lg bg-primary/10 border-primary/20 border shrink-0">
            <p className="text-xs font-bold uppercase text-primary">Estimated Period Total</p>
            <p className="text-2xl font-black text-primary">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="-mx-6 overflow-x-auto">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead>Item / Service Description</TableHead>
              <TableHead className="w-[150px]">Brand</TableHead>
              <TableHead className="w-[80px]">Qty</TableHead>
              <TableHead className="w-[250px]">Line Item</TableHead>
              <TableHead className="w-[120px] text-right">Unit Price</TableHead>
              <TableHead className="w-[120px] text-right">Total</TableHead>
              <TableHead className="w-[80px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.id} className={item.type === 'Recurring' ? 'bg-muted/50' : ''}>
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
                    readOnly={item.type === "Recurring"}
                    className="bg-transparent border-0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    value={item.brand}
                    onChange={(e) => handleItemChange(item.id, "brand", e.target.value)}
                    readOnly={item.type === "Recurring"}
                    className="bg-transparent border-0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.qty}
                    onChange={(e) => handleItemChange(item.id, "qty", parseInt(e.target.value, 10))}
                    readOnly={item.type === "Recurring"}
                    className="w-16 bg-transparent border-0"
                  />
                </TableCell>
                <TableCell className="flex items-center gap-1">
                   <Select
                        value={item.category}
                        onValueChange={(value) => handleItemChange(item.id, "category", value)}
                        disabled={item.type === 'Recurring'}
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
                         <Button variant="ghost" size="icon" onClick={() => handleGetSuggestion(item.description, item.id)} disabled={isLoadingAi}>
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
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(item.id, "unitPrice", parseFloat(e.target.value))}
                    readOnly={item.type === "Recurring"}
                    className="w-24 text-right bg-transparent border-0"
                  />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(item.qty * item.unitPrice)}
                </TableCell>
                <TableCell className="text-center">
                  {item.type === "One-Off" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
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
            <Button variant="outline" onClick={handleAddItem}>
            <Plus className="w-4 h-4 mr-2" />
            Add Manual Item
            </Button>
            <Button variant="outline" onClick={handleImportClick}>
                <Upload className="h-4 w-4 mr-2" /> Import
            </Button>
            <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" /> Export
            </Button>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost">Save as Draft</Button>
          <Button className="shadow-lg shadow-primary/20">Submit Period Request</Button>
        </div>
      </div>
    </div>
  );
}
