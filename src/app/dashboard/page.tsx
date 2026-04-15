
'use client';

import { useMemo, useState, useEffect } from 'react';
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
  Download,
  AlertTriangle
} from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from "next/navigation";
import { type ApprovalRequest } from '@/lib/approvals-mock-data';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, where, doc, updateDoc, addDoc, serverTimestamp, getDocs, type Firestore } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { logErrorToFirestore } from '@/lib/error-logger';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Department = {
    id: string;
    name: string;
    budgetHeaders?: string[];
    budgetYear?: number;
};

type BudgetItem = {
    id: string;
    departmentId: string;
    category: string;
    forecasts: number[];
    yearTotal: number;
};

type AuditEvent = {
    id: string;
    userId: string;
    userName: string;
    action: string;
    details: string;
    timestamp: { seconds: number; nanoseconds: number; };
    entity?: {
        type: string;
        id: string;
    };
};

type Company = {
    id: string;
    name: string;
    logoUrl?: string;
};

type AppMetadata = {
    id: string;
    pdfSettings?: { primaryColor?: string; };
};

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
  const { user, role, department: userDepartment, departmentId: userDepartmentId, reportingDepartments } = useUser();
  const { toast } = useToast();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);

  const [monthFilter, setMonthFilter] = useState<string>('all_time');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');

  const openStatuses = useMemo(() => ['Pending Manager Approval', 'Pending Executive', 'Approved', 'In Fulfillment', 'Queries Raised'], []);

  const allOpenRequestsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'procurementRequests'), where('status', 'in', openStatuses));
  }, [firestore, openStatuses]);
  const { data: allOpenRequests, loading: allOpenRequestsLoading } = useCollection<ApprovalRequest>(allOpenRequestsQuery);
  
  const allRequestsForUser = useMemo(() => {
    if (!allOpenRequests || !role) return [];

    if (role === 'Manager' || role === 'Requester') {
        if (!userDepartmentId) return [];
        return allOpenRequests.filter(req => req.departmentId === userDepartmentId);
    }
    
    if (role === 'Executive') {
        if (reportingDepartments && reportingDepartments.length > 0) {
            return allOpenRequests.filter(req => req.departmentId && reportingDepartments.includes(req.departmentId));
        }
    }

    // Admins, Procurement Officers etc. see all open requests.
    return allOpenRequests;
  }, [allOpenRequests, role, userDepartmentId, reportingDepartments]);

  const fulfillmentQuery = useMemo(() => {
    if (!firestore) return null;
    let q = query(collection(firestore, 'procurementRequests'), where('status', '==', 'In Fulfillment'));

    if (role === 'Executive') {
        if (reportingDepartments && reportingDepartments.length > 0) {
            q = query(q, where('departmentId', 'in', reportingDepartments));
        }
    } else if ((role === 'Manager' || role === 'Requester') && userDepartmentId) {
        q = query(q, where('departmentId', '==', userDepartmentId));
    }
    return q;
  }, [firestore, role, userDepartmentId, reportingDepartments]);

  const { data: fulfillmentRequests, loading: fulfillmentLoading } = useCollection<ApprovalRequest>(fulfillmentQuery);

  const allDraftsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'procurementRequests'),
        where('status', '==', 'Draft')
    );
  }, [firestore]);

  const { data: allDrafts, loading: draftsLoading } = useCollection<ApprovalRequest>(allDraftsQuery);
  
  const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
  const { data: allDepartments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

  const budgetsQuery = useMemo(() => collection(firestore, 'budgets'), [firestore]);
  const { data: allBudgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);

  const companiesQuery = useMemo(() => collection(firestore, 'companies'), [firestore]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
  const { data: appMetadata } = useDoc<AppMetadata>(appMetadataRef);

  const userDrafts = useMemo(() => {
    if (!user || !allDrafts) return [];
    
    let draftsForUser: ApprovalRequest[];

    if (role === 'Manager' && userDepartment) {
        draftsForUser = allDrafts.filter(draft => draft.department === userDepartment);
    } else if (role === 'Administrator' || role === 'Executive' || role === 'Procurement Officer') {
        draftsForUser = allDrafts;
    } else { // Requester
        draftsForUser = allDrafts.filter(draft => draft.submittedById === user.uid);
    }

    return draftsForUser
        .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0))
        .slice(0, 5);
  }, [user, allDrafts, role, userDepartment]);

  const availableMonths = useMemo(() => {
    if (!allRequestsForUser) return [{label: 'All Time', value: 'all_time'}, {label: 'Current Month', value: 'current_month'}];
    const months = new Set(allRequestsForUser.map(req => req.period));
    const sortedMonths = [...Array.from(months)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return [{label: 'All Time', value: 'all_time'}, {label: 'Current Month', value: 'current_month'}, ...sortedMonths.map(m => ({label: m, value: m}))];
  }, [allRequestsForUser]);

  const departmentsForFilter = useMemo(() => {
    if (role === 'Administrator' || role === 'Executive' || role === 'Procurement Officer') {
        if (reportingDepartments && reportingDepartments.length > 0) {
            return allDepartments?.filter(d => reportingDepartments.includes(d.id)) || [];
        }
        return allDepartments || [];
    }
    return [];
  }, [role, allDepartments, reportingDepartments]);

  const filteredRequests = useMemo(() => {
    if (!allRequestsForUser) return [];
    let requests = allRequestsForUser;

    if (departmentFilter !== 'all') {
        requests = requests.filter(req => req.departmentId === departmentFilter);
    }

    if (monthFilter === 'current_month') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
        return requests.filter(req => req.createdAt && req.createdAt.seconds >= startOfMonth);
    } else if (monthFilter === 'all_time') {
        return requests;
    } else {
        return requests.filter(req => req.period === monthFilter);
    }
  }, [allRequestsForUser, monthFilter, departmentFilter]);


  const allFulfillmentItems = useMemo(() => {
      if (!fulfillmentRequests) return [];
      return fulfillmentRequests.flatMap(req => req.items);
  }, [fulfillmentRequests]);
  
  const fulfillmentSummary = useMemo(() => allFulfillmentItems.reduce((acc, item) => {
    const status = item.fulfillmentStatus || 'Pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [allFulfillmentItems]);

    const dashboardStats = useMemo(() => {
        const periodRequests = filteredRequests || [];
        const totalSpend = periodRequests.reduce((sum, req) => sum + req.total, 0) || 0;
        
        const openRequests = periodRequests.filter(req => openStatuses.includes(req.status)) || [];

        const pendingManager = openRequests.filter(req => req.status === 'Pending Manager Approval').length;
        const pendingExecutive = openRequests.filter(req => req.status === 'Pending Executive').length;
        const queriesRaised = openRequests.filter(req => req.status === 'Queries Raised').length;
        const approvedCount = openRequests.filter(req => req.status === 'Approved').length;
        const fulfillmentCount = openRequests.filter(req => req.status === 'In Fulfillment').length;

        return { totalSpend, pendingManager, pendingExecutive, queriesRaised, approvedCount, fulfillmentCount, openRequests };
    }, [filteredRequests, openStatuses]);
    
    const emergencyStats = useMemo(() => {
      const emergencyRequests = (filteredRequests || []).filter(req => req.isEmergency);
      const count = emergencyRequests.length;
      const totalAmount = emergencyRequests.reduce((sum, req) => sum + req.total, 0);
      const averageAmount = count > 0 ? totalAmount / count : 0;

      return { count, totalAmount, averageAmount };
    }, [filteredRequests]);

    const mainWidgetsLoading = allOpenRequestsLoading || deptsLoading;
    const chartsLoading = allOpenRequestsLoading || deptsLoading || budgetsLoading;
    
    const spendByDeptVsBudgetData = useMemo(() => {
        if (!filteredRequests || !allDepartments || !allBudgetItems) return [];
        
        const periodForBudget = (monthFilter === 'current_month' || monthFilter === 'all_time')
            ? format(new Date(), "MMMM yyyy")
            : monthFilter;

        const budgetMonthName = periodForBudget.split(' ')[0];
        const budgetProcurementYear = parseInt(periodForBudget.split(' ')[1], 10);

        const visibleDepartments = (departmentFilter !== 'all')
            ? allDepartments.filter(d => d.id === departmentFilter)
            : departmentsForFilter;

        const dataByDept = visibleDepartments.map(dept => {
            const deptSpend = filteredRequests
                .filter(req => req.departmentId === dept.id)
                .reduce((sum, req) => sum + req.total, 0);

            const budgetYear = dept.budgetYear;
            
            let deptBudget = 0;
            if (monthFilter !== 'all_time') {
                const monthIndex = (budgetYear === budgetProcurementYear)
                    ? dept.budgetHeaders?.findIndex(h => h.toLowerCase().startsWith(budgetMonthName.toLowerCase().substring(0, 3))) ?? -1
                    : -1;
                
                deptBudget = allBudgetItems
                    .filter(item => item.departmentId === dept.id)
                    .reduce((sum, item) => {
                        const forecast = (monthIndex !== -1 && item.forecasts.length > monthIndex)
                            ? item.forecasts[monthIndex]
                            : 0;
                        return sum + forecast;
                    }, 0);
            }
            
            return {
                name: dept.name,
                spend: deptSpend,
                budget: deptBudget
            };
        });
        
        return dataByDept.filter(d => d.spend > 0 || d.budget > 0);

    }, [filteredRequests, allDepartments, allBudgetItems, role, departmentsForFilter, monthFilter, departmentFilter]);

    const spendByCategoryData = useMemo(() => {
        if (!filteredRequests) return [];

        const categorySpend = filteredRequests.flatMap(req => req.items).reduce((acc, item) => {
            const category = item.category || 'Uncategorized';
            const itemTotal = item.qty * item.unitPrice;
            acc[category] = (acc[category] || 0) + itemTotal;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(categorySpend)
            .map(([name, spend]) => ({ name, spend }))
            .sort((a, b) => b.spend - a.spend);

    }, [filteredRequests]);

    const spendByDeptPieData = useMemo(() => {
        if (!spendByDeptVsBudgetData) return [];
        return spendByDeptVsBudgetData
            .filter(d => d.spend > 0)
            .map(dept => ({
                name: dept.name,
                value: dept.spend,
                fill: `var(--color-${dept.name})`
            }));
    }, [spendByDeptVsBudgetData]);

    const spendByDeptChartConfig = {
        spend: {
          label: "Spend",
          color: "hsl(var(--chart-1))",
        },
        budget: {
          label: "Budget",
          color: "hsl(var(--chart-2))",
        },
    } satisfies ChartConfig;


    const requestsByStatusData = useMemo(() => {
        if (!allRequestsForUser) return [];
        const statusCounts = allRequestsForUser.reduce((acc, req) => {
            acc[req.status] = (acc[req.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(statusCounts).map(([name, value]) => ({ 
            name: name, 
            value: value, 
            fill: `var(--color-${name.replace(/ /g, "")})` 
        }));
    }, [allRequestsForUser]);
    
    const requestsByStatusChartConfig = useMemo(() => {
        if (!allRequestsForUser) return {} as ChartConfig;
        const statusSet = new Set(allRequestsForUser.map(req => req.status));
        const config: ChartConfig = {};
        let i = 1;
        statusSet.forEach(status => {
            config[status.replace(/ /g, "")] = {
                label: status,
                color: `hsl(var(--chart-${i}))`
            }
            i = (i % 5) + 1;
        });
        return config;
    }, [allRequestsForUser]);

    const fulfillmentStatusData = useMemo(() => {
        return Object.entries(fulfillmentSummary).map(([name, value]) => ({ 
            name, 
            value, 
            fill: `var(--color-${name})` 
        }));
    }, [fulfillmentSummary]);
    
    const fulfillmentStatusChartConfig = {
        Sourcing: { label: "Sourcing", color: "hsl(var(--chart-1))" },
        Quoted: { label: "Quoted", color: "hsl(var(--chart-2))" },
        Ordered: { label: "Ordered", color: "hsl(var(--chart-3))" },
        Completed: { label: "Completed", color: "hsl(var(--chart-4))" },
        Pending: { label: "Pending", color: "hsl(var(--chart-5))" },
    } satisfies ChartConfig;

    const spendByDeptPieChartConfig = useMemo(() => {
        if (!spendByDeptPieData) return {} as ChartConfig;
        const config: ChartConfig = {};
        let i = 1;
        spendByDeptPieData.forEach(dept => {
            config[dept.name] = {
                label: dept.name,
                color: `hsl(var(--chart-${i}))`
            }
            i = (i % 5) + 1;
        });
        return config;
    }, [spendByDeptPieData]);
    
    const spendByCategoryChartConfig = {
        spend: {
          label: "Spend",
          color: "hsl(var(--chart-1))",
        },
    } satisfies ChartConfig;

    const filterTitle = useMemo(() => {
        const month = availableMonths.find(m => m.value === monthFilter);
        return month ? month.label : 'All Time';
    }, [monthFilter, availableMonths]);


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
    
    const generateApprovalReport = async (request: ApprovalRequest, format: 'xlsx' | 'pdf') => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available' });
            return;
        }

        const summaryData = (() => {
            const budgetItemsForRequest = allBudgetItems?.filter(b => b.departmentId === request.departmentId) || [];
            if (!allDepartments || !request) {
                return { lines: [], totals: { procurement: 0, forecast: 0, variance: 0 } };
            }
    
            const procurementItems = request.items;
            const selectedDepartmentId = request.departmentId;
            const selectedPeriod = request.period;
    
            const selectedDept = allDepartments.find(d => d.id === selectedDepartmentId);
            const procurementYear = new Date(selectedPeriod).getFullYear();
            
            const monthName = selectedPeriod.split(' ')[0];
            const monthIndex = (selectedDept?.budgetYear === procurementYear)
                ? selectedDept?.budgetHeaders?.findIndex(h => h.toLowerCase().startsWith(monthName.toLowerCase().substring(0,3))) ?? -1
                : -1;
    
            const allCategories = new Set([
                ...procurementItems.map(item => item.category),
                ...budgetItemsForRequest.map(item => item.category)
            ]);
    
            const lines = Array.from(allCategories).map(category => {
                if (!category) return null;
    
                const itemsForCategory = procurementItems.filter(item => item.category === category);
                const procurementTotal = itemsForCategory.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
                const budgetItem = budgetItemsForRequest.find(item => item.category === category);
                const forecastTotal = (budgetItem && monthIndex !== -1 && budgetItem.forecasts.length > monthIndex)
                    ? budgetItem.forecasts[monthIndex]
                    : 0;
                const variance = procurementTotal - forecastTotal;
                const isOverBudget = procurementTotal > forecastTotal;
                const comments = itemsForCategory.filter(item => item.comments).map(item => item.comments).join('; ');
                return { category, procurementTotal, forecastTotal, variance, isOverBudget, comments, items: itemsForCategory };
            }).filter(Boolean) as any[];
            
            const totals = lines.reduce((acc, line) => {
                acc.procurement += line.procurementTotal;
                acc.forecast += line.forecastTotal;
                acc.variance += line.variance;
                return acc;
            }, { procurement: 0, forecast: 0, variance: 0 });
    
            return { lines, totals };
        })();
        
        if (format === 'pdf') {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const primaryColor = appMetadata?.pdfSettings?.primaryColor || '#c97353';
            const company = companies?.find(c => c.id === request.companyId);
            
            const doc = new jsPDF();
            
            const tableStartY = 30;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.text(`ID: ${request.id}`, doc.internal.pageSize.getWidth() - 14, 22, { align: 'right' });
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            
            doc.text(company?.name || request.companyName || 'Procurement Request', 14, 22);
    
            const detailsData: (string|number)[][] = [
                ["Request ID", request.id],
                ["Company", request.companyName || 'N/A'],
                ["Department", request.department],
                ["Period", request.period],
                ["Submitted By", request.submittedBy || 'N/A'],
                ["Total", formatCurrency(request.total)],
                ["Status", request.status],
            ];

            autoTable(doc, {
                startY: tableStartY,
                head: [['Request Details', '']],
                body: detailsData,
                theme: 'striped',
                headStyles: { fillColor: primaryColor },
            });

            const itemsData = request.items.map(item => [
                item.type,
                item.description,
                item.category,
                item.qty,
                formatCurrency(item.unitPrice),
                formatCurrency(item.qty * item.unitPrice),
            ]);
            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Type', 'Description', 'Category', 'Qty', 'Unit Price', 'Total']],
                body: itemsData,
                headStyles: { fillColor: primaryColor },
            });

            const summaryTableData = summaryData.lines.map((line: any) => [
                line.category,
                formatCurrency(line.procurementTotal),
                formatCurrency(line.forecastTotal),
                formatCurrency(line.variance),
            ]);
            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Budget Summary', 'Request Total', 'Forecast Total', 'Variance']],
                body: summaryTableData,
                foot: [[
                    'Total',
                    formatCurrency(summaryData.totals.procurement),
                    formatCurrency(summaryData.totals.forecast),
                    formatCurrency(summaryData.totals.variance)
                ]],
                theme: 'grid',
                headStyles: { fillColor: primaryColor },
                footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' }
            });
            
            const timelineData = request.timeline.map(step => [
                step.stage,
                step.delegatedByName ? `${step.actor} (for ${step.delegatedByName})` : step.actor,
                step.status,
                step.date || 'N/A',
            ]);
            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Stage', 'Actor', 'Status', 'Date']],
                body: timelineData,
                headStyles: { fillColor: primaryColor },
                columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 25 }
                }
            });
            
            doc.save(`Procurement-Request-${request.id}.pdf`);
            return;
        }

        // XLSX Logic
        const detailsDataForSheet = [
            { Key: "Request ID", Value: request.id },
            { Key: "Company", Value: request.companyName || 'N/A' },
            { Key: "Department", Value: request.department },
            { Key: "Period", Value: request.period },
            { Key: "Submitted By", Value: request.submittedBy || 'N/A' },
            { Key: "Total", Value: formatCurrency(request.total) },
            { Key: "Status", Value: request.status },
        ];
        const detailsSheet = XLSX.utils.json_to_sheet(detailsDataForSheet, { skipHeader: true });

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

        const summaryDataForSheet = summaryData.lines.map((line: any) => ({
            'Category': line.category,
            'Request Total': line.procurementTotal,
            'Forecast Total': line.forecastTotal,
            'Variance': line.variance,
        }));
        summaryDataForSheet.push({
            'Category': 'GRAND TOTAL',
            'Request Total': summaryData.totals.procurement,
            'Forecast Total': summaryData.totals.forecast,
            'Variance': summaryData.totals.variance,
        });
        const summarySheet = XLSX.utils.json_to_sheet(summaryDataForSheet);

        const timelineData = request.timeline.map(step => ({
            'Stage': step.stage,
            'Actor': step.delegatedByName ? `${step.actor} (for ${step.delegatedByName})` : step.actor,
            'Status': step.status,
            'Date': step.date || 'N/A',
        }));
        const timelineSheet = XLSX.utils.json_to_sheet(timelineData);
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, detailsSheet, "Request Details");
        XLSX.utils.book_append_sheet(wb, itemsSheet, "Line Items");
        XLSX.utils.book_append_sheet(wb, summarySheet, "Budget Summary");
        XLSX.utils.book_append_sheet(wb, timelineSheet, "Approval History");

        XLSX.writeFile(wb, `Procurement-Request-${request.id}.xlsx`);
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
                userName: user.displayName || user.email || 'Unknown',
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
                userName: user.displayName || user.email || 'Unknown',
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
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
            {(role === 'Administrator' || role === 'Executive') && departmentsForFilter.length > 0 && (
                <div className="grid gap-1.5">
                    <Label htmlFor="department-filter">Department</Label>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger id="department-filter" className="w-[220px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departmentsForFilter.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="grid gap-1.5">
                <Label htmlFor="month-filter">Period</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger id="month-filter" className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {availableMonths.map(month => (
                            <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-end mb-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="overview">
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
                          Spend ({filterTitle})
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        {mainWidgetsLoading ? (
                             <div className="flex items-center justify-center h-24">
                              <Loader className="h-6 w-6 animate-spin" />
                            </div>
                        ) : (
                          <>
                            <div className="text-2xl font-bold">{formatCurrency(dashboardStats.totalSpend)}</div>
                            <p className="text-xs text-muted-foreground">Total value of requests in the selected period.</p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Awaiting Action ({filterTitle})
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        {mainWidgetsLoading ? (
                             <div className="flex items-center justify-center h-24">
                              <Loader className="h-6 w-6 animate-spin" />
                            </div>
                        ) : (
                            <>
                            <div className="text-2xl font-bold">{dashboardStats.openRequests.length || 0} Open Requests</div>
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
                    <Link href="/dashboard/approvals?emergency=true" className="block hover:shadow-lg transition-shadow rounded-lg">
                        <Card className="h-full">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                              Emergency Requests ({filterTitle})
                            </CardTitle>
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          </CardHeader>
                          <CardContent>
                            {mainWidgetsLoading ? (
                              <div className="flex items-center justify-center h-24">
                                <Loader className="h-6 w-6 animate-spin" />
                              </div>
                            ) : (
                              <>
                                <div className="text-2xl font-bold">{emergencyStats.count} Requests</div>
                                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <div>Total Value</div>
                                  <div className="font-semibold text-right text-foreground">{formatCurrency(emergencyStats.totalAmount)}</div>
                                  <div>Avg. Value</div>
                                  <div className="font-semibold text-right text-foreground">{formatCurrency(emergencyStats.averageAmount)}</div>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="lg:col-span-2">
                      <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Briefcase className="h-5 w-5 text-primary"/>
                              All My Open Submissions
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              A summary of all submissions currently in the approval pipeline for you.
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
                              {allOpenRequestsLoading ? (
                                  <TableRow>
                                      <TableCell colSpan={6} className="text-center h-24">
                                          <Loader className="h-6 w-6 animate-spin mx-auto" />
                                      </TableCell>
                                  </TableRow>
                              ) : allRequestsForUser && allRequestsForUser.length > 0 ? (
                                allRequestsForUser.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)).slice(0, 5).map((req) => (
                                  <TableRow key={req.id}>
                                    <TableCell className="font-medium">
                                      <Link href={`/dashboard/approvals?id=${req.id}`} className="hover:underline text-primary cursor-pointer">{req.id}</Link>
                                    </TableCell>
                                    <TableCell>{req.period}</TableCell>
                                    <TableCell>{req.submittedBy || 'N/A'}</TableCell>
                                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatCurrency(req.total)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {['Approved', 'In Fulfillment', 'Completed'].includes(req.status) && (
                                          <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" size="icon">
                                                      <Download className="h-4 w-4" />
                                                  </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent>
                                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => generateApprovalReport(req, 'xlsx')}>
                                                      Export as Excel (.xlsx)
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => generateApprovalReport(req, 'pdf')}>
                                                      Export as PDF (.pdf)
                                                  </DropdownMenuItem>
                                              </DropdownMenuContent>
                                          </DropdownMenu>
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
                            Approval Pipeline ({filterTitle})
                          </CardTitle>
                          <CardDescription>Live view of requests awaiting action.</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        {mainWidgetsLoading ? (
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
                                <PipelineStage name="Procurement" count={dashboardStats.approvedCount} highlight={dashboardStats.approvedCount > 0}/>
                            </div>
                            
                            {(dashboardStats.queriesRaised > 0 || dashboardStats.fulfillmentCount > 0) && <Separator className="my-4"/>}

                            <div className="flex justify-around items-center text-center text-sm gap-4">
                                {dashboardStats.fulfillmentCount > 0 && (
                                    <Link href={`/dashboard/approvals?status=In%20Fulfillment`} className="flex items-center gap-2 cursor-pointer transition-transform duration-200 hover:scale-110">
                                        <div className="font-bold text-lg text-indigo-500">{dashboardStats.fulfillmentCount}</div>
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
            </TabsContent>
            <TabsContent value="visualizations">
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Spend vs. Budget by Department ({filterTitle})</CardTitle>
                            <CardDescription>
                                {monthFilter === 'all_time' ? "Total spend across all departments." : "Comparison of spend against forecasted budget for each department."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={spendByDeptChartConfig} className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartsLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <Loader className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : spendByDeptVsBudgetData.length > 0 ? (
                                        <BarChart data={spendByDeptVsBudgetData} margin={{ top: 20, right: 20, bottom: 5, left: 20 }}>
                                            <CartesianGrid vertical={false} />
                                            <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} interval={0} />
                                            <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                                            <Tooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                                            <Legend content={<ChartLegendContent />} />
                                            {monthFilter !== 'all_time' && <Bar dataKey="budget" fill="var(--color-budget)" radius={4} />}
                                            <Bar dataKey="spend" fill="var(--color-spend)" radius={4} />
                                        </BarChart>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">No data for the selected period.</div>
                                    )}
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Open Requests by Status</CardTitle>
                            <CardDescription>Distribution of all open procurement requests by their current status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={requestsByStatusChartConfig} className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    {allOpenRequestsLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <Loader className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : requestsByStatusData.length > 0 ? (
                                        <PieChart>
                                            <Tooltip content={<ChartTooltipContent />} />
                                            <Pie data={requestsByStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                                                {requestsByStatusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                                        </PieChart>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">No open requests.</div>
                                    )}
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Fulfillment Status Overview</CardTitle>
                            <CardDescription>Breakdown of all fulfillment tasks across active requests.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={fulfillmentStatusChartConfig} className="h-[300px] w-full">
                                 <ResponsiveContainer width="100%" height="100%">
                                    {fulfillmentLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <Loader className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : fulfillmentStatusData.length > 0 ? (
                                        <PieChart>
                                            <Tooltip content={<ChartTooltipContent />} />
                                            <Pie data={fulfillmentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                                                {fulfillmentStatusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                                        </PieChart>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">No items in fulfillment.</div>
                                    )}
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Spend by Department ({filterTitle})</CardTitle>
                            <CardDescription>Distribution of total spend across departments.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={spendByDeptPieChartConfig} className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartsLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <Loader className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : spendByDeptPieData.length > 0 ? (
                                        <PieChart>
                                            <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                                            <Pie data={spendByDeptPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                                                {spendByDeptPieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                                        </PieChart>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">No spend data to display.</div>
                                    )}
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Spend by Category ({filterTitle})</CardTitle>
                            <CardDescription>Top spending categories for the selected period.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <ChartContainer config={spendByCategoryChartConfig} className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartsLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <Loader className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : spendByCategoryData.length > 0 ? (
                                        <BarChart data={spendByCategoryData.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 50 }}>
                                            <CartesianGrid horizontal={false} />
                                            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} interval={0} width={120} />
                                            <XAxis dataKey="spend" type="number" hide />
                                            <Tooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                                            <Bar dataKey="spend" fill="var(--color-spend)" radius={4} layout="vertical">
                                                <LabelList
                                                    dataKey="spend"
                                                    position="right"
                                                    offset={8}
                                                    className="fill-foreground"
                                                    fontSize={12}
                                                    formatter={(value: number) => formatCurrency(value)}
                                                />
                                            </Bar>
                                        </BarChart>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">No category spend data.</div>
                                    )}
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
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
