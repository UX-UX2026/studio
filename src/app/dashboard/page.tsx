
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
  BarChart
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
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"


export default function DashboardPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
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

  // Memoize sorted open requests for the "Open Submissions" table
  const sortedOpenRequests = useMemo(() => {
    if (!allOpenRequests) return [];
    // Create a new array before sorting to avoid mutating the original
    return [...allOpenRequests].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  }, [allOpenRequests]);

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

  const draftsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'procurementRequests'),
        where('status', '==', 'Draft'),
        where('submittedById', '==', user.uid),
        orderBy('updatedAt', 'desc'),
        limit(5)
    );
  }, [firestore, user]);

  const { data: userDrafts, loading: draftsLoading } = useCollection<ApprovalRequest>(draftsQuery);


  const allFulfillmentItems = useMemo(() => {
      if (!fulfillmentRequests) return [];
      return fulfillmentRequests.flatMap(req => req.items);
  }, [fulfillmentRequests]);
  
  const fulfillmentSummary = useMemo(() => allFulfillmentItems.reduce((acc, item) => {
    acc[item.fulfillmentStatus] = (acc[item.fulfillmentStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [allFulfillmentItems]);

    const dashboardStats = useMemo(() => {
        // Spend is now correctly calculated from all requests this month.
        const totalSpendCurrentMonth = monthlyRequests?.reduce((sum, req) => sum + req.total, 0) || 0;
        
        // Open request counts are now correct for ALL open requests.
        const pendingManager = allOpenRequests?.filter(req => req.status === 'Pending Manager Approval').length || 0;
        const pendingExecutive = allOpenRequests?.filter(req => req.status === 'Pending Executive').length || 0;
        const queriesRaised = allOpenRequests?.filter(req => req.status === 'Queries Raised').length || 0;

        return { totalSpendCurrentMonth, pendingManager, pendingExecutive, queriesRaised };
    }, [monthlyRequests, allOpenRequests]);

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
            await logErrorToFirestore({
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
    
    const chartData = useMemo(() => [
      { stage: "Manager", count: dashboardStats.pendingManager || 0, fill: "var(--color-manager)" },
      { stage: "Executive", count: dashboardStats.pendingExecutive || 0, fill: "var(--color-executive)" },
      { stage: "Queries", count: dashboardStats.queriesRaised || 0, fill: "var(--color-queries)" },
    ], [dashboardStats]);

    const chartConfig = {
      count: {
        label: "Count",
      },
      manager: {
        label: "Manager",
        color: "hsl(var(--chart-1))",
      },
      executive: {
        label: "Executive",
        color: "hsl(var(--chart-2))",
      },
      queries: {
        label: "Queries",
        color: "hsl(var(--chart-3))",
      }
    } satisfies ChartConfig

  return (
    <>
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                <div className="text-2xl font-bold">{allOpenRequests?.length || 0} Open Requests</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                      <TableRow>
                          <TableCell colSpan={5} className="text-center h-24">
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
                      </TableRow>
                    ))
                  ) : (
                      <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
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
                <BarChart className="h-5 w-5 text-primary"/>
                Approval Pipeline
              </CardTitle>
              <CardDescription>Live view of requests awaiting action.</CardDescription>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <RechartsBarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 10 }}>
                   <YAxis
                      dataKey="stage"
                      type="category"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      className="text-xs"
                    />
                    <XAxis dataKey="count" type="number" hide />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  <Bar dataKey="count" radius={5} />
                </RechartsBarChart>
              </ChartContainer>
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
