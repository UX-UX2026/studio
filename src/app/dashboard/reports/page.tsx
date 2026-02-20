'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader, FilePieChart, BarChart, Clock, Building } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const reports = [
    {
        title: "Spend by Department",
        description: "Analyze procurement spend across all departments for a selected period.",
        icon: BarChart,
        options: { period: true }
    },
    {
        title: "Vendor Performance",
        description: "Review vendor lead times, cost-effectiveness, and item quality.",
        icon: Building,
        options: {}
    },
    {
        title: "Approval Cycle Time",
        description: "Measure the average time it takes for requests to be approved.",
        icon: Clock,
        options: { period: true }
    },
    {
        title: "Budget vs. Actuals",
        description: "Compare budgeted amounts against actual spend for each cost center.",
        icon: FilePieChart,
        options: { department: true, period: true }
    }
];


export default function ReportsPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
      const allowedRoles = ['Administrator', 'Manager', 'Executive', 'Procurement Officer'];
      if (!loading && (!user || !role || !allowedRoles.includes(role))) {
        router.push('/dashboard');
      }
    }, [user, role, loading, router]);
    
    if (loading || !user || !role || !['Administrator', 'Manager', 'Executive', 'Procurement Officer'].includes(role)) {
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
                    <Card key={report.title} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <report.icon className="h-5 w-5 text-muted-foreground" />
                                {report.title}
                            </CardTitle>
                            <CardDescription className="!mt-3">{report.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-4">
                            {report.options.period && (
                                <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="q1-2026">Q1 2026</SelectItem>
                                        <SelectItem value="q4-2025">Q4 2025</SelectItem>
                                        <SelectItem value="fy-2025">FY 2025</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                             {report.options.department && (
                                <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ict">ICT</SelectItem>
                                        <SelectItem value="marketing">Marketing</SelectItem>
                                        <SelectItem value="operations">Operations</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </CardContent>
                        <div className="p-6 pt-0">
                            <Button className="w-full" disabled>Generate Report</Button>
                        </div>
                    </Card>
                ))}
            </div>
        </CardContent>
       </Card>
    </div>
  );
}
