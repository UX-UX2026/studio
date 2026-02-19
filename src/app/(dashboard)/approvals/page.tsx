'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Check, MessageSquare, Paperclip, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ApprovalRequest, approvalsData as initialApprovalsData } from "@/lib/approvals-mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { capitalData as initialCapitalData, cashExpensesData as initialCashExpensesData } from "@/lib/summary-mock-data";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";


const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Pending Manager Approval': return <Badge variant="outline" className="text-blue-500 border-blue-500">Pending Manager</Badge>;
        case 'Pending Executive': return <Badge variant="outline" className="text-orange-500 border-orange-500">Pending Executive</Badge>;
        case 'Completed': return <Badge variant="outline" className="text-green-500 border-green-500">Completed</Badge>;
        case 'Queries Raised': return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{status}</Badge>;
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

const formatPercentage = (value: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};

export default function ApprovalsPage() {
    const { user, role, department, loading } = useUser();
    const router = useRouter();
    const { toast } = useToast();

    const [approvals, setApprovals] = useState(initialApprovalsData);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

    const filteredRequests = useMemo(() => {
        if (!role) return [];
        if (role === 'Manager') {
            return approvals.filter(req => 
                req.status === 'Pending Manager Approval' && req.department === department
            );
        }
        if (role === 'Executive') {
            return approvals.filter(req => req.status === 'Pending Executive' || req.status === 'Pending Manager Approval');
        }
        if (role === 'Administrator') {
            return approvals;
        }
        return [];
    }, [role, department, approvals]);

    useEffect(() => {
        const firstPending = filteredRequests.find(a => a.status.startsWith('Pending'));
        setSelectedRequestId(firstPending?.id || filteredRequests[0]?.id || null);
    }, [filteredRequests]);

    const activeRequest = useMemo(() => approvals.find((req) => req.id === selectedRequestId), [selectedRequestId, approvals]);

    // State for summary tables
    const [cashExpenses, setCashExpenses] = useState(initialCashExpensesData);
    const [capital, setCapital] = useState(initialCapitalData);
    const [currentPeriod, setCurrentPeriod] = useState('May');


    const approvalSummary = useMemo(() => {
        const pending = filteredRequests.filter(req => req.status.startsWith('Pending'));
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
      const allowedRoles = ['Executive', 'Administrator', 'Manager'];
      if (!loading && (!user || !role || !allowedRoles.includes(role))) {
        router.push('/');
      }
    }, [user, role, loading, router]);
    
    const userAvatar = PlaceHolderImages.find((img) => img.id === 'avatar-1');

    if (loading || !user || !role || !['Executive', 'Administrator', 'Manager'].includes(role)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    // Handlers for summary tables
    const handleCashCommentChange = (index: number, value: string) => {
        const updatedData = [...cashExpenses];
        updatedData[index].comments = value;
        setCashExpenses(updatedData);
    };

    const handleCapitalCommentChange = (index: number, value: string) => {
        const updatedData = [...capital];
        updatedData[index].comments = value;
        setCapital(updatedData);
    };

    // Placeholder for PDF generation and Google Drive upload
    async function archiveRequestToDrive(request: ApprovalRequest) {
        /*
        This is a placeholder function to demonstrate how you would implement
        PDF generation and Google Drive upload. A developer would need to integrate
        the necessary libraries and APIs.
        */
        console.log("Simulating PDF generation and upload for request:", request.id);
        return Promise.resolve();
    }

    const handleApprove = () => {
        if (!activeRequest || !selectedRequestId) return;

        let newStatus: ApprovalRequest['status'] = activeRequest.status;
        let newTimeline = [...activeRequest.timeline];
        let toastMessage = {};

        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });

        if (role === 'Manager' && activeRequest.status === 'Pending Manager Approval') {
            newStatus = 'Pending Executive';
            toastMessage = {
                title: "Request Approved",
                description: `${activeRequest.id} has been forwarded for executive approval.`,
            };
            newTimeline = newTimeline.map(step => {
                if (step.stage === 'Manager Review') {
                    return { ...step, status: 'completed' as const, date: currentDate };
                }
                if (step.stage === 'Executive Review') {
                    return { ...step, status: 'pending' as const };
                }
                return step;
            });
        } else if (role === 'Executive' && (activeRequest.status === 'Pending Executive' || activeRequest.status === 'Pending Manager Approval')) {
            newStatus = 'Completed';
            toastMessage = {
                title: "Request Approved & Archived",
                description: `A PDF for ${activeRequest.id} has been generated and saved to Google Drive. (Simulation)`,
            };
            newTimeline = newTimeline.map(step => {
                if (step.status !== 'completed') {
                     return { ...step, status: 'completed' as const, date: currentDate };
                }
                return step;
            });
            
            archiveRequestToDrive(activeRequest);
        }

        const updatedApprovals = approvals.map(req =>
            req.id === selectedRequestId ? { ...req, status: newStatus, timeline: newTimeline } : req
        );
        setApprovals(updatedApprovals);
        toast(toastMessage);
    };
    
    const subtotalProcurement = cashExpenses.reduce((sum, item) => sum + item.procurement, 0);
    const subtotalForecast = cashExpenses.reduce((sum, item) => sum + item.forecast, 0);
    const subtotalVsForecast = subtotalProcurement - subtotalForecast;

  return (
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
                                                    <p className="font-semibold">{req.id}</p>
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
                                    <h3 className="text-2xl font-semibold leading-none tracking-tight">Approval Request: {activeRequest.id}</h3>
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
                                            <div className="space-y-6">
                                                <div>
                                                    <h3 className="text-lg font-semibold mb-2">Department Summary: Procurement Line Items</h3>
                                                    <p className="text-sm text-muted-foreground mb-4">Comparison of {currentPeriod} procurement against forecast for cash expenses. Over-budget items are highlighted.</p>
                                                    <div className="overflow-x-auto rounded-lg border">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted hover:bg-muted">
                                                                    <TableHead className="w-[300px]">Item</TableHead>
                                                                    <TableHead className="text-right">{currentPeriod} Procurement</TableHead>
                                                                    <TableHead className="text-right">{currentPeriod} Forecast</TableHead>
                                                                    <TableHead className="text-right">Procurement vs Forecast</TableHead>
                                                                    <TableHead>Comments</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {cashExpenses.map((item, index) => {
                                                                    const vsForecast = item.forecast - item.procurement;
                                                                    const isOverBudget = vsForecast < 0;
                                                                    return (
                                                                        <TableRow key={item.item} className={isOverBudget ? "bg-red-500/10 hover:bg-red-500/20" : ""}>
                                                                            <TableCell className="font-medium">{item.item}</TableCell>
                                                                            <TableCell className="text-right font-mono">{formatCurrency(item.procurement)}</TableCell>
                                                                            <TableCell className="text-right font-mono">{formatCurrency(item.forecast)}</TableCell>
                                                                            <TableCell className={`text-right font-mono ${isOverBudget ? 'text-red-500' : ''}`}>
                                                                                {formatCurrency(vsForecast)}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <Input 
                                                                                    value={item.comments} 
                                                                                    onChange={(e) => handleCashCommentChange(index, e.target.value)}
                                                                                    className="bg-transparent border-0 h-auto p-0 text-xs text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                                                                                />
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )
                                                                })}
                                                            </TableBody>
                                                            <TableRow className="font-bold bg-muted/50">
                                                                <TableHead>Subtotal cash expenses</TableHead>
                                                                <TableHead className="text-right font-mono">{formatCurrency(subtotalProcurement)}</TableHead>
                                                                <TableHead className="text-right font-mono">{formatCurrency(subtotalForecast)}</TableHead>
                                                                <TableHead className={`text-right font-mono ${subtotalVsForecast < 0 ? 'text-red-500' : ''}`}>
                                                                    {formatCurrency(subtotalVsForecast)}
                                                                </TableHead>
                                                                <TableHead></TableHead>
                                                            </TableRow>
                                                        </Table>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold mb-2">Department Summary: Capital</h3>
                                                    <p className="text-sm text-muted-foreground mb-4">Capital expenditure summary including forecasts and budget comparisons.</p>
                                                    <div className="overflow-x-auto rounded-lg border">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted hover:bg-muted">
                                                                    <TableHead className="w-[250px]">Item</TableHead>
                                                                    <TableHead className="text-right">{currentPeriod} Procurement</TableHead>
                                                                    <TableHead className="text-right">July Forecast</TableHead>
                                                                    <TableHead className="text-right">Year Total</TableHead>
                                                                    <TableHead className="text-right">Multiplier</TableHead>
                                                                    <TableHead className="text-right">Act+F vs Budget</TableHead>
                                                                    <TableHead className="text-right">Act+F vs Budget YR</TableHead>
                                                                    <TableHead className="text-right">vs Budget YR %</TableHead>
                                                                    <TableHead>Comments</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {capital.map((item, index) => (
                                                                    <TableRow key={item.item}>
                                                                        <TableCell className="font-medium">{item.item}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(item.procurement)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(item.julyForecast)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(item.yearTotal)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{item.yearTotalMultiplier?.toFixed(4) ?? ''}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(item.actForecastVsBudget)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(item.actForecastVsBudgetYR)}</TableCell>
                                                                        <TableCell className={`text-right font-mono ${item.vsBudget < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                                            {formatPercentage(item.vsBudget)}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Input 
                                                                                value={item.comments} 
                                                                                onChange={(e) => handleCapitalCommentChange(index, e.target.value)}
                                                                                className="bg-transparent border-0 h-auto p-0 text-xs text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                                                                            />
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="communication" className="pt-6">
                                            <div className="space-y-6">
                                                <div className="space-y-4">
                                                    {activeRequest.comments?.map((comment, i) => (
                                                        <div key={i} className="flex items-start gap-3">
                                                            <Avatar>
                                                                <AvatarImage src={userAvatar?.imageUrl} data-ai-hint={userAvatar?.imageHint}/>
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
                                                    {activeRequest.comments?.length === 0 && (
                                                        <p className="text-sm text-center text-muted-foreground py-4">No comments on this request yet.</p>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <Textarea placeholder="Respond to queries or add a comment..." className="pr-24"/>
                                                    <div className="absolute top-2 right-2 flex items-center gap-1">
                                                        <Button variant="ghost" size="icon"><Paperclip className="h-4 w-4"/></Button>
                                                        <Button size="icon"><Send className="h-4 w-4"/></Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>
                                </Tabs>
                                </CardContent>
                                {activeRequest.status.startsWith('Pending') && (
                                    <CardFooter className="flex justify-end gap-2 border-t pt-6">
                                        <Button variant="outline"><MessageSquare className="mr-2 h-4 w-4" />Raise Query</Button>
                                        <Button variant="destructive"><X className="mr-2 h-4 w-4" />Reject</Button>
                                        <Button onClick={handleApprove}><Check className="mr-2 h-4 w-4" />Approve</Button>
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
  );
}
