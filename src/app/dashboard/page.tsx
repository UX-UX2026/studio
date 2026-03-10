
'use client';

import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  Loader,
  Rocket,
  Briefcase,
  TrendingUp,
  AlertCircle,
  Trash2,
  Workflow,
  Download
} from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from "next/navigation";
import { type ApprovalRequest } from '@/lib/approvals-mock-data';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, orderBy, limit, where, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { logErrorToFirestore } from '@/lib/error-logger';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

const stageToStatusMap: { [key: string]: string } = {
    "Manager": "Pending Manager Approval",
    "Executive": "Pending Executive",
    "Procurement": "Approved",
};

const PipelineStage = ({ name, count, highlight }: { name: string, count: number, highlight?: boolean }) => (
    <Link 
        href={`/dashboard/approvals?status=${encodeURIComponent(stageToStatusMap[name] || '')}`}
        className="flex flex-col items-center gap-1 text-center w-16 cursor-pointer transition-transform duration-200 hover:scale-110 group"
    >
        <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-full border-2 font-bold text-base transition-colors group-hover:border-primary group-hover:text-primary",
            highlight ? "border-primary text-primary bg-primary/10" : "border-muted-foreground/30 text-muted-foreground"
        )}>
            {count}
        </div>
        <div className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">{name}</div>
    </Link>
);


const PipelineArrow = ({ highlight }: { highlight?: boolean }) => (
    <div className={cn("px-1 text-muted-foreground/30", highlight && "text-primary/70")}>
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0 5H16" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
            <path d="M12 2L16 5L12 8" stroke="currentColor" strokeWidth="1"/>
        </svg>
    </div>
);


export default function DashboardPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, role, department: userDepartment } = useUser();
  const { toast } = useToast();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);

  // Define statuses for open requests
  const openStatuses = useMemo(() => ['Pending Manager Approval', 'Pending Executive', 'Approved', 'In Fulfillment', 'Queries Raised'], []);

  // Query for ALL open requests. Sorting will be done on the client to avoid composite index.
  const openRequestsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'procurementRequests'),
      where('status', 'in', openStatuses)
    );
  }, [firestore, openStatuses]);
  
  const { data: allOpenRequests, loading: openRequestsLoading } = useCollection<ApprovalRequest>(openRequestsQuery);

  const userOpenRequests = useMemo(() => {
    if (!allOpenRequests) return [];
    if (role === 'Requester' && userDepartment) {
        return allOpenRequests.filter(req => req.department === userDepartment);
    }
    return allOpenRequests;
  }, [allOpenRequests, role, userDepartment]);

  // Memoize sorted open requests for the "Open Submissions" table
  const sortedOpenRequests = useMemo(() => {
    if (!userOpenRequests) return [];
    // Create a new array before sorting to avoid mutating the original
    return [...userOpenRequests].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  }, [userOpenRequests]);

  // Query for all requests created in the current month for accurate spend calculation
  const monthlyRequestsQuery = useMemo(() => {
    if (!firestore) return null;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return query(
      collection(firestore, 'procurementRequests'),
      where('createdAt', '>=', startOfMonth)
    );
  }, [firestore]);

  const { data: monthlyRequests, loading: monthlyRequestsLoading } = useCollection<ApprovalRequest>(monthlyRequestsQuery);

  const fulfillmentQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'procurementRequests'), where('status', 'in', ['In Fulfillment', 'Completed']));
  }, [firestore]);

  const { data: fulfillmentRequests, loading: fulfillmentLoading } = useCollection<ApprovalRequest>(fulfillmentQuery);

  const allDraftsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'procurementRequests'),
        where('status', '==', 'Draft')
    );
  }, [firestore]);

  const { data: allDrafts, loading: draftsLoading } = useCollection<ApprovalRequest>(allDraftsQuery);

  const userDrafts = useMemo(() => {
    if (!user || !allDrafts) return [];
    return allDrafts
        .filter(draft => draft.submittedById === user.uid)
        .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0))
        .slice(0, 5);
  }, [user, allDrafts]);


  const allFulfillmentItems = useMemo(() => {
      if (!fulfillmentRequests) return [];
      return fulfillmentRequests.flatMap(req => req.items);
  }, [fulfillmentRequests]);
  
  const fulfillmentSummary = useMemo(() => allFulfillmentItems.reduce((acc, item) => {
    acc[item.fulfillmentStatus] = (acc[item.fulfillmentStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [allFulfillmentItems]);

    const dashboardStats = useMemo(() => {
        const monthlyRequestsForUser = (role === 'Requester' && userDepartment)
            ? monthlyRequests?.filter(req => req.department === userDepartment)
            : monthlyRequests;
        const totalSpendCurrentMonth = monthlyRequestsForUser?.reduce((sum, req) => sum + req.total, 0) || 0;
        
        const pendingManager = userOpenRequests?.filter(req => req.status === 'Pending Manager Approval').length || 0;
        const pendingExecutive = userOpenRequests?.filter(req => req.status === 'Pending Executive').length || 0;
        const queriesRaised = userOpenRequests?.filter(req => req.status === 'Queries Raised').length || 0;

        return { totalSpendCurrentMonth, pendingManager, pendingExecutive, queriesRaised };
    }, [monthlyRequests, userOpenRequests, role, userDepartment]);

    const approvedCount = useMemo(() => userOpenRequests?.filter(req => req.status === 'Approved').length || 0, [userOpenRequests]);
    const fulfillmentCount = useMemo(() => userOpenRequests?.filter(req => req.status === 'In Fulfillment').length || 0, [userOpenRequests]);

    const requestsLoading = openRequestsLoading || monthlyRequestsLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Pending Manager Approval': return <Badge variant="outline" className="text-blue-500 border-blue-500">Pending Manager</Badge>;
            case 'Pending Executive': return <Badge variant="outline" className="text-orange-500 border-orange-500">Pending Executive</Badge>;
            case 'Approved': return <Badge variant="outline" className="text-purple-500 border-purple-500">Approved</Badge>;
            case 'In Fulfillment': return <Badge variant="outline" className="text-indigo-500 border-indigo-500">In Fulfillment</Badge>;
            case 'Completed': return <Badge variant="outline" className="text-green-500 border-green-500">Completed</Badge>;
            case 'Queries Raised': return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{status}</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>
        }
    }
    
    const generateApprovalReport = (request: ApprovalRequest) => {
        // 1. Request Details
        const detailsData = [
            { Key: "Request ID", Value: request.id },
            { Key: "Department", Value: request.department },
            { Key: "Period", Value: request.period },
            { Key: "Submitted By", Value: request.submittedBy },
            { Key: "Total", Value: formatCurrency(request.total) },
            { Key: "Status", Value: request.status },
        ];
        const detailsSheet = XLSX.utils.json_to_sheet(detailsData, { skipHeader: true });

        // 2. Line Items
        const itemsData = request.items.map(item => ({
            'Type': item.type,
            'Description': item.description,
            'Category': item.category,
            'Brand': item.brand,
            'Quantity': item.qty,
            'Unit Price': item.unitPrice,
            'Total': item.qty * item.unitPrice,
        }));
        const itemsSheet = XLSX.utils.json_to_sheet(itemsData);

        // 3. Approval History
        const timelineData = request.timeline.map(step => ({
            'Stage': step.stage,
            'Actor': step.actor,
            'Status': step.status,
            'Date': step.date || 'N/A',
        }));
        const timelineSheet = XLSX.utils.json_to_sheet(timelineData);
        
        // Create workbook and add sheets
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, detailsSheet, "Request Details");
        XLSX.utils.book_append_sheet(wb, itemsSheet, "Line Items");
        XLSX.utils.book_append_sheet(wb, timelineSheet, "Approval History");

        // Download the file
        XLSX.writeFile(wb, `Procurement-Request-${request.id.substring(0, 8)}.xlsx`);
    };

    const handleDeleteDraft = async () => {
        if (!deletingRequestId || !user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not archive draft.' });
            return;
        }

        const draftToArchive = userDrafts?.find(req => req.id === deletingRequestId);
        if (!draftToArchive) return;
        
        const action = 'request.draft_archive';
        try {
            const docRef = doc(firestore, 'procurementRequests', deletingRequestId);
            await updateDoc(docRef, { status: 'Archived', updatedAt: serverTimestamp() });
            
            toast({ title: 'Draft Archived', description: 'The draft has been moved to the recycle bin.' });

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Archived draft for ${draftToArchive.period}`,
                entity: { type: 'procurementRequest', id: deletingRequestId },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            console.error("Archive Draft Error:", error);
            toast({ variant: 'destructive', title: 'Archive Failed', description: error.message });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack
            });
        } finally {
            setDeletingRequestId(null);
            setIsDeleteDialogOpen(false);
        }
    };
    
  return (
    <>
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              New Request
            </CardTitle>
             <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Start a New Cycle</div>
            <p className="text-xs text-muted-foreground mb-4">
              Begin a new procurement submission for any department.
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard/procurement">
                <Rocket className="mr-2 h-4 w-4" />
                Quick Submit
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Spend (Current Month)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
                 <div className="flex items-center justify-center h-24">
                  <Loader className="h-6 w-6 animate-spin" />
                </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(dashboardStats.totalSpendCurrentMonth)}</div>
                <p className="text-xs text-muted-foreground">Total value of all requests created this month.</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Requests Awaiting Action
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
                 <div className="flex items-center justify-center h-24">
                  <Loader className="h-6 w-6 animate-spin" />
                </div>
            ) : (
                <>
                <div className="text-2xl font-bold">{userOpenRequests?.length || 0} Open Requests</div>
                 <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div>Manager Review</div>
                    <div className="font-semibold text-right text-foreground">{dashboardStats.pendingManager || 0}</div>
                    <div>Executive Review</div>
                    <div className="font-semibold text-right text-foreground">{dashboardStats.pendingExecutive || 0}</div>
                    <div>Queries Raised</div>
                    <div className="font-semibold text-right text-foreground">{dashboardStats.queriesRaised || 0}</div>
                </div>
                </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fulfillment Overview
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {fulfillmentLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader className="h-6 w-6 animate-spin" />
                </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{allFulfillmentItems.filter(i => i.fulfillmentStatus !== 'Completed').length} Open Tasks</div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div>Sourcing</div>
                    <div className="font-semibold text-right text-foreground">{fulfillmentSummary.Sourcing || 0}</div>
                    <div>Quoted</div>
                    <div className="font-semibold text-right text-foreground">{fulfillmentSummary.Quoted || 0}</div>
                    <div>Ordered</div>
                    <div className="font-semibold text-right text-foreground">{fulfillmentSummary.Ordered || 0}</div>
                    <div>Completed</div>
                    <div className="font-semibold text-right text-foreground">{fulfillmentSummary.Completed || 0}</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary"/>
                  Open Submissions
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  A summary of submissions currently in the approval pipeline.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/dashboard/approvals">View All Requests</Link>
              </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                      <TableRow>
                          <TableCell colSpan={6} className="text-center h-24">
                              <Loader className="h-6 w-6 animate-spin mx-auto" />
                          </TableCell>
                      </TableRow>
                  ) : sortedOpenRequests && sortedOpenRequests.length > 0 ? (
                    sortedOpenRequests.slice(0, 5).map((req) => (
                      <TableRow key={req.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/approvals?id=${req.id}`)}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/approvals?id=${req.id}`} className="hover:underline text-primary">{req.id.substring(0,8)}...</Link>
                        </TableCell>
                        <TableCell>{req.period}</TableCell>
                        <TableCell>{req.submittedBy}</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(req.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {['Approved', 'In Fulfillment', 'Completed'].includes(req.status) && (
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); generateApprovalReport(req); }}>
                                  <Download className="h-4 w-4" />
                              </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                      <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                              No open submissions found.
                          </TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
           <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary"/>
                Approval Pipeline
              </CardTitle>
              <CardDescription>Live view of requests awaiting action.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {requestsLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader className="h-6 w-6 animate-spin" />
              </div>
            ) : (
            <div className="space-y-4">
                <div className="flex items-center justify-center">
                    <PipelineStage name="Manager" count={dashboardStats.pendingManager} highlight={dashboardStats.pendingManager > 0} />
                    <PipelineArrow highlight={dashboardStats.pendingManager > 0} />
                    <PipelineStage name="Executive" count={dashboardStats.pendingExecutive} highlight={dashboardStats.pendingExecutive > 0} />
                    <PipelineArrow highlight={dashboardStats.pendingExecutive > 0} />
                    <PipelineStage name="Procurement" count={approvedCount} highlight={approvedCount > 0}/>
                </div>
                
                {(dashboardStats.queriesRaised > 0 || fulfillmentCount > 0) && <Separator className="my-4"/>}

                <div className="flex justify-around items-center text-center text-sm gap-4">
                    {fulfillmentCount > 0 && (
                        <Link href={`/dashboard/approvals?status=In%20Fulfillment`} className="flex items-center gap-2 cursor-pointer transition-transform duration-200 hover:scale-110">
                            <div className="font-bold text-lg text-indigo-500">{fulfillmentCount}</div>
                            <div className="text-muted-foreground text-xs">In Fulfillment</div>
                        </Link>
                    )}
                    {dashboardStats.queriesRaised > 0 && (
                         <Link href={`/dashboard/approvals?status=Queries%20Raised`} className="flex items-center gap-2 cursor-pointer transition-transform duration-200 hover:scale-110">
                            <div className="font-bold text-lg text-yellow-500">{dashboardStats.queriesRaised}</div>
                            <div className="text-muted-foreground text-xs">With Queries</div>
                        </Link>
                    )}
                </div>
            </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
              <CardTitle>My Drafts</CardTitle>
              <CardDescription>
                Resume or delete your recent draft submissions.
              </CardDescription>
          </CardHeader>
          <CardContent>
             {draftsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="h-6 w-6 animate-spin" />
                </div>
            ) : userDrafts && userDrafts.length > 0 ? (
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Last Saved</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {userDrafts.map(draft => (
                        <TableRow key={draft.id}>
                            <TableCell>
                                <Link href={`/dashboard/procurement?deptId=${draft.departmentId}&period=${encodeURIComponent(draft.period)}`} className="hover:underline text-primary font-medium">{draft.period}</Link>
                                <div className="text-xs text-muted-foreground">{draft.department}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(draft.total)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{draft.updatedAt ? formatDistanceToNow(new Date(draft.updatedAt.seconds * 1000), { addSuffix: true }) : 'N/A'}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => { setDeletingRequestId(draft.id); setIsDeleteDialogOpen(true); }}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                  You have no saved drafts.
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
     <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Archive this draft?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will move the draft to the recycle bin. You can restore it later.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingRequestId(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteDraft}>Archive</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

    
