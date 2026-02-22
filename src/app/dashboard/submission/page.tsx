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

    const handleSubmitRequest = async () => {
        const department = departments?.find(d => d.name === userDepartment);
        if (!user || !userDepartment || !department || !firestore) {
            toast({ variant: "destructive", title: "Cannot submit", description: "User or department information is missing." });
            return;
        }

        const periodSubmissionTotal = items.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);

        const departmentWorkflow = department?.workflow;
        
        const defaultTimeline = [
            { stage: "Request Submission", actor: user.displayName || 'Requester', date: new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }), status: 'completed' as const },
            { stage: "Manager Review", actor: "Manager", date: null, status: 'pending' as const },
            { stage: "Executive Review", actor: "Executive", date: null, status: 'waiting' as const },
            { stage: "Procurement Ack.", actor: "Procurement", date: null, status: 'waiting' as const },
        ];
        
        const timeline = departmentWorkflow && departmentWorkflow.length > 0
          ? departmentWorkflow.map((stage: any, index: number) => ({
              stage: stage.name,
              actor: String(stage.role) || 'System',
              date: index === 0 ? new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : null,
              status: index === 0 ? 'completed' as const : (index === 1 ? 'pending' as const : 'waiting' as const),
          }))
          : defaultTimeline;
        
        if (timeline.length > 0) {
            timeline[0].actor = user.displayName || 'Requester';
        }

        const requestData = {
            department: userDepartment,
            departmentId: department.id,
            period: selectedPeriod,
            total: periodSubmissionTotal,
            status: 'Pending Manager Approval',
            submittedBy: user.displayName,
            submittedById: user.uid,
            timeline: timeline,
            comments: [],
            items: items,
        };

        try {
            if (editingRequestId) {
                const requestRef = doc(firestore, 'procurementRequests', editingRequestId);
                await setDoc(requestRef, requestData, { merge: true });
                 toast({ title: "Request Updated & Submitted", description: `Your procurement request for ${selectedPeriod} has been submitted.` });
            } else {
                const requestsCollectionRef = collection(firestore, 'procurementRequests');
                await addDoc(requestsCollectionRef, { ...requestData, createdAt: serverTimestamp() });
                toast({ title: "Request Submitted", description: `Your procurement request for ${selectedPeriod} has been submitted for manager approval.` });
            }
        } catch (error: any) {
            console.error("Submit Request Error:", error);
            toast({
                variant: "destructive",
                title: "Submission Failed",
                description: error.message || "Could not submit the request. You may not have permissions.",
            });
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
            onSubmit={handleSubmitRequest}
            allRequests={allRequests || []}
        />
      </CardContent>
    </Card>
  );
}
