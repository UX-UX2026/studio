'use client';

import { useUser, type UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, setDoc } from "firebase/firestore";
import type { ApprovalRequest } from "@/lib/approvals-mock-data";
import { SubmissionClient } from "@/components/app/submission-client";
import { useToast } from "@/hooks/use-toast";

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

type Department = {
    id: string;
    name: string;
    workflow?: any[];
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};


export default function SubmissionPage() {
    const { user, role, department: userDepartment, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    // State for the submission client
    const [items, setItems] = useState<Item[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date(new Date().getFullYear() + 2, 1, 1));
    const selectedPeriod = useMemo(() => format(selectedDate, "MMMM yyyy"), [selectedDate]);
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

    const requestsQuery = useMemo(() => collection(firestore, 'procurementRequests'), [firestore]);
    const { data: allRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(requestsQuery);

    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    // This effect will load an existing request for editing, or clear the items for a new one.
    useEffect(() => {
        if (requestsLoading || deptsLoading || !userDepartment || !departments) return;

        const department = departments.find(d => d.name === userDepartment);
        if (!department) return;

        const existingRequest = allRequests?.find(req => req.departmentId === department.id && req.period === selectedPeriod);

        if (existingRequest) {
            setItems(existingRequest.items);
            setEditingRequestId(existingRequest.id);
        } else {
            // Here you might want to pre-load recurring items if this page should support it
            // For now, we start fresh.
            setItems([]);
            setEditingRequestId(null);
        }
    }, [selectedPeriod, allRequests, requestsLoading, deptsLoading, userDepartment, departments]);

    const handleSaveRequest = async (isDraft: boolean) => {
        const department = departments?.find(d => d.name === userDepartment);
        if (!user || !userDepartment || !department || !firestore) {
            toast({ variant: "destructive", title: "Cannot save", description: "User or department information is missing." });
            return;
        }

        const activePipelineRequest = allRequests?.find(req => 
            req.departmentId === department.id && 
            req.period === selectedPeriod &&
            req.id !== editingRequestId &&
            !['Draft', 'Completed', 'Rejected', 'Queries Raised'].includes(req.status)
        );

        if (role !== 'Administrator' && activePipelineRequest) {
            toast({
                variant: "destructive",
                title: "Active Submission Exists",
                description: "A request for this period is already in the approval process. You cannot submit another.",
            });
            return;
        }

        const newStatus = isDraft ? 'Draft' : 'Pending Manager Approval';
        const periodSubmissionTotal = items.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);

        const departmentWorkflow = department?.workflow;
        
        const defaultTimeline = [
            { stage: "Request Submission", actor: user.displayName || 'Requester', date: new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }), status: 'completed' as const },
            { stage: "Manager Review", actor: "Manager", date: null, status: newStatus === 'Draft' ? 'waiting' : ('pending' as const) },
            { stage: "Executive Review", actor: "Executive", date: null, status: 'waiting' as const },
            { stage: "Procurement Ack.", actor: "Procurement", date: null, status: 'waiting' as const },
        ];
        
        const timeline = departmentWorkflow && departmentWorkflow.length > 0
          ? departmentWorkflow.map((stage: any, index: number) => ({
              stage: stage.name,
              actor: String(stage.role) || 'System',
              date: index === 0 ? new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : null,
              status: index === 0 ? 'completed' as const : (index === 1 && !isDraft ? 'pending' as const : 'waiting' as const),
          }))
          : defaultTimeline;
        
        if (timeline.length > 0) {
            timeline[0].actor = user.displayName || 'Requester';
            if(isDraft) {
                for (let i = 1; i < timeline.length; i++) {
                    timeline[i].status = 'waiting';
                }
            }
        }

        const requestData = {
            department: userDepartment,
            departmentId: department.id,
            period: selectedPeriod,
            total: periodSubmissionTotal,
            status: newStatus,
            submittedBy: user.displayName,
            submittedById: user.uid,
            timeline: timeline,
            comments: editingRequestId ? allRequests?.find(r => r.id === editingRequestId)?.comments || [] : [],
            items: items,
        };

        const action = isDraft ? 'request.draft_save' : 'request.submit';

        try {
            let docId = editingRequestId;
            if (docId) {
                const requestRef = doc(firestore, 'procurementRequests', docId);
                await setDoc(requestRef, requestData, { merge: true });
            } else {
                const requestsCollectionRef = collection(firestore, 'procurementRequests');
                const docRef = await addDoc(requestsCollectionRef, { ...requestData, createdAt: serverTimestamp() });
                docId = docRef.id;
                setEditingRequestId(docId);
            }

            toast({ 
                title: isDraft ? "Draft Saved" : "Request Submitted", 
                description: `Your procurement request for ${selectedPeriod} has been successfully ${isDraft ? 'saved' : 'submitted'}.` 
            });

            addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `${isDraft ? (editingRequestId ? 'Updated draft' : 'Created draft') : 'Submitted request'} for ${selectedPeriod}.`,
                entity: { type: 'procurementRequest', id: docId },
                timestamp: serverTimestamp()
            }).catch(error => console.error("Failed to write to audit log:", error));

        } catch (error: any) {
            console.error("Submit Request Error:", error);
            toast({
                variant: "destructive",
                title: "Submission Failed",
                description: error.message || "Could not submit the request. You may not have permissions.",
            });
            try {
                await addDoc(collection(firestore, 'errorLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action,
                    errorMessage: error.message,
                    errorStack: error.stack,
                    timestamp: serverTimestamp()
                });
            } catch (logError) {
                console.error("Failed to write to error log:", logError);
            }
        }
    };

    useEffect(() => {
      const allowedRoles = ['Manager', 'Administrator', 'Requester', 'Executive'];
      if (userLoading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }
      if (role && !allowedRoles.includes(role)) {
        router.push('/dashboard');
      }
    }, [user, role, userLoading, router]);

    const loading = userLoading || requestsLoading || deptsLoading;
    const allowedRoles = useMemo(() => ['Manager', 'Administrator', 'Requester', 'Executive'], []);

    if (loading || !user || !role || !allowedRoles.includes(role)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
  return (
    <Card>
      <CardHeader>
        <CardTitle>Period Procurement Submission</CardTitle>
        <CardDescription>
          Create and manage your procurement request for the selected period.
          Recurring items are automatically included.
        </CardDescription>
        <div className="pt-4">
            <div className="grid max-w-sm items-center gap-1.5">
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
        </div>
      </CardHeader>
      <CardContent>
        <SubmissionClient 
            userRole={role} 
            items={items}
            setItems={setItems}
            selectedPeriod={selectedPeriod}
            onSaveDraft={() => handleSaveRequest(true)}
            onSubmitRequest={() => handleSaveRequest(false)}
            allRequests={allRequests || []}
        />
      </CardContent>
    </Card>
  );
}

    