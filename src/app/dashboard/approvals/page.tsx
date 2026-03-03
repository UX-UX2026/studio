
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Check, MessageSquare, Paperclip, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where, doc, updateDoc, arrayUnion, addDoc, serverTimestamp } from "firebase/firestore";
import type { ApprovalRequest } from "@/lib/approvals-mock-data";
import { useRoles } from "@/lib/roles-provider";
import { logErrorToFirestore } from "@/lib/error-logger";


const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Pending Manager Approval': return <Badge variant="outline" className="text-blue-500 border-blue-500">Pending Manager</Badge>;
        case 'Pending Executive': return <Badge variant="outline" className="text-orange-500 border-orange-500">Pending Executive</Badge>;
        case 'Approved': return <Badge variant="outline" className="text-purple-500 border-purple-500">Approved</Badge>;
        case 'In Fulfillment': return <Badge variant="outline" className="text-indigo-500 border-indigo-500">In Fulfillment</Badge>;
        case 'Completed': return <Badge variant="outline" className="text-green-500 border-green-500">Completed</Badge>;
        case 'Queries Raised': return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{status}</Badge>;
        case 'Rejected': return <Badge variant="destructive">{status}</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>
    }
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
};

export default function ApprovalsPage() {
    const { user, role, department, loading: userLoading } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { roles, loading: rolesLoading } = useRoles();

    const requestsQuery = useMemo(() => {
        if (!firestore || !role) return null;

        const baseQuery = collection(firestore, 'procurementRequests');

        if (role === 'Administrator') {
            return query(baseQuery); // All requests
        }
        if (role === 'Executive') {
            return query(baseQuery, where('status', 'in', ['Pending Executive', 'Pending Manager Approval', 'Approved', 'Queries Raised']));
        }
        if (role === 'Manager') {
            if (!department) return null; // Manager must have a department
            return query(baseQuery, where('department', '==', department));
        }
        if (role === 'Procurement Officer') {
            return query(baseQuery, where('status', 'in', ['Approved', 'In Fulfillment', 'Completed']));
        }

        return null; // No requests for other roles on this page
    }, [firestore, role, department]);

    const { data: approvals, loading: approvalsLoading } = useCollection<ApprovalRequest>(requestsQuery);
    
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [newComment, setNewComment] = useState("");
    const [isQueryDialogOpen, setIsQueryDialogOpen] = useState(false);
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    const loading = userLoading || approvalsLoading || rolesLoading;

    useEffect(() => {
        const reqId = searchParams.get('id');
        if (reqId) {
            setSelectedRequestId(reqId);
        }
    }, [searchParams]);

    const filteredRequests = useMemo(() => {
        if (!approvals) return [];
        return approvals;
    }, [approvals]);

    useEffect(() => {
        if (!selectedRequestId && filteredRequests.length > 0) {
            const firstPending = filteredRequests.find(a => a.status.startsWith('Pending') || a.status === 'Approved');
            setSelectedRequestId(firstPending?.id || filteredRequests[0]?.id || null);
        }
    }, [filteredRequests, selectedRequestId]);

    const activeRequest = useMemo(() => approvals?.find((req) => req.id === selectedRequestId), [selectedRequestId, approvals]);


    const approvalSummary = useMemo(() => {
        const pending = filteredRequests.filter(req => req.status.startsWith('Pending') || req.status === 'Approved' || req.status === 'Queries Raised');
        const totalValue = pending.reduce((sum, req) => sum + req.total, 0);
        const byDept = pending.reduce((acc, req) => {
            if (!acc[req.department]) {
                acc[req.department] = { count: 0, total: 0 };
            }
            acc[req.department].count++;
            acc[req.department].total += req.total;
            return acc;
        }, {} as Record<string, { count: number, total: number }>);
        
        return {
            pendingCount: pending.length,
            totalValue,
            byDept: Object.entries(byDept).sort((a, b) => b[1].total - a[1].total),
        }
    }, [filteredRequests]);

    const requestsByDept = useMemo(() => {
        return filteredRequests.reduce((acc, req) => {
            if (!acc[req.department]) {
                acc[req.department] = [];
            }
            acc[req.department].push(req);
            return acc;
        }, {} as Record<string, ApprovalRequest[]>);
    }, [filteredRequests]);

    const departmentOrder = useMemo(() => Object.keys(requestsByDept), [requestsByDept]);


    useEffect(() => {
      if (loading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }
      const userPerms = roles.find(r => r.name === role)?.permissions || [];
      if (role !== 'Administrator' && !userPerms.includes('approvals:view')) {
          router.push('/dashboard');
      }
    }, [user, role, roles, loading, router]);
    
    if (loading || !user || !role) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleApprove = async () => {
        if (!activeRequest || !selectedRequestId || !user || !firestore) return;

        setIsSubmittingAction(true);
        let newStatus: ApprovalRequest['status'] = activeRequest.status;
        let newTimeline = [...activeRequest.timeline];
        let toastMessage: {title: string, description: string} | null = null;

        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });

        if (role === 'Administrator') {
            if (activeRequest.status === 'Pending Manager Approval' || activeRequest.status === 'Queries Raised') {
                newStatus = 'Pending Executive';
                toastMessage = { title: "Request Stage Advanced", description: `Admin approved. Forwarded for executive approval.`};
                newTimeline = newTimeline.map(step => {
                    if (step.stage === 'Manager Review') return { ...step, status: 'completed' as const, date: currentDate, actor: user.displayName || 'Administrator' };
                    if (step.stage === 'Executive Review') return { ...step, status: 'pending' as const };
                    return step;
                });
            } else if (activeRequest.status === 'Pending Executive') {
                newStatus = 'Approved';
                toastMessage = { title: "Request Stage Advanced", description: `Admin approved. Sent for processing.` };
                newTimeline = newTimeline.map(step => {
                    if (step.stage === 'Executive Review') return { ...step, status: 'completed' as const, date: currentDate, actor: user.displayName || 'Administrator' };
                    if (step.stage === 'Manager Review' && step.status !== 'completed') return { ...step, status: 'completed' as const, date: currentDate, actor: step.actor };
                    if (step.stage === 'Procurement Ack.') return { ...step, status: 'pending' as const };
                    return step;
                });
            } else if (activeRequest.status === 'Approved') {
                newStatus = 'In Fulfillment';
                toastMessage = { title: "Request Acknowledged", description: `Admin action. Request is now in fulfillment.`};
                newTimeline = newTimeline.map(step => {
                    if (step.stage === 'Procurement Ack.') return { ...step, status: 'completed' as const, date: currentDate, actor: user.displayName || 'Administrator' };
                    return step;
                });
            }
        } else if (role === 'Manager' && (activeRequest.status === 'Pending Manager Approval' || activeRequest.status === 'Queries Raised')) {
            newStatus = 'Pending Executive';
            toastMessage = { title: "Request Approved", description: `${activeRequest.id.substring(0,8)}... has been forwarded for executive approval.` };
            newTimeline = newTimeline.map(step => {
                if (step.stage === 'Manager Review') return { ...step, status: 'completed' as const, date: currentDate, actor: user.displayName || 'Manager' };
                if (step.stage === 'Executive Review') return { ...step, status: 'pending' as const };
                return step;
            });
        } else if (role === 'Executive' && (activeRequest.status === 'Pending Executive' || activeRequest.status === 'Pending Manager Approval' || activeRequest.status === 'Queries Raised')) {
            newStatus = 'Approved';
            toastMessage = { title: "Request Approved", description: `${activeRequest.id.substring(0,8)}... has been approved and sent for processing.` };
            newTimeline = newTimeline.map(step => {
                if (step.stage === 'Executive Review') return { ...step, status: 'completed' as const, date: currentDate, actor: user.displayName || 'Executive' };
                if (step.stage === 'Manager Review' && step.status !== 'completed') return { ...step, status: 'completed' as const, date: currentDate, actor: step.actor };
                if (step.stage === 'Procurement Ack.') return { ...step, status: 'pending' as const };
                return step;
            });
        } else if (role === 'Procurement Officer' && activeRequest.status === 'Approved') {
            newStatus = 'In Fulfillment';
            toastMessage = { title: "Request Acknowledged", description: `Request ${activeRequest.id.substring(0,8)}... is now in fulfillment.` };
            newTimeline = newTimeline.map(step => {
                if (step.stage === 'Procurement Ack.') return { ...step, status: 'completed' as const, date: currentDate, actor: user.displayName || 'Procurement Officer' };
                return step;
            });
        }

        if (!toastMessage) {
            setIsSubmittingAction(false);
            return;
        }

        const requestRef = doc(firestore, 'procurementRequests', selectedRequestId);
        const updateData = { status: newStatus, timeline: newTimeline };
        const action = 'request.approve';

        const finalToastMessage = toastMessage;
        
        try {
            await updateDoc(requestRef, updateData);
            toast(finalToastMessage);

            const auditLogData = {
                userId: user.uid,
                userName: user.displayName || 'System',
                action,
                details: `Approved request ${activeRequest.id.substring(0,8)}..., new status "${newStatus}"`,
                entity: { type: 'procurementRequest', id: selectedRequestId },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
        } catch (error: any) {
            console.error("Approval Error:", error);
            toast({
                variant: "destructive",
                title: "Approval Failed",
                description: error.message || "Could not update the request. Please check your connection and try again.",
            });
            await logErrorToFirestore({
                userId: user.uid,
                userName: user.displayName || 'System',
                action: 'request.approve',
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };
    
    const handleReject = async () => {
        if (!activeRequest || !selectedRequestId || !user || !firestore) return;
        setIsSubmittingAction(true);

        const newStatus: ApprovalRequest['status'] = 'Rejected';
        
        const requestRef = doc(firestore, 'procurementRequests', selectedRequestId);
        const updateData = { status: newStatus };
        const action = 'request.reject';

        try {
            await updateDoc(requestRef, updateData);
            toast({
                title: "Request Rejected",
                description: `Request ${activeRequest.id.substring(0,8)}... has been rejected.`,
            });

            const auditLogData = {
                userId: user.uid,
                userName: user.displayName || 'System',
                action,
                details: `Rejected request ${activeRequest.id.substring(0,8)}...`,
                entity: { type: 'procurementRequest', id: selectedRequestId },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
        } catch(error: any) {
            console.error("Reject Error:", error);
            toast({
                variant: "destructive",
                title: "Reject Failed",
                description: error.message || "Could not update the request. Please check your connection and try again.",
            });
            await logErrorToFirestore({
                userId: user.uid,
                userName: user.displayName || 'System',
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };
    
    const handleRaiseQuery = async () => {
        if (!activeRequest || !selectedRequestId || !user || !firestore) return;

        if (!newComment.trim()) {
            toast({
                variant: "destructive",
                title: "Comment Required",
                description: "Please enter a comment before submitting a query.",
            });
            return;
        }

        setIsSubmittingAction(true);
        const newStatus: ApprovalRequest['status'] = 'Queries Raised';

        const commentData = {
            actor: user.displayName || "User",
            actorId: user.uid,
            text: newComment,
            timestamp: new Date().toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        };

        const requestRef = doc(firestore, 'procurementRequests', selectedRequestId);
        const updateData = { 
            status: newStatus,
            comments: arrayUnion(commentData)
        };
        const action = 'request.query';
        
        try {
            await updateDoc(requestRef, updateData);
            toast({
                title: "Query Raised",
                description: `A query has been raised on request ${activeRequest.id.substring(0,8)}...`,
            });
            setNewComment("");
            setIsQueryDialogOpen(false);
            
            const auditLogData = {
                userId: user.uid,
                userName: user.displayName || 'System',
                action,
                details: `Raised query on request ${activeRequest.id.substring(0,8)}...`,
                entity: { type: 'procurementRequest', id: selectedRequestId },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
        } catch (error: any) {
            console.error("Raise Query Error:", error);
            toast({
                variant: "destructive",
                title: "Query Failed",
                description: error.message || "Could not update the request. Please check your connection and try again.",
            });
             await logErrorToFirestore({
                userId: user.uid,
                userName: user.displayName || 'System',
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };


    const handleAddComment = async () => {
        if (!activeRequest || !user || !newComment.trim() || !firestore) return;

        setIsSubmittingAction(true);
        const commentData = {
            actor: user.displayName || "User",
            actorId: user.uid,
            text: newComment,
            timestamp: new Date().toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        };
        const updateData = { comments: arrayUnion(commentData) };
        const requestRef = doc(firestore, "procurementRequests", activeRequest.id);
        const action = 'request.comment';

        try {
            await updateDoc(requestRef, updateData);
            toast({ title: "Comment added" });
            setNewComment("");

            const auditLogData = {
                userId: user.uid,
                userName: user.displayName || 'System',
                action,
                details: `Added comment to request ${activeRequest.id.substring(0,8)}...`,
                entity: { type: 'procurementRequest', id: activeRequest.id },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
        } catch (error: any) {
             console.error("Add Comment Error:", error);
             toast({
                variant: "destructive",
                title: "Comment Failed",
                description: error.message || "Could not add comment. Please check your connection and try again.",
            });
            await logErrorToFirestore({
                userId: user.uid,
                userName: user.displayName || 'System',
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };
    
  return (
    <>
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle>Approvals Overview</CardTitle>
                        <CardDescription>Summary of requests awaiting your action.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Pending Requests</span>
                                <span className="font-bold text-lg">{approvalSummary.pendingCount}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Total Value</span>
                                <span className="font-bold text-lg">{formatCurrency(approvalSummary.totalValue)}</span>
                            </div>
                            <div className="space-y-2 pt-2">
                                <h4 className="text-sm font-medium">By Department</h4>
                                {approvalSummary.byDept.length > 0 ? (
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                        {approvalSummary.byDept.map(([dept, data]) => (
                                            <div key={dept} className="flex justify-between">
                                                <span>{dept}</span>
                                                <span className="font-mono text-foreground font-semibold">{data.count} ({formatCurrency(data.total)})</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-2">No pending requests.</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">All Requests</h3>
                    <Accordion type="multiple" className="w-full space-y-2" defaultValue={departmentOrder}>
                        {departmentOrder.map(dept => (
                            <AccordionItem value={dept} key={dept} className="border-0 rounded-lg bg-muted/50">
                                <AccordionTrigger className="px-3 py-2 hover:no-underline rounded-lg data-[state=open]:bg-muted">
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-semibold">{dept}</span>
                                        <Badge variant="secondary" className="mr-4">{requestsByDept[dept].length}</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-2 pt-0">
                                    <div className="space-y-2">
                                        {requestsByDept[dept].map(req => (
                                            <Card 
                                                key={req.id} 
                                                className={cn("cursor-pointer transition-colors bg-background", selectedRequestId === req.id ? 'bg-primary/10 border-primary/50' : 'hover:bg-muted/50')}
                                                onClick={() => setSelectedRequestId(req.id)}
                                            >
                                                <CardContent className="p-3">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-semibold">{req.id.substring(0,8)}...</p>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                    <div className="flex justify-between items-end mt-2">
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">{req.period}</p>
                                                            <p className="text-lg font-bold">{formatCurrency(req.total)}</p>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">By: {req.submittedBy}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </div>
            <div className="lg:col-span-2 space-y-6">
                {activeRequest ? (
                    <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                        <AccordionItem value="item-1" className="border-0">
                            <Card>
                                <AccordionTrigger className="w-full text-left p-6 hover:no-underline rounded-lg data-[state=open]:rounded-b-none">
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-semibold leading-none tracking-tight">Request: {activeRequest.id.substring(0,8)}...</h3>
                                        <p className="text-sm text-muted-foreground mt-1.5">{activeRequest.period} - {activeRequest.department} - {formatCurrency(activeRequest.total)}</p>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <CardContent className="pt-0">
                                    <Tabs defaultValue="items">
                                            <TabsList className="grid w-full grid-cols-3">
                                                <TabsTrigger value="workflow">Approval Workflow</TabsTrigger>
                                                <TabsTrigger value="items">Line Items ({activeRequest.items.length})</TabsTrigger>
                                                <TabsTrigger value="communication">Communication Log</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="workflow" className="pt-6">
                                                <ul className="space-y-4">
                                                    {activeRequest.timeline.map(step => (
                                                        <li key={step.stage} className="flex items-center gap-4">
                                                            <div className={`flex items-center justify-center h-10 w-10 rounded-full ${step.status === 'completed' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                                {step.status === 'completed' ? <Check className="h-5 w-5" /> : <User className="h-5 w-5"/>}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-semibold">{step.stage}</p>
                                                                <p className="text-sm text-muted-foreground">{step.actor}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-medium">{step.date}</p>
                                                                <p className={`text-xs font-semibold capitalize ${step.status === 'completed' ? 'text-green-500' : 'text-orange-500'}`}>{step.status}</p>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </TabsContent>
                                            <TabsContent value="items" className="pt-4">
                                                <div>
                                                    <h3 className="text-lg font-semibold mb-2">Request Items</h3>
                                                    <p className="text-sm text-muted-foreground mb-4">
                                                        Below are the individual items included in this procurement request.
                                                    </p>
                                                    <div className="overflow-auto rounded-lg border">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted hover:bg-muted">
                                                                    <TableHead>Description</TableHead>
                                                                    <TableHead>Category</TableHead>
                                                                    <TableHead className="text-center">Qty</TableHead>
                                                                    <TableHead className="text-right">Unit Price</TableHead>
                                                                    <TableHead className="text-right">Total</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {activeRequest.items.map((item) => (
                                                                    <TableRow key={item.id}>
                                                                        <TableCell className="font-medium">{item.description}</TableCell>
                                                                        <TableCell>{item.category}</TableCell>
                                                                        <TableCell className="text-center">{item.qty}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(item.qty * item.unitPrice)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="communication" className="pt-6">
                                                <div className="space-y-6">
                                                    <div className="space-y-4">
                                                        {activeRequest.comments?.map((comment, i) => (
                                                            <div key={i} className="flex items-start gap-3">
                                                                <Avatar>
                                                                    <AvatarFallback>{comment.actor.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex-1 p-3 rounded-lg bg-muted">
                                                                    <div className="flex justify-between items-center">
                                                                        <p className="font-semibold">{comment.actor}</p>
                                                                        <p className="text-xs text-muted-foreground">{comment.timestamp}</p>
                                                                    </div>
                                                                    <p className="text-sm mt-1">{comment.text}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(!activeRequest.comments || activeRequest.comments?.length === 0) && (
                                                            <p className="text-sm text-center text-muted-foreground py-4">No comments on this request yet.</p>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <Textarea placeholder="Respond to queries or add a comment..." className="pr-24" value={newComment} onChange={(e) => setNewComment(e.target.value)}/>
                                                        <div className="absolute top-2 right-2 flex items-center gap-1">
                                                            <Button variant="ghost" size="icon"><Paperclip className="h-4 w-4"/></Button>
                                                            <Button size="icon" onClick={handleAddComment} disabled={isSubmittingAction}><Send className="h-4 w-4"/></Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TabsContent>
                                    </Tabs>
                                    </CardContent>
                                    {(activeRequest.status.startsWith('Pending') || activeRequest.status === 'Approved' || activeRequest.status === 'Queries Raised') && (
                                        <CardFooter className="flex justify-end gap-2 border-t pt-6">
                                            <Button variant="outline" onClick={() => setIsQueryDialogOpen(true)} disabled={isSubmittingAction}><MessageSquare className="mr-2 h-4 w-4" />Raise Query</Button>
                                            <Button variant="destructive" onClick={handleReject} disabled={isSubmittingAction}><X className="mr-2 h-4 w-4" />Reject</Button>
                                            <Button onClick={handleApprove} disabled={isSubmittingAction}>
                                                {isSubmittingAction && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                                                <Check className="mr-2 h-4 w-4" />
                                                {role === 'Procurement Officer' ? 'Acknowledge & Process' : 'Approve'}
                                            </Button>
                                        </CardFooter>
                                    )}
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                    </Accordion>
                ) : (
                    <Card>
                        <CardContent className="p-12 flex justify-center items-center h-full min-h-[300px]">
                            <p className="text-muted-foreground">Select a request to view its details.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
        
        <Dialog open={isQueryDialogOpen} onOpenChange={setIsQueryDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Raise a Query</DialogTitle>
                    <DialogDescription>
                        Your query will be added to the communication log and the request status will be updated to 'Queries Raised'.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea 
                        placeholder="Enter your query here. Be specific about what information is needed." 
                        value={newComment} 
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={5}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsQueryDialogOpen(false); setNewComment(''); }}>Cancel</Button>
                    <Button onClick={handleRaiseQuery} disabled={isSubmittingAction}>
                        {isSubmittingAction && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                        Submit Query
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}
