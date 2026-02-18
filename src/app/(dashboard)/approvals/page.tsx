'use client';

import { useUser } from "@/firebase/auth/use-user";
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
import { type ApprovalRequest, approvalsData } from "@/lib/approvals-mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


const getStatusBadge = (status: string) => {
    switch (status) {
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
    }).format(amount);
};

export default function ApprovalsPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
      approvalsData.find(a => a.status.startsWith('Pending'))?.id || approvalsData[0]?.id || null
    );

    const activeRequest = useMemo(() => approvalsData.find((req) => req.id === selectedRequestId), [selectedRequestId]);

    const approvalSummary = useMemo(() => {
        const pending = approvalsData.filter(req => req.status.startsWith('Pending'));
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
    }, []);

    useEffect(() => {
      if (!loading && (!user || (role !== 'Executive' && role !== 'Administrator'))) {
        router.push('/');
      }
    }, [user, role, loading, router]);
    
    const userAvatar = PlaceHolderImages.find((img) => img.id === 'avatar-1');

    if (loading || !user || (role !== 'Executive' && role !== 'Administrator')) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            {activeRequest ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Approval Request: {activeRequest.id}</CardTitle>
                        <CardDescription>{activeRequest.period} - {activeRequest.department} - {formatCurrency(activeRequest.total)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Tabs defaultValue="workflow">
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
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Unit Price</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeRequest.items.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.description}</TableCell>
                                                <TableCell>{item.category}</TableCell>
                                                <TableCell className="text-right">{item.qty}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                                                <TableCell className="text-right font-mono font-semibold">{formatCurrency(item.qty * item.unitPrice)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
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
                            <Button><Check className="mr-2 h-4 w-4" />Approve</Button>
                        </CardFooter>
                    )}
                </Card>
            ) : (
                 <Card>
                    <CardContent className="p-12 flex justify-center items-center h-full min-h-[300px]">
                        <p className="text-muted-foreground">Select a request to view its details.</p>
                    </CardContent>
                </Card>
            )}
        </div>
        <div className="lg:col-span-1 space-y-6">
             <Card>
                <CardHeader className="pb-2">
                    <CardTitle>Approvals Overview</CardTitle>
                    <CardDescription>Summary of requests awaiting action.</CardDescription>
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
                <div className="space-y-2 max-h-[calc(100vh-28rem)] overflow-y-auto pr-2">
                    {approvalsData.map(req => (
                        <Card 
                            key={req.id} 
                            className={cn("cursor-pointer transition-colors", selectedRequestId === req.id ? 'bg-primary/10 border-primary/50' : 'hover:bg-muted/50')}
                            onClick={() => setSelectedRequestId(req.id)}
                        >
                            <CardContent className="p-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{req.id}</p>
                                        <p className="text-sm text-muted-foreground font-medium">{req.department}</p>
                                    </div>
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
            </div>
        </div>
    </div>
  );
}
