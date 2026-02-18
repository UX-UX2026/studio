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
} from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const approvals = [
    {
      id: "REQ-00124",
      period: "Feb 2026",
      total: 132178.0,
      status: "Pending Executive",
      submittedBy: "Tarryn M.",
    },
    {
      id: "REQ-00123",
      period: "Jan 2026",
      total: 298100.0,
      status: "Completed",
      submittedBy: "Tarryn M.",
    },
    {
      id: "REQ-00122",
      period: "Jan 2026",
      total: 450500.75,
      status: "Completed",
      submittedBy: "Zukiswa N.",
    },
    {
      id: "REQ-00121",
      period: "Dec 2025",
      total: 210300.0,
      status: "Queries Raised",
      submittedBy: "Tarryn M.",
    },
    {
      id: "REQ-00120",
      period: "Nov 2025",
      total: 180450.0,
      status: "Completed",
      submittedBy: "Tarryn M.",
    }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Pending Executive': return <Badge variant="outline" className="text-orange-500 border-orange-500">Pending Executive</Badge>;
            case 'Completed': return <Badge variant="outline" className="text-green-500 border-green-500">Completed</Badge>;
            case 'Queries Raised': return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{status}</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>
        }
    }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
              <Link href="/approvals">View All Requests</Link>
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
                {approvals.slice(0, 5).map((req) => (
                  <TableRow key={req.id} className="cursor-pointer" onClick={() => window.location.href='/approvals'}>
                    <TableCell className="font-medium">
                      <Link href="/approvals" className="hover:underline text-primary">{req.id}</Link>
                    </TableCell>
                    <TableCell>{req.period}</TableCell>
                    <TableCell>{req.submittedBy}</TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(req.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
