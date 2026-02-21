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
import { Lock, Plus, Trash2, Wand2, Upload, Download, Calendar as CalendarIcon } from "lucide-react";
import {
  suggestProcurementCategory,
  SuggestProcurementCategoryOutput,
} from "@/ai/flows/suggest-procurement-category-flow";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { type UserRole, useUser } from "@/firebase/auth/use-user";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, query, where, serverTimestamp } from "firebase/firestore";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";


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
};

type RecurringItem = {
    id: string;
    category: string;
    name: string;
    amount: number;
    active: boolean;
};

type WorkflowStage = {
    id: string;
    name: string;
    role: any;
    permissions: string[];
};

type Department = {
    id: string;
    name: string;
    workflow?: WorkflowStage[];
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

export function SubmissionClient({ userRole, userDepartment }: { userRole: UserRole, userDepartment: string | null }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date(new Date().getFullYear() + 2, 1, 1));
  const selectedPeriod = useMemo(() => format(selectedDate, "MMMM yyyy"), [selectedDate]);
  const { user } = useUser();
  
  const firestore = useFirestore();
  const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
  const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

  const recurringItemsQuery = useMemo(() => query(collection(firestore, 'recurringItems'), where('active', '==', true)), [firestore]);
  const { data: recurringItems, loading: recurringLoading } = useCollection<RecurringItem>(recurringItemsQuery);

  useEffect(() => {
    if (recurringItems) {
        const recurringSubmissionItems: Item[] = recurringItems.map(item => ({
            id: item.id,
            type: "Recurring",
            description: item.name,
            brand: item.name.split(" ")[0], // Simple brand extraction
            qty: 1,
            category: item.category,
            unitPrice: item.amount,
            fulfillmentStatus: 'Pending',
            receivedQty: 0,
            fulfillmentComments: [],
        }));
        setItems(recurringSubmissionItems);
    }
  }, [recurringItems]);


  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  useEffect(() => {
    if (departments && departments.length > 0 && !selectedDepartment) {
        if ((userRole === 'Manager' || userRole === 'Requester') && userDepartment) {
            const departmentFromLive = departments.find(d => d.name === userDepartment);
            if (departmentFromLive) {
                setSelectedDepartment(departmentFromLive.id);
                return;
            }
        }
        // Default for admin or if department not found
        const defaultDept = departments.find(d => d.name === 'ICT') || departments[0];
        if (defaultDept) {
            setSelectedDepartment(defaultDept.id);
        }
    }
  }, [departments, userRole, userDepartment, selectedDepartment]);


  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SuggestProcurementCategoryOutput | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const departmentName = useMemo(() => {
      return departments?.find(d => d.id === selectedDepartment)?.name || '';
  }, [selectedDepartment, departments]);

   const procurementRequestsQuery = useMemo(() => {
        if (!firestore || !departmentName) return null;
        return query(
            collection(firestore, 'procurementRequests'),
            where('department', '==', departmentName)
        );
    }, [firestore, departmentName]);

    const { data: procurementRequests } = useCollection<ApprovalRequest>(procurementRequestsQuery);

    const periodStatuses = useMemo(() => {
        const statuses: Record<string, { status: ApprovalRequest['status'], id: string }> = {};
        if (procurementRequests) {
            procurementRequests.forEach(req => {
                statuses[req.period] = { status: req.status, id: req.id };
            });
        }
        return statuses;
  }, [procurementRequests]);


  const isLocked = useMemo(() => {
      const periodStatusInfo = periodStatuses[selectedPeriod];
      if (!periodStatusInfo) return false;

      const { status } = periodStatusInfo;
      
      // Lock if completed or pending at executive level
      if (status === 'Completed' || status === 'Pending Executive' || status === 'Approved' || status === 'In Fulfillment') {
          return true;
      }
      // Lock for requesters once submitted to manager
      if (userRole === 'Requester' && status === 'Pending Manager Approval') {
          return true;
      }
      // Lock for managers if they submitted and it's pending for executive
      if (userRole === 'Manager' && status === 'Pending Executive') {
          return true;
      }

      return false;
  }, [selectedPeriod, periodStatuses, userRole]);

  const departmentWorkflow = useMemo(() => {
    const dept = departments?.find(d => d.id === selectedDepartment);
    return dept?.workflow;
  }, [selectedDepartment, departments]);


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
      fulfillmentStatus: 'Pending',
      receivedQty: 0,
      fulfillmentComments: [],
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
                    fulfillmentStatus: 'Pending',
                    receivedQty: 0,
                    fulfillmentComments: [],
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

  const handleSubmitRequest = async () => {
    if (!user || !departmentName || !selectedDepartment || !firestore) {
        toast({ variant: "destructive", title: "Cannot submit", description: "User or department information is missing." });
        return;
    }
    
    const defaultTimeline = [
        { stage: "Request Submission", actor: user.displayName || 'Requester', date: new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }), status: 'completed' as const },
        { stage: "Manager Review", actor: "Manager", date: null, status: 'pending' as const },
        { stage: "Executive Review", actor: "Executive", date: null, status: 'waiting' as const },
        { stage: "Procurement Ack.", actor: "Procurement", date: null, status: 'waiting' as const },
    ];
    
    const timeline = departmentWorkflow && departmentWorkflow.length > 0
      ? departmentWorkflow.map((stage, index) => ({
          stage: stage.name,
          actor: stage.role || 'System',
          date: index === 0 ? new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : null,
          status: index === 0 ? 'completed' as const : (index === 1 ? 'pending' as const : 'waiting' as const),
      }))
      : defaultTimeline;
    
    // The first stage is always submission, so let's ensure the actor is the current user.
    if (timeline.length > 0) {
        timeline[0].actor = user.displayName || 'Requester';
    }

    const newRequest = {
        department: departmentName,
        departmentId: selectedDepartment,
        period: selectedPeriod,
        total,
        status: 'Pending Manager Approval',
        submittedBy: user.displayName,
        submittedById: user.uid,
        createdAt: serverTimestamp(),
        timeline: timeline,
        comments: [],
        items,
    };

    try {
        const requestsCollectionRef = collection(firestore, 'procurementRequests');
        const docRef = await addDoc(requestsCollectionRef, newRequest);
        
        await addDoc(collection(firestore, 'auditLogs'), {
            userId: user.uid,
            userName: user.displayName,
            action: 'request.create',
            details: `Submitted request for ${selectedPeriod} for department ${departmentName} with total ${formatCurrency(total)}.`,
            entity: { type: 'procurementRequest', id: docRef.id },
            timestamp: serverTimestamp()
        });
        toast({ title: "Request Submitted", description: `Your procurement request for ${selectedPeriod} has been submitted for manager approval.` });

    } catch (error: any) {
        console.error("Submit Request Error:", error);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: error.message || "Could not submit the request. You may not have permissions.",
        });
    }
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
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !selectedDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "MMMM yyyy") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                                if(date) setSelectedDate(date)
                            }}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
            {userRole === 'Administrator' ? (
                <div className="grid w-full md:max-w-xs items-center gap-1.5">
                    <Label htmlFor="department">Department</Label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment} disabled={deptsLoading}>
                        <SelectTrigger id="department">
                            <SelectValue placeholder={deptsLoading ? "Loading..." : "Select department"} />
                        </SelectTrigger>
                        <SelectContent>
                            {departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            ) : (
                <div className="grid w-full md:max-w-xs items-center gap-1.5">
                    <Label>Department</Label>
                    <Input type="text" value={departmentName} readOnly className="bg-muted/50 border-0" />
                </div>
            )}
        </div>
        <div className="p-4 text-right rounded-lg bg-primary/10 border-primary/20 border shrink-0">
            <p className="text-xs font-bold uppercase text-primary">Estimated Period Total</p>
            <p className="text-2xl font-black text-primary">{formatCurrency(total)}</p>
        </div>
      </div>
      
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
              <Button className="shadow-lg shadow-primary/20" onClick={handleSubmitRequest}>Submit Period Request</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
