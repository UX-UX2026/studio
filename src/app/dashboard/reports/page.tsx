
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader, FilePieChart, BarChart, Clock, Building, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const reports = [
    {
        title: "Spend by Department",
        description: "Analyze procurement spend across all departments for a selected period.",
        icon: BarChart,
        href: "/dashboard/procurement-summary"
    },
    {
        title: "Vendor Performance",
        description: "Review vendor lead times, cost-effectiveness, and item quality.",
        icon: Building,
        href: "/dashboard/vendors"
    },
    {
        title: "Approval Cycle Time",
        description: "Measure the average time it takes for requests to be approved.",
        icon: Clock,
        href: "/dashboard/approvals"
    },
    {
        title: "Budget vs. Actuals",
        description: "Compare budgeted amounts against actual spend for each cost center.",
        icon: FilePieChart,
        href: "/dashboard/procurement-summary"
    },
    {
        title: "Emergency Submissions",
        description: "Review all emergency and unplanned procurement submissions.",
        icon: AlertTriangle,
        href: "/dashboard/approvals?emergency=true"
    }
];


export default function ReportsPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
      const allowedRoles = ['Administrator', 'Manager', 'Executive', 'Procurement Officer'];
      if (loading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }
      if (role && !allowedRoles.includes(role)) {
        router.push('/dashboard');
      }
    }, [user, role, loading, router]);
    
    const allowedRoles = useMemo(() => ['Administrator', 'Manager', 'Executive', 'Procurement Officer'], []);
    if (loading || !user || !role || !allowedRoles.includes(role)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <FilePieChart className="h-6 w-6 text-primary" />
                Reporting Center
            </CardTitle>
            <CardDescription>
                Generate standard and custom reports to gain insights into your procurement activities.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => (
                     <Link key={report.title} href={report.href} className="flex">
                        <Card className="flex flex-col w-full transition-all hover:shadow-lg hover:border-primary/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <report.icon className="h-5 w-5 text-muted-foreground" />
                                    {report.title}
                                </CardTitle>
                                <CardDescription className="!mt-3">{report.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow" />
                            <CardFooter>
                                <Button variant="outline" className="w-full">View Details</Button>
                            </CardFooter>
                        </Card>
                    </Link>
                ))}
            </div>
        </CardContent>
       </Card>
    </div>
  );
}
