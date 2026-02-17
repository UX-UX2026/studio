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
  CheckCircle2,
  Clock,
  Circle,
  Loader,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function DashboardPage() {
  const periods = [
    {
      period: "Jan 2026",
      submissionDate: "27/12/2025",
      executiveReview: "Signed Off",
      procurementAck: "Acknowledged",
      value: 298100.0,
    },
    {
      period: "Feb 2026",
      submissionDate: "27/01/2026",
      executiveReview: "Pending",
      procurementAck: "Waiting",
      value: 132178.0,
    },
    {
      period: "Mar 2026",
      submissionDate: "26/02/2026",
      executiveReview: "Approved",
      procurementAck: "Acknowledged",
      value: 450500.75,
    },
    {
      period: "Apr 2026",
      submissionDate: "28/03/2026",
      executiveReview: "Queries Raised",
      procurementAck: "Waiting",
      value: 210300.0,
    },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "Signed Off":
      case "Approved":
      case "Acknowledged":
        return <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />;
      case "Pending":
        return <Loader className="mr-2 h-4 w-4 animate-spin text-orange-400" />;
      case "Waiting":
        return <Circle className="mr-2 h-4 w-4 text-slate-300" />;
      case "Queries Raised":
        return <Clock className="mr-2 h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

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
        <CardHeader>
          <CardTitle>Process Tracker</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tracking department progress across procurement periods.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Submission Date</TableHead>
                  <TableHead>Executive Review</TableHead>
                  <TableHead>Procurement Ack.</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.period}>
                    <TableCell className="font-medium">{p.period}</TableCell>
                    <TableCell>{p.submissionDate}</TableCell>
                    <TableCell className="flex items-center">
                      <StatusIcon status={p.executiveReview} />
                      {p.executiveReview}
                    </TableCell>
                    <TableCell className="flex items-center">
                      <StatusIcon status={p.procurementAck} />
                      {p.procurementAck}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.value)}
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
