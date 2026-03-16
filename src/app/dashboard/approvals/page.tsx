
'use client';

import { useUser, type UserRole, type UserProfile } from "@/firebase/auth/use-user";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import { Loader, X, Check, MessageSquare, Paperclip, Send, Circle, AlertTriangle, ChevronRight, Download } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where, doc, updateDoc, arrayUnion, addDoc, serverTimestamp, getDocs, getDoc, setDoc } from "firebase/firestore";
import type { ApprovalRequest } from "@/lib/approvals-mock-data";
import { useRoles } from "@/lib/roles-provider";
import { logErrorToFirestore } from "@/lib/error-logger";
import { useBudgetSummary } from "@/hooks/use-budget-summary";
import { requestActionRequiredTemplate, queryRaisedTemplate, requestRejectedTemplate } from '@/lib/email-templates';
import * as XLSX from 'xlsx';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


type WorkflowStage = {
    id: string;
    name: string;
    role: UserRole;
    permissions: string[];
    useAlternateEmail?: boolean;
    alternateEmail?: string;
    sendToBoth?: boolean;
};

type Department = {
  id: string;
  name: string;
  workflow?: WorkflowStage[];
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

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
};

const generateApprovalReport = (request: ApprovalRequest, summaryData: ReturnType<typeof useBudgetSummary>, format: 'xlsx' | 'pdf') => {
    if (format === 'pdf') {
        const doc = new jsPDF();
        const logo = PlaceHolderImages.find((img) => img.id === "logo-1");
        if (logo && logo.imageUrl.startsWith('data:image')) {
             doc.addImage(logo.imageUrl, 'PNG', 14, 12, 50, 12);
        }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(request.companyName || 'N/A', doc.internal.pageSize.getWidth() - 14, 20, { align: 'right' });

        doc.setFontSize(18);
        doc.setFont('helvetica', 'normal');
        doc.text(`Procurement Request: ${request.id.substring(0, 8)}...`, 14, 35);

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
            startY: 42,
            head: [['Request Details', '']],
            body: detailsData,
            theme: 'striped',
            headStyles: { fillColor: [201, 115, 83] },
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
            headStyles: { fillColor: [201, 115, 83] },
        });
        
        const summaryTableData = summaryData.lines.map(line => [
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
            headStyles: { fillColor: [201, 115, 83] },
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
            headStyles: { fillColor: [201, 115, 83] },
        });

        doc.save(`Procurement-Request-${request.id.substring(0, 8)}.pdf`);
        return;
    }

    // XLSX logic
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

    // 3. Budget Summary
    const summaryDataForSheet = summaryData.lines.map(line => ({
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

    // 4. Approval History
    const timelineData = request.timeline.map(step => ({
        'Stage': step.stage,
        'Actor': step.delegatedByName ? `${step.actor} (for ${step.delegatedByName})` : step.actor,
        'Status': step.status,
        'Date': step.date || 'N/A',
    }));
    const timelineSheet = XLSX.utils.json_to_sheet(timelineData);
    
    // Create workbook and add sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, detailsSheet, "Request Details");
    XLSX.utils.book_append_sheet(wb, itemsSheet, "Line Items");
    XLSX.utils.book_append_sheet(wb, summarySheet, "Budget Summary");
    XLSX.utils.book_append_sheet(wb, timelineSheet, "Approval History");

    // Download the file
    XLSX.writeFile(wb, `Procurement-Request-${request.id.substring(0, 8)}.xlsx`);
};


const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Pending Manager Approval': return <Badge variant="outline" className="text-blue-500 border-blue-500">Pending Manager</Badge>;
        case 'Pending Executive': return <Badge variant="outline" className="text-orange-500 border-orange-500">Pending Executive</Badge>;
        case 'Approved': return <Badge variant="outline" className="text-purple-500 border-purple-500">Approved</Badge>;
        case 'In Fulfillment': return <Badge variant="outline" className="text-indigo-500 border-indigo-500">In Fulfillment</Badge>;
        case 'Completed': return <Badge variant="outline" className="text-green-500 border-green-500">Completed</Badge>;
        case 'Queries Raised': return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{status}</Badge>;
        case 'Rejected': return <Badge variant="destructive">{status}</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>
    }
}

const getFulfillmentStatusBadge = (status: string) => {
    switch (status) {
      case "Sourcing":
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{status}</Badge>;
      case "Quoted":
        return <Badge variant="outline" className="text-blue-500 border-blue-500">{status}</Badge>;
      case "Ordered":
        return <Badge variant="outline" className="text-purple-500 border-purple-500">{status}</Badge>;
      case "Completed":
        return <Badge variant="outline" className="text-green-500 border-green-500">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Pending'}</Badge>;
    }
};

export default function ApprovalsPage() {
    const { user, profile, loading: userLoading } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { roles, loading: rolesLoading } = useRoles();
    const role = profile?.role;
    const userDepartment = profile?.department;


    const requestsQuery = useMemo(() => {
        if (!firestore || !role) return null;

        const baseQuery = collection(firestore, 'procurementRequests');

        if (role === 'Administrator') {
            // Exclude completed and archived requests to improve performance for admins.
            // They can still be accessed via direct link/search if needed.
            return query(baseQuery, where('status', 'not-in', ['Completed', 'Archived']));
        }
        if (role === 'Executive') {
            return query(baseQuery, where('status', 'in', ['Pending Executive', 'Pending Manager Approval', 'Approved', 'Queries Raised', 'In Fulfillment', 'Completed']));
        }
        if (role === 'Manager') {
            if (!userDepartment) return null; // Manager must have a department
            return query(baseQuery, where('department', '==', userDepartment));
        }
        if (role === 'Procurement Officer' || role === 'Procurement Assistant') {
            return query(baseQuery, where('status', 'in', ['Approved', 'In Fulfillment', 'Completed']));
        }
        if (role === 'Requester') {
            if (!userDepartment) return null; // Requester must have a department
            return query(baseQuery, where('department', '==', userDepartment));
        }

        return null; // No requests for other roles on this page
    }, [firestore, role, userDepartment]);

    const { data: approvals, loading: approvalsLoading } = useCollection<ApprovalRequest>(requestsQuery);
    
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const usersQuery = useMemo(() => collection(firestore, 'users'), [firestore]);
    const { data: allUsers, loading: usersLoading } = useCollection<UserProfile>(usersQuery);
    
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [newComment, setNewComment] = useState("");
    const [isQueryDialogOpen, setIsQueryDialogOpen] = useState(false);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);
    const [openCategory, setOpenCategory] = useState<string | null>(null);

    const activeRequest = useMemo(() => approvals?.find((req) => req.id === selectedRequestId), [selectedRequestId, approvals]);
    
    const budgetsQuery = useMemo(() => {
        if (!firestore || !activeRequest?.departmentId) return null;
        return query(collection(firestore, 'budgets'), where('departmentId', '==', activeRequest.departmentId));
    }, [firestore, activeRequest]);
    const { data: budgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);
    
    const summaryData = useBudgetSummary(
        activeRequest?.items || [],
        activeRequest?.departmentId || '',
        activeRequest?.period || '',
        budgetItems,
        departments
    );

    const loading = userLoading || approvalsLoading || rolesLoading || deptsLoading || usersLoading || (!!activeRequest && budgetsLoading);

    const filteredRequests = useMemo(() => {
        if (!approvals) return [];
        const statusFilter = searchParams.get('status');
        if (statusFilter) {
            return approvals.filter(req => req.status === decodeURIComponent(statusFilter));
        }
        return approvals;
    }, [approvals, searchParams]);

    useEffect(() => {
        const reqId = searchParams.get('id');
        if (reqId) {
            setSelectedRequestId(reqId);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!selectedRequestId && filteredRequests.length > 0) {
            const firstPending = filteredRequests.find(a => a.status.startsWith('Pending') || a.status === 'Approved');
            setSelectedRequestId(firstPending?.id || filteredRequests[0]?.id || null);
        }
    }, [filteredRequests, selectedRequestId]);

    
    const showFulfillmentTab = useMemo(() => {
        if (!activeRequest) return false;
        return ['Approved', 'In Fulfillment', 'Completed'].includes(activeRequest.status);
    }, [activeRequest]);

    const canApprove = useMemo(() => {
        if (!activeRequest || !role || !user || !allUsers) return false;
        const { status } = activeRequest;
        
        if (role === 'Administrator' && (status.startsWith('Pending') || status === 'Approved' || status === 'Queries Raised')) return true;
        if (role === 'Manager' && (status === 'Pending Manager Approval' || status === 'Queries Raised')) return true;
        
        // Executive approval check
        if (status === 'Pending Executive' || status === 'Pending Manager Approval' || status === 'Queries Raised') {
            // Direct executive can approve
            if (role === 'Executive') return true;
            // Delegate can approve
            const isDelegateForExecutive = allUsers.some(u => u.role === 'Executive' && u.delegatedToId === user.uid);
            if (isDelegateForExecutive) return true;
        }

        if (role === 'Procurement Officer' && status === 'Approved') return true;
        
        return false;
    }, [activeRequest, role, user, allUsers]);

    const canRejectOrQuery = useMemo(() => {
        if (!activeRequest || !role || !user || !allUsers) return false;
        const { status } = activeRequest;
        
        if (role === 'Administrator') {
            // Admins can reject/query as long as it's not fully completed or archived.
            return !['Completed', 'Archived', 'In Fulfillment'].includes(status);
        }
        if (role === 'Manager') {
            return status === 'Pending Manager Approval' || status === 'Queries Raised';
        }
        if (status === 'Pending Manager Approval' || status === 'Pending Executive' || status === 'Queries Raised') {
            // Direct executive can reject/query
            if (role === 'Executive') return true;
            // Delegate can reject/query
            const isDelegateForExecutive = allUsers.some(u => u.role === 'Executive' && u.delegatedToId === user.uid);
            if (isDelegateForExecutive) return true;
        }
        
        // Requesters and Procurement Officers cannot reject or raise queries through these buttons.
        return false;
    }, [activeRequest, role, user, allUsers]);


    const approvalSummary = useMemo(() => {
        const pending = filteredRequests.filter(req => req.status.startsWith('Pending') || req.status === 'Approved' || req.status === 'Queries Raised');
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

    const budgetProgress = useMemo(() => {
        const { procurement, forecast } = summaryData.totals;
        if (forecast <= 0) return procurement > 0 ? 100 : 0;
        return Math.min(Math.round((procurement / forecast) * 100), 100);
    }, [summaryData]);


    useEffect(() => {
      if (loading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }
      const userPerms = roles.find(r => r.name === role)?.permissions || [];
      if (role !== 'Administrator' && !userPerms.includes('approvals:view')) {
          router.push('/dashboard');
      }
    }, [user, role, roles, loading, router]);
    
    if (loading || !user || !role) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleApprove = async () => {
        if (!activeRequest || !selectedRequestId || !user || !firestore || !allUsers || !profile) return;

        setIsSubmittingAction(true);
        let newStatus: ApprovalRequest['status'] = activeRequest.status;
        let newTimeline = [...activeRequest.timeline];
        let toastMessage: {title: string, description: string} | null = null;
        const actorName = profile.displayName || user.displayName || role || 'System';
        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        
        let delegationInfo: { delegatedById?: string; delegatedByName?: string } = {};
        const isDelegateForExecutive = allUsers.some(u => u.role === 'Executive' && u.delegatedToId === user.uid);

        if (isDelegateForExecutive && (activeRequest.status === 'Pending Executive' || activeRequest.status === 'Pending Manager Approval')) {
            const executive = allUsers.find(u => u.role === 'Executive' && u.delegatedToId === user.uid);
            if (executive) {
                delegationInfo = { delegatedById: executive.id, delegatedByName: executive.displayName };
            }
        }

        const timelineUpdater = (stepName: string, nextStageName: string) => {
            return (step: ApprovalRequest['timeline'][0]) => {
                if (step.stage === stepName) {
                    return { ...step, status: 'completed' as const, date: currentDate, actor: actorName, ...delegationInfo };
                }
                if (step.stage === nextStageName) {
                    return { ...step, status: 'pending' as const };
                }
                return step;
            };
        };

        if (role === 'Administrator') {
            if (activeRequest.status === 'Pending Manager Approval' || activeRequest.status === 'Queries Raised') {
                newStatus = 'Pending Executive';
                toastMessage = { title: "Request Stage Advanced", description: `Admin approved. Forwarded for executive approval.`};
                newTimeline = newTimeline.map(timelineUpdater('Manager Review', 'Executive Approval'));
            } else if (activeRequest.status === 'Pending Executive') {
                newStatus = 'Approved';
                toastMessage = { title: "Request Stage Advanced", description: `Admin approved. Sent for processing.` };
                newTimeline = newTimeline.map(timelineUpdater('Executive Approval', 'Procurement Processing'));
            } else if (activeRequest.status === 'Approved') {
                newStatus = 'In Fulfillment';
                toastMessage = { title: "Request Acknowledged", description: `Admin action. Request is now in fulfillment.`};
                newTimeline = newTimeline.map(timelineUpdater('Procurement Processing', 'In Fulfillment' as any));
            }
        } else if (role === 'Manager' && (activeRequest.status === 'Pending Manager Approval' || activeRequest.status === 'Queries Raised')) {
            newStatus = 'Pending Executive';
            toastMessage = { title: "Request Approved", description: `${activeRequest.id.substring(0,8)}... has been forwarded for executive approval.` };
            newTimeline = newTimeline.map(timelineUpdater('Manager Review', 'Executive Approval'));
        } else if (role === 'Executive' || isDelegateForExecutive) {
            if(activeRequest.status === 'Pending Executive' || activeRequest.status === 'Pending Manager Approval' || activeRequest.status === 'Queries Raised') {
                newStatus = 'Approved';
                toastMessage = { title: "Request Approved", description: `${activeRequest.id.substring(0,8)}... has been approved and sent for processing.` };
                
                const managerReviewIndex = newTimeline.findIndex(s => s.stage === 'Manager Review');
                const execApprovalIndex = newTimeline.findIndex(s => s.stage === 'Executive Approval');

                if (managerReviewIndex > -1 && newTimeline[managerReviewIndex].status !== 'completed') {
                    newTimeline[managerReviewIndex] = { ...newTimeline[managerReviewIndex], status: 'completed', date: currentDate, actor: actorName };
                }
                if (execApprovalIndex > -1) {
                    newTimeline[execApprovalIndex] = { ...newTimeline[execApprovalIndex], status: 'completed', date: currentDate, actor: actorName, ...delegationInfo };
                }
                const procurementProcessingIndex = newTimeline.findIndex(s => s.stage === 'Procurement Processing');
                if (procurementProcessingIndex > -1) {
                        newTimeline[procurementProcessingIndex] = { ...newTimeline[procurementProcessingIndex], status: 'pending' };
                }
            }
        } else if (role === 'Procurement Officer' && activeRequest.status === 'Approved') {
            newStatus = 'In Fulfillment';
            toastMessage = { title: "Request Acknowledged", description: `Request ${activeRequest.id.substring(0,8)}... is now in fulfillment.` };
            newTimeline = newTimeline.map(timelineUpdater('Procurement Processing', 'In Fulfillment' as any));
        }

        if (!toastMessage) {
            setIsSubmittingAction(false);
            return;
        }

        const requestRef = doc(firestore, 'procurementRequests', selectedRequestId);
        const updateData = { status: newStatus, timeline: newTimeline };
        const action = 'request.approve';

        const finalToastMessage = toastMessage;
        
        try {
            await updateDoc(requestRef, updateData);
            toast(finalToastMessage);

            if (newStatus === 'Approved') {
                const reportDataForGeneration: ApprovalRequest = {
                    ...activeRequest,
                    ...updateData,
                };
                generateApprovalReport(reportDataForGeneration, summaryData, 'xlsx');
            }

            let auditDetails = `Approved request ${activeRequest.id.substring(0,8)}..., new status "${newStatus}"`;
            if (delegationInfo.delegatedByName) {
                auditDetails = `Approved request ${activeRequest.id.substring(0,8)}... on behalf of ${delegationInfo.delegatedByName}, new status "${newStatus}"`;
            }

            const auditLogData = {
                userId: user.uid,
                userName: profile.displayName || user.displayName || 'System',
                action,
                details: auditDetails,
                entity: { type: 'procurementRequest', id: selectedRequestId },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);

            // Special Notification for PO Acknowledgment to Procurement Assistant
            if (role === 'Procurement Officer' && newStatus === 'In Fulfillment') {
                const assistantsQuery = query(collection(firestore, 'users'), where('role', '==', 'Procurement Assistant'));
                const assistantsSnapshot = await getDocs(assistantsQuery);
                const assistantEmails = assistantsSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
        
                if (assistantEmails.length > 0) {
                    const link = `${window.location.origin}/dashboard/fulfillment`;
                    const emailHtml = requestActionRequiredTemplate(
                        { id: activeRequest.id, department: activeRequest.department, total: activeRequest.total, submittedBy: activeRequest.submittedBy },
                        "Fulfillment Started",
                        link
                    );
        
                    try {
                        const response = await fetch('/api/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                to: assistantEmails.join(','),
                                subject: `Request Now In Fulfillment: ${activeRequest.id.substring(0,8)}...`,
                                html: emailHtml,
                            })
                        });
                        const responseData = await response.json();
                        if (!response.ok) {
                          throw new Error(responseData.error || 'Failed to send email to assistants');
                        }
                        await addDoc(collection(firestore, 'auditLogs'), {
                            userId: user.uid,
                            userName: 'System',
                            action: 'notification.sent',
                            details: `Fulfillment notification sent to Procurement Assistants: ${assistantEmails.join(', ')}`,
                            entity: { type: 'procurementRequest', id: selectedRequestId },
                            timestamp: serverTimestamp()
                        });
                    } catch (emailError) {
                        console.error("Email API call to assistants failed:", emailError);
                        await logErrorToFirestore(firestore, {
                            userId: user.uid,
                            userName: 'System',
                            action: 'notification.assistant_email_failed',
                            errorMessage: (emailError as Error).message,
                            errorStack: (emailError as Error).stack,
                        });
                    }
                }
            }
            
            if (departments && activeRequest.departmentId) {
                const department = departments.find(d => d.id === activeRequest.departmentId);
                const nextStage = newTimeline.find(step => step.status === 'pending');
                
                if (department && department.workflow && nextStage) {
                    const workflowStageConfig = department.workflow.find(wfStage => wfStage.name === nextStage.stage);
                    
                    if (workflowStageConfig) {
                        const usersCollectionRef = collection(firestore, 'users');
                        const q = query(usersCollectionRef, where('role', '==', workflowStageConfig.role));
                        const querySnapshot = await getDocs(q);
                        
                        const primaryRecipients: string[] = [];
                        querySnapshot.forEach(doc => {
                            const userProfile = doc.data();
                            if (userProfile.email) primaryRecipients.push(userProfile.email);
                        });

                        let finalRecipients: string[] = [];
                        if (workflowStageConfig.useAlternateEmail && workflowStageConfig.alternateEmail) {
                            if (workflowStageConfig.sendToBoth) {
                                finalRecipients = [...primaryRecipients, workflowStageConfig.alternateEmail];
                            } else {
                                finalRecipients = [workflowStageConfig.alternateEmail];
                            }
                        } else {
                            finalRecipients = primaryRecipients;
                        }
                        
                        const uniqueRecipients = [...new Set(finalRecipients)];
                
                        if (uniqueRecipients.length > 0) {
                            const link = `${window.location.origin}/dashboard/approvals?id=${selectedRequestId}`;
                            const emailHtml = requestActionRequiredTemplate(
                                { id: activeRequest.id, department: activeRequest.department, total: activeRequest.total, submittedBy: activeRequest.submittedBy },
                                nextStage.stage,
                                link
                            );

                            try {
                                const response = await fetch('/api/send-email', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        to: uniqueRecipients.join(','),
                                        subject: `Procurement Request Action Required: ${activeRequest.id.substring(0,8)}...`,
                                        html: emailHtml,
                                    })
                                });
                                const responseData = await response.json();
                                if (!response.ok) {
                                  throw new Error(responseData.error || 'Failed to send email');
                                }
                                await addDoc(collection(firestore, 'auditLogs'), {
                                    userId: user.uid,
                                    userName: 'System',
                                    action: 'notification.sent',
                                    details: `Notification sent for stage '${nextStage.stage}' to: ${uniqueRecipients.join(', ')}`,
                                    entity: { type: 'procurementRequest', id: selectedRequestId },
                                    timestamp: serverTimestamp()
                                });
                            } catch (emailError) {
                                console.error("Email API call failed:", emailError);
                                await logErrorToFirestore(firestore, {
                                    userId: user.uid,
                                    userName: 'System',
                                    action: 'notification.email_api_failed',
                                    errorMessage: (emailError as Error).message,
                                    errorStack: (emailError as Error).stack,
                                });
                            }
                        }
                    }
                }
            }
            
        } catch (error: any) {
            console.error("Approval Error:", error);
            toast({
                variant: "destructive",
                title: "Approval Failed",
                description: error.message || "Could not update the request. Please check your connection and try again.",
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: profile.displayName || user.displayName || 'System',
                action: 'request.approve',
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };
    
    const handleReject = async () => {
        setNewComment('');
        setIsRejectDialogOpen(true);
    };

    const handleConfirmReject = async () => {
        if (!activeRequest || !selectedRequestId || !user || !firestore || !profile) return;
        
        if (!newComment.trim()) {
            toast({
                variant: "destructive",
                title: "Rejection Reason Required",
                description: "Please provide a reason for rejecting this request.",
            });
            return;
        }

        setIsSubmittingAction(true);
        const newStatus: ApprovalRequest['status'] = 'Rejected';
        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        
        let newTimeline = [...activeRequest.timeline];
        const currentStepIndex = newTimeline.findIndex(step => step.status === 'pending');
        if (currentStepIndex !== -1) {
            newTimeline[currentStepIndex] = {
                ...newTimeline[currentStepIndex],
                status: 'rejected',
                actor: profile.displayName || user.displayName || 'System',
                date: currentDate,
            };
        }
        
        const commentData = {
            actor: profile.displayName || user.displayName || "User",
            actorId: user.uid,
            text: `REJECTED: ${newComment}`,
            timestamp: new Date().toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        };

        const requestRef = doc(firestore, 'procurementRequests', selectedRequestId);
        const updateData = { 
            status: newStatus, 
            timeline: newTimeline,
            comments: arrayUnion(commentData)
        };
        const action = 'request.reject';

        try {
            await updateDoc(requestRef, updateData);
            toast({
                title: "Request Rejected",
                description: `Request ${activeRequest.id.substring(0,8)}... has been rejected.`,
            });
            
            const auditLogData = {
                userId: user.uid,
                userName: profile.displayName || user.displayName || 'System',
                action,
                details: `Rejected request ${activeRequest.id.substring(0,8)}...`,
                entity: { type: 'procurementRequest', id: selectedRequestId },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);

            // Notify submitter
            const userDocRef = doc(firestore, 'users', activeRequest.submittedById);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const submitterProfile = userDocSnap.data();
                if (submitterProfile.email) {
                    const link = `${window.location.origin}/dashboard/approvals?id=${selectedRequestId}`;
                    const emailHtml = requestRejectedTemplate(activeRequest, commentData, link);
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: submitterProfile.email, subject: `Procurement Request Rejected: ${activeRequest.id.substring(0,8)}...`, html: emailHtml })
                    });
                }
            }

            setNewComment('');
            setIsRejectDialogOpen(false);
        } catch(error: any) {
            console.error("Reject Error:", error);
            toast({
                variant: "destructive",
                title: "Reject Failed",
                description: error.message || "Could not update the request. Please check your connection and try again.",
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: profile.displayName || user.displayName || 'System',
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };
    
    const handleRaiseQuery = async () => {
        if (!activeRequest || !selectedRequestId || !user || !firestore || !profile) return;

        if (!newComment.trim()) {
            toast({
                variant: "destructive",
                title: "Comment Required",
                description: "Please enter a comment before submitting a query.",
            });
            return;
        }

        setIsSubmittingAction(true);
        const newStatus: ApprovalRequest['status'] = 'Queries Raised';

        const commentData = {
            actor: profile.displayName || user.displayName || "User",
            actorId: user.uid,
            text: newComment,
            timestamp: new Date().toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        };

        const requestRef = doc(firestore, 'procurementRequests', selectedRequestId);
        const updateData = { 
            status: newStatus,
            comments: arrayUnion(commentData)
        };
        const action = 'request.query';
        
        try {
            await updateDoc(requestRef, updateData);
            toast({
                title: "Query Raised",
                description: `A query has been raised on request ${activeRequest.id.substring(0,8)}...`,
            });
            
            const auditLogData = {
                userId: user.uid,
                userName: profile.displayName || user.displayName || 'System',
                action,
                details: `Raised query on request ${activeRequest.id.substring(0,8)}...`,
                entity: { type: 'procurementRequest', id: selectedRequestId },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
            
            // Notify submitter
            const userDocRef = doc(firestore, 'users', activeRequest.submittedById);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const submitterProfile = userDocSnap.data();
                if (submitterProfile.email) {
                    const link = `${window.location.origin}/dashboard/approvals?id=${selectedRequestId}`;
                    const emailHtml = queryRaisedTemplate(activeRequest, commentData, link);
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: submitterProfile.email, subject: `Query on Procurement Request: ${activeRequest.id.substring(0,8)}...`, html: emailHtml })
                    });
                }
            }

            setNewComment("");
            setIsQueryDialogOpen(false);
        } catch (error: any) {
            console.error("Raise Query Error:", error);
            toast({
                variant: "destructive",
                title: "Query Failed",
                description: error.message || "Could not update the request. Please check your connection and try again.",
            });
             await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: profile.displayName || user.displayName || 'System',
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };


    const handleAddComment = async () => {
        if (!activeRequest || !user || !newComment.trim() || !firestore || !profile) return;

        setIsSubmittingAction(true);
        const commentData = {
            actor: profile.displayName || user.displayName || "User",
            actorId: user.uid,
            text: newComment,
            timestamp: new Date().toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        };
        const updateData = { comments: arrayUnion(commentData) };
        const requestRef = doc(firestore, "procurementRequests", activeRequest.id);
        const action = 'request.comment';

        try {
            await updateDoc(requestRef, updateData);
            toast({ title: "Comment added" });
            setNewComment("");

            const auditLogData = {
                userId: user.uid,
                userName: profile.displayName || user.displayName || 'System',
                action,
                details: `Added comment to request ${activeRequest.id.substring(0,8)}...`,
                entity: { type: 'procurementRequest', id: activeRequest.id },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
        } catch (error: any) {
             console.error("Add Comment Error:", error);
             toast({
                variant: "destructive",
                title: "Comment Failed",
                description: error.message || "Could not add comment. Please check your connection and try again.",
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: profile.displayName || user.displayName || 'System',
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const showFooterActions = activeRequest && (activeRequest.status.startsWith('Pending') || activeRequest.status === 'Approved' || activeRequest.status === 'Queries Raised');
    const showExportAction = activeRequest && ['Approved', 'In Fulfillment', 'Completed'].includes(activeRequest.status);
    
  return (
    <>
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
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
                                                        <p className="font-semibold">{req.id.substring(0,8)}...</p>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                    <div className="flex justify-between items-end mt-2">
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">{req.period}</p>
                                                            <p className="text-lg font-bold">{formatCurrency(req.total)}</p>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">By: {req.submittedBy || 'N/A'}</p>
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
            <div className="lg:col-span-2 space-y-4">
                {activeRequest ? (
                    <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                        <AccordionItem value="item-1" className="border-0">
                            <Card>
                                <AccordionTrigger className="w-full text-left p-6 hover:no-underline rounded-lg data-[state=open]:rounded-b-none">
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-semibold leading-none tracking-tight">Request: {activeRequest.id.substring(0,8)}...</h3>
                                        <p className="text-sm text-muted-foreground mt-1.5">{activeRequest.companyName ? `${activeRequest.companyName} • ` : ''}{activeRequest.period} &bull; {activeRequest.department} &bull; Submitted by {activeRequest.submittedBy || 'N/A'}</p>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <CardContent className="pt-0">
                                    <Tabs defaultValue="items">
                                            <TabsList className={cn("grid w-full", showFulfillmentTab ? "grid-cols-5" : "grid-cols-4")}>
                                                <TabsTrigger value="workflow">Approval Workflow</TabsTrigger>
                                                <TabsTrigger value="items">Line Items ({activeRequest.items.length})</TabsTrigger>
                                                <TabsTrigger value="summary">Budget Summary</TabsTrigger>
                                                {showFulfillmentTab && <TabsTrigger value="fulfillment">Fulfillment Details</TabsTrigger>}
                                                <TabsTrigger value="communication">Communication Log</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="workflow" className="pt-6">
                                                <div className="w-full overflow-x-auto pb-4">
                                                    <ul className="flex items-center">
                                                        {activeRequest.timeline.map((step, index) => (
                                                            <li key={step.stage} className="flex items-center">
                                                                <Card className={cn(
                                                                    'w-48 shrink-0',
                                                                    {
                                                                        'border-primary/50 bg-primary/5': step.status === 'completed',
                                                                        'border-destructive/50 bg-destructive/5': step.status === 'rejected',
                                                                        'border-orange-500/50 bg-orange-500/5': step.status === 'pending',
                                                                    }
                                                                )}>
                                                                    <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 pb-2">
                                                                        <CardTitle className="text-sm font-semibold">{step.stage}</CardTitle>
                                                                        {step.status === 'completed' && <Check className="h-4 w-4 text-primary" />}
                                                                        {step.status === 'rejected' && <X className="h-4 w-4 text-destructive" />}
                                                                        {step.status === 'pending' && <Loader className="h-4 w-4 animate-spin text-orange-500" />}
                                                                        {step.status === 'waiting' && <Circle className="h-4 w-4 text-muted-foreground" />}
                                                                    </CardHeader>
                                                                    <CardContent className="p-3 pt-0">
                                                                        <div className="text-xs text-muted-foreground">
                                                                            <p><span className="font-semibold">Actor:</span> {step.delegatedByName ? `${step.actor} (for ${step.delegatedByName})` : step.actor}</p>
                                                                            <p><span className="font-semibold">Status:</span> {step.status}</p>
                                                                            <p><span className="font-semibold">Date:</span> {step.date || '...'}</p>
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>

                                                                {index < activeRequest.timeline.length - 1 && (
                                                                     <div aria-hidden="true" className="w-16 shrink-0 text-muted-foreground px-2">
                                                                        <svg width="100%" height="24" viewBox="0 0 64 24" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                                                                            <path d="M0 12H54" stroke="currentColor" strokeWidth="2"/>
                                                                            <path d="M46 7L54 12L46 17" stroke="currentColor" strokeWidth="2"/>
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="items" className="pt-4">
                                                <div>
                                                    <h3 className="text-lg font-semibold mb-2">Request Items</h3>
                                                    <p className="text-sm text-muted-foreground mb-4">
                                                        Below are the individual items included in this procurement request.
                                                    </p>
                                                    <div className="overflow-auto rounded-lg border">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted hover:bg-muted">
                                                                    <TableHead>Description</TableHead>
                                                                    <TableHead>Category</TableHead>
                                                                    <TableHead className="text-center">Qty</TableHead>
                                                                    <TableHead className="text-right">Unit Price</TableHead>
                                                                    <TableHead className="text-right">Total</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {activeRequest.items.map((item) => (
                                                                    <TableRow key={item.id}>
                                                                        <TableCell className="font-medium">{item.description}</TableCell>
                                                                        <TableCell>{item.category}</TableCell>
                                                                        <TableCell className="text-center">{item.qty}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(item.qty * item.unitPrice)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="summary" className="pt-4">
                                                <div className="space-y-4">
                                                    <div className="p-4 border rounded-lg bg-muted/50">
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <h3 className="font-semibold text-lg">Budget vs. Actuals: {activeRequest.period}</h3>
                                                                <p className="text-sm text-muted-foreground">Live comparison of this request against the forecast.</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-2xl font-bold">{formatCurrency(summaryData.totals.procurement)}</p>
                                                                <p className="text-sm text-muted-foreground">vs forecast of {formatCurrency(summaryData.totals.forecast)}</p>
                                                            </div>
                                                        </div>
                                                        <Progress value={budgetProgress} className="mt-4" />
                                                    </div>
                                                    <div className="overflow-auto rounded-lg border">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted hover:bg-muted">
                                                                    <TableHead className="font-bold">Category</TableHead>
                                                                    <TableHead className="text-right font-bold">Request Total</TableHead>
                                                                    <TableHead className="text-right font-bold">Forecast Total</TableHead>
                                                                    <TableHead className="text-right font-bold">Variance</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {summaryData.lines.length > 0 ? summaryData.lines.map((item) => (
                                                                    <React.Fragment key={item.category}>
                                                                        <TableRow 
                                                                            className={cn("cursor-pointer", item.procurementTotal > item.forecastTotal && "bg-red-50 dark:bg-red-900/20")}
                                                                            onClick={() => setOpenCategory(openCategory === item.category ? null : item.category)}
                                                                        >
                                                                            <TableCell className="font-medium flex items-center gap-2">
                                                                                <ChevronRight className={cn("h-4 w-4 transition-transform", openCategory === item.category && "rotate-90")} />
                                                                                {item.category}
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-mono">{formatCurrency(item.procurementTotal)}</TableCell>
                                                                            <TableCell className="text-right font-mono">{formatCurrency(item.forecastTotal)}</TableCell>
                                                                            <TableCell className={cn("text-right font-mono font-semibold", item.procurementTotal > item.forecastTotal && "text-red-500 flex items-center justify-end gap-2")}>
                                                                                {item.procurementTotal > item.forecastTotal && <AlertTriangle className="h-4 w-4" />}
                                                                                {formatCurrency(item.variance)}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                        {openCategory === item.category && (
                                                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                                <TableCell colSpan={4} className="p-2">
                                                                                    <div className="p-2 bg-background rounded-md border">
                                                                                        <Table>
                                                                                            <TableHeader>
                                                                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                                                    <TableHead>Item</TableHead>
                                                                                                    <TableHead>Type</TableHead>
                                                                                                    <TableHead className="text-center">Qty</TableHead>
                                                                                                    <TableHead className="text-right">Unit Price</TableHead>
                                                                                                    <TableHead className="text-right">Total</TableHead>
                                                                                                </TableRow>
                                                                                            </TableHeader>
                                                                                            <TableBody>
                                                                                                {item.items.map((subItem) => (
                                                                                                    <TableRow key={subItem.id}>
                                                                                                        <TableCell>{subItem.description}</TableCell>
                                                                                                        <TableCell><Badge variant={subItem.type === 'Recurring' ? 'secondary' : 'outline'}>{subItem.type}</Badge></TableCell>
                                                                                                        <TableCell className="text-center">{subItem.qty}</TableCell>
                                                                                                        <TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice)}</TableCell>
                                                                                                        <TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice * subItem.qty)}</TableCell>
                                                                                                    </TableRow>
                                                                                                ))}
                                                                                            </TableBody>
                                                                                        </Table>
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )}
                                                                    </React.Fragment>
                                                                )) : (
                                                                    <TableRow>
                                                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                                                            No budget or request data available for this summary.
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                            <TableFooter>
                                                                <TableRow className="bg-muted hover:bg-muted font-bold">
                                                                    <TableCell>Subtotal</TableCell>
                                                                    <TableCell className="text-right font-mono">{formatCurrency(summaryData.totals.procurement)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{formatCurrency(summaryData.totals.forecast)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{formatCurrency(summaryData.totals.variance)}</TableCell>
                                                                </TableRow>
                                                            </TableFooter>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </TabsContent>
                                            {showFulfillmentTab && (
                                                <TabsContent value="fulfillment" className="pt-4">
                                                    <div>
                                                        <h3 className="text-lg font-semibold mb-2">Fulfillment Status</h3>
                                                        <p className="text-sm text-muted-foreground mb-4">
                                                            Track the fulfillment progress for each item in this request.
                                                        </p>
                                                        <div className="overflow-auto rounded-lg border">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow className="bg-muted hover:bg-muted">
                                                                        <TableHead>Item</TableHead>
                                                                        <TableHead className="text-center">Total Qty</TableHead>
                                                                        <TableHead className="text-center">Rcvd Qty</TableHead>
                                                                        <TableHead className="text-center">Outstanding</TableHead>
                                                                        <TableHead>Lead Time (days)</TableHead>
                                                                        <TableHead>Status</TableHead>
                                                                        <TableHead>Comments</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {activeRequest.items.map((item) => (
                                                                        <TableRow key={item.id}>
                                                                            <TableCell className="font-medium">{item.description}</TableCell>
                                                                            <TableCell className="text-center">{item.qty}</TableCell>
                                                                            <TableCell className="text-center">{item.receivedQty || 0}</TableCell>
                                                                            <TableCell className="text-center font-bold">{(item.qty - (item.receivedQty || 0))}</TableCell>
                                                                            <TableCell>{item.estimatedLeadTimeDays || 'N/A'}</TableCell>
                                                                            <TableCell>{getFulfillmentStatusBadge(item.fulfillmentStatus)}</TableCell>
                                                                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{(item.fulfillmentComments || []).join('; ')}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                </TabsContent>
                                            )}
                                            <TabsContent value="communication" className="pt-6">
                                                <div className="space-y-6">
                                                    <div className="space-y-4">
                                                        {activeRequest.comments?.map((comment, i) => (
                                                            <div key={i} className="flex items-start gap-3">
                                                                <Avatar>
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
                                                        {(!activeRequest.comments || activeRequest.comments?.length === 0) && (
                                                            <p className="text-sm text-center text-muted-foreground py-4">No comments on this request yet.</p>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <Textarea placeholder="Respond to queries or add a comment..." className="pr-24" value={newComment} onChange={(e) => setNewComment(e.target.value)}/>
                                                        <div className="absolute top-2 right-2 flex items-center gap-1">
                                                            <Button variant="ghost" size="icon"><Paperclip className="h-4 w-4"/></Button>
                                                            <Button size="icon" onClick={handleAddComment} disabled={isSubmittingAction}><Send className="h-4 w-4"/></Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TabsContent>
                                    </Tabs>
                                    </CardContent>
                                    {(showFooterActions || showExportAction) && (
                                        <CardFooter className="flex justify-end gap-2 border-t pt-6">
                                            {showExportAction && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="mr-auto">
                                                            <Download className="mr-2 h-4 w-4"/>
                                                            Export Report
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => generateApprovalReport(activeRequest, summaryData, 'xlsx')}>
                                                            Export as Excel (.xlsx)
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => generateApprovalReport(activeRequest, summaryData, 'pdf')}>
                                                            Export as PDF (.pdf)
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                            {showFooterActions && (
                                                <>
                                                    <Button variant="outline" onClick={() => setIsQueryDialogOpen(true)} disabled={isSubmittingAction || !canRejectOrQuery}><MessageSquare className="mr-2 h-4 w-4" />Raise Query</Button>
                                                    <Button variant="destructive" onClick={handleReject} disabled={isSubmittingAction || !canRejectOrQuery}><X className="mr-2 h-4 w-4" />Reject</Button>
                                                    <Button onClick={handleApprove} disabled={isSubmittingAction || !canApprove}>
                                                        {isSubmittingAction && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                                                        <Check className="mr-2 h-4 w-4" />
                                                        {role === 'Procurement Officer' ? 'Acknowledge & Process' : 'Approve'}
                                                    </Button>
                                                </>
                                            )}
                                        </CardFooter>
                                    )}
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                    </Accordion>
                ) : (
                    <Card>
                        <CardContent className="p-12 flex justify-center items-center h-full min-h-[300px]">
                            {loading ? <Loader className="h-8 w-8 animate-spin" /> : <p className="text-muted-foreground">Select a request to view its details.</p>}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
        
        <Dialog open={isQueryDialogOpen} onOpenChange={setIsQueryDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Raise a Query</DialogTitle>
                    <DialogDescription>
                        Your query will be added to the communication log and the request status will be updated to 'Queries Raised'.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea 
                        placeholder="Enter your query here. Be specific about what information is needed." 
                        value={newComment} 
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={5}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsQueryDialogOpen(false); setNewComment(''); }}>Cancel</Button>
                    <Button onClick={handleRaiseQuery} disabled={isSubmittingAction}>
                        {isSubmittingAction && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                        Submit Query
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reject Request</DialogTitle>
                    <DialogDescription>
                        Please provide a reason for rejecting this request. This will be added to the communication log.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea 
                        placeholder="Enter rejection reason here..." 
                        value={newComment} 
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={5}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsRejectDialogOpen(false); setNewComment(''); }}>Cancel</Button>
                    <Button variant="destructive" onClick={handleConfirmReject} disabled={isSubmittingAction}>
                        {isSubmittingAction && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirm Rejection
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}
