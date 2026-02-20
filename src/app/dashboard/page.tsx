'use client';

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  ClipboardCheck,
  Loader,
} from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from "next/navigation";
import { type ApprovalRequest } from '@/lib/approvals-mock-data';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';

export default function DashboardPage() {
  const router = useRouter();
  const firestore = useFirestore();

  const requestsQuery = useMemo(() => {
      if (!firestore) return null;
      return query(
          collection(firestore, 'procurementRequests'),
          orderBy('createdAt', 'desc'),
          limit(5)
      );
  }, [firestore]);

  const { data: recentRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(requestsQuery);

  const fulfillmentQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'procurementRequests'), where('status', '==', 'In Fulfillment'));
  }, [firestore]);

  const { data: fulfillmentRequests, loading: fulfillmentLoading } = useCollection<ApprovalRequest>(fulfillmentQuery);

  const allFulfillmentItems = useMemo(() => {
      if (!fulfillmentRequests) return [];
      return fulfillmentRequests.flatMap(req => req.items);
  }, [fulfillmentRequests]);
  
  const fulfillmentSummary = useMemo(() => allFulfillmentItems.reduce((acc, item) => {
    acc[item.fulfillmentStatus] = (acc[item.fulfillmentStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [allFulfillmentItems]);

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Period Status
            </CardTitle>
            <Badge variant="outline" className="bg-orange-100 text-orange-600">
              Pending
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Pending Submission</div>
            <p className="text-xs text-muted-foreground">
              February 2026 period is awaiting your submission.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Budget Used
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R 349,663.26</div>
            <p className="text-xs text-muted-foreground">+15.2% from last month</p>
            <Progress value={65} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Fulfillment Time
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">3.2 Days</div>
            <p className="text-xs text-muted-foreground">
              -0.5 days faster than last month's average.
            </p>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Procurement Requests</CardTitle>
              <p className="text-sm text-muted-foreground">
                A summary of recent requests and their current status.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard/approvals">View All Requests</Link>
            </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                        <TableCell colSpan={5} className="text-center">
                            <Loader className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                    </TableRow>
                ) : recentRequests && recentRequests.length > 0 ? (
                  recentRequests.map((req) => (
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
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No procurement requests found.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
