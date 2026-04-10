

'use client';

import { useUser, type UserRole } from "@/firebase/auth/use-user";
import type { UserProfile } from '@/context/authentication-provider';
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState, useMemo, Fragment } from "react";
import { Loader, X, Check, MessageSquare, Paperclip, Send, Circle, AlertTriangle, ChevronRight, Download, List, LayoutGrid, CalendarIcon } from "lucide-react";
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
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { collection, query, where, doc, updateDoc, arrayUnion, addDoc, serverTimestamp, getDocs, getDoc, setDoc } from "firebase/firestore";
import type { ApprovalRequest } from "@/lib/approvals-mock-data";
import { useRoles } from "@/lib/roles-provider";
import { logErrorToFirestore } from "@/lib/error-logger";
import { useBudgetSummary } from "@/hooks/use-budget-summary";
import { requestActionRequiredTemplate, queryRaisedTemplate, requestRejectedTemplate } from '@/lib/email-templates';
import * as XLSX from 'xlsx';
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type PdfSettings } from "../settings/pdf-design/page";
import type { User } from "firebase/auth";
import { format } from "date-fns";

type Company = {
    id: string;
    name: string;
    logoUrl?: string;
};

type AppMetadata = {
    id: string;
    pdfSettings?: PdfSettings;
};

type WorkflowStage = {
    id: string;
    name: string;
    role?: UserRole;
    approvalGroupId?: string;
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

type ApprovalGroup = {
    id: string;
    name: string;
    memberIds: string[];
};

type BudgetItem = {
    id: string;
    departmentId: string;
    category: string;
    forecasts: number[];
    yearTotal: number;
    expenseType?: 'Operational' | 'Capital';
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

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

const RequestDetailsView = ({
    request, user, profile, role, allUsers, departments, approvalGroups, companies, appMetadata
}: {
    request: ApprovalRequest,
    user: User,
    profile: UserProfile | null,
    role: UserRole,
    allUsers: UserProfile[],
    departments: Department[],
    approvalGroups: ApprovalGroup[],
    companies: Company[] | null,
    appMetadata: AppMetadata | null
}) => {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [newComment, setNewComment] = useState("");
    const [isQueryDialogOpen, setIsQueryDialogOpen] = useState(false);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const [openCapitalCategory, setOpenCapitalCategory] = useState<string | null>(null);
    
    const budgetsQuery = useMemo(() => {
        if (!firestore || !request?.departmentId) return null;
        return query(collection(firestore, 'budgets'), where('departmentId', '==', request.departmentId));
    }, [firestore, request]);
    const { data: budgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);
    
    const auditLogsQuery = useMemo(() => {
        if (!firestore || !request?.id) return null;
        return query(
            collection(firestore, 'auditLogs'), 
            where('entity.id', '==', request.id)
        );
    }, [firestore, request]);
    const { data: unsortedAuditLogs, loading: auditLogsLoading } = useCollection<AuditEvent>(auditLogsQuery);
    const auditLogs = useMemo(() => {
        if (!unsortedAuditLogs) return null;
        return [...unsortedAuditLogs].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    }, [unsortedAuditLogs]);

    const { operationalSummary, capitalSummary } = useBudgetSummary(
        request?.items || [],
        request?.departmentId || '',
        request?.period || '',
        budgetItems,
        departments
    );

    const canApproveResult = useMemo(() => {
        if (!request || !role || !user || !allUsers || !departments || !approvalGroups || !profile) return { can: false, asDelegate: false, delegator: null };
    
        const { departmentId, timeline, submittedById } = request;
    
        const pendingTimelineStage = timeline.find(t => t.status === 'pending');
        if (!pendingTimelineStage) {
            const canAcknowledge = request.status === 'Approved' && (role === 'Procurement Officer' || role === 'Procurement Assistant' || role === 'Administrator');
            return { can: canAcknowledge, asDelegate: false, delegator: null };
        }

        if (role === 'Administrator') {
            return { can: true, asDelegate: false, delegator: null };
        }
        
        if (submittedById === user.uid) {
            return { can: false, asDelegate: false, delegator: null };
        }
    
        const department = departments.find(d => d.id === departmentId);
        if (!department?.workflow) return { can: false, asDelegate: false, delegator: null };
    
        const stageConfig = department.workflow.find(w => w.name === pendingTimelineStage.stage);
        if (!stageConfig) return { can: false, asDelegate: false, delegator: null };
    
        const canExecutiveApproveDept = (execProfile: UserProfile) => {
            if (!execProfile.reportingDepartments || execProfile.reportingDepartments.length === 0) return true;
            return execProfile.reportingDepartments.includes(departmentId);
        };
        
        let potentialApprovers: UserProfile[] = [];
    
        if (stageConfig.approvalGroupId) {
            const group = approvalGroups.find(g => g.id === stageConfig.approvalGroupId);
            if (group?.memberIds) {
                potentialApprovers = allUsers.filter(u => group.memberIds.includes(u.id));
            }
        } else if (stageConfig.role) {
            potentialApprovers = allUsers.filter(u => u.role === stageConfig.role);
        }
    
        for (const approver of potentialApprovers) {
            if (approver.id === user.uid) { 
                if (approver.role === 'Executive' && !canExecutiveApproveDept(approver)) continue;
                return { can: true, asDelegate: false, delegator: null };
            }
    
            if (approver.delegatedToId === user.uid) { 
                if (approver.role === 'Executive' && !canExecutiveApproveDept(approver)) continue;
                return { can: true, asDelegate: true, delegator: approver };
            }
        }
    
        return { can: false, asDelegate: false, delegator: null };
    
    }, [request, role, user, profile, allUsers, departments, approvalGroups]);
    
    const canApprove = canApproveResult.can;


    const canRejectOrQuery = useMemo(() => {
        if (!request || !role || !user || !allUsers) return false;
        const { status } = request;
        
        if (role === 'Administrator') {
            return !['Completed', 'Archived', 'In Fulfillment'].includes(status);
        }
        if (role === 'Manager') {
            return status === 'Pending Manager Approval' || status === 'Queries Raised';
        }
        if (status === 'Pending Manager Approval' || status === 'Pending Executive' || status === 'Queries Raised') {
            if (role === 'Executive') return true;
        }
        
        return false;
    }, [request, role, user, allUsers]);

    const budgetProgress = useMemo(() => {
        if (!operationalSummary || !capitalSummary) return 0;
        const procurement = operationalSummary.totals.procurement + capitalSummary.totals.procurement;
        const forecast = operationalSummary.totals.forecast + capitalSummary.totals.forecast;
        if (forecast <= 0) return procurement > 0 ? 100 : 0;
        return Math.min(Math.round((procurement / forecast) * 100), 100);
    }, [operationalSummary, capitalSummary]);
    
    const showFulfillmentTab = useMemo(() => {
        if (!request) return false;
        return ['Approved', 'In Fulfillment', 'Completed'].includes(request.status);
    }, [request]);

    const generateApprovalReport = async (request: ApprovalRequest, summaryData: ReturnType<typeof useBudgetSummary>, format: 'xlsx' | 'pdf', auditLogs?: AuditEvent[] | null, companies?: Company[] | null, appMetadata?: AppMetadata | null) => {
        const operationalItems = request.items.filter(item => item.expenseType === 'Operational' || !item.expenseType);
        const capitalItems = request.items.filter(item => item.expenseType === 'Capital');
    
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
    
            if (operationalItems.length > 0) {
                const opItemsData = operationalItems.map(item => [
                    item.type,
                    item.description,
                    item.category,
                    item.qty,
                    formatCurrency(item.unitPrice),
                    formatCurrency(item.qty * item.unitPrice),
                ]);
                autoTable(doc, {
                    startY: (doc as any).lastAutoTable.finalY + 10,
                    head: [['Operational Items', 'Description', 'Category', 'Qty', 'Unit Price', 'Total']],
                    body: opItemsData,
                    headStyles: { fillColor: primaryColor },
                });
            }
            
            if (capitalItems.length > 0) {
                const capItemsData = capitalItems.map(item => [
                    item.type,
                    item.description,
                    item.category,
                    item.qty,
                    formatCurrency(item.unitPrice),
                    formatCurrency(item.qty * item.unitPrice),
                ]);
                autoTable(doc, {
                    startY: (doc as any).lastAutoTable.finalY + 10,
                    head: [['Capital Items', 'Description', 'Category', 'Qty', 'Unit Price', 'Total']],
                    body: capItemsData,
                    headStyles: { fillColor: primaryColor },
                });
            }
            
            const opSummaryTableData = summaryData.operationalSummary.lines.map(line => [
                line.category,
                formatCurrency(line.procurementTotal),
                formatCurrency(line.forecastTotal),
                formatCurrency(line.variance),
            ]);
            if(opSummaryTableData.length > 0) {
                autoTable(doc, {
                    startY: (doc as any).lastAutoTable.finalY + 10,
                    head: [['Operational Budget Summary', 'Request Total', 'Forecast Total', 'Variance']],
                    body: opSummaryTableData,
                    foot: [[
                        'Total',
                        formatCurrency(summaryData.operationalSummary.totals.procurement),
                        formatCurrency(summaryData.operationalSummary.totals.forecast),
                        formatCurrency(summaryData.operationalSummary.totals.variance)
                    ]],
                    theme: 'grid',
                    headStyles: { fillColor: primaryColor },
                    footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' }
                });
            }
            
            const capSummaryTableData = summaryData.capitalSummary.lines.map(line => [
                line.category,
                formatCurrency(line.procurementTotal),
                formatCurrency(line.forecastTotal),
                formatCurrency(line.variance),
            ]);
             if(capSummaryTableData.length > 0) {
                autoTable(doc, {
                    startY: (doc as any).lastAutoTable.finalY + 10,
                    head: [['Capital Budget Summary', 'Request Total', 'Forecast Total', 'Variance']],
                    body: capSummaryTableData,
                    foot: [[
                        'Total',
                        formatCurrency(summaryData.capitalSummary.totals.procurement),
                        formatCurrency(summaryData.capitalSummary.totals.forecast),
                        formatCurrency(summaryData.capitalSummary.totals.variance)
                    ]],
                    theme: 'grid',
                    headStyles: { fillColor: primaryColor },
                    footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' }
                });
            }
            
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
    
            if (auditLogs && auditLogs.length > 0) {
                const emailLog = auditLogs
                    .filter(log => log.action === 'notification.sent')
                    .map(log => ({
                        timestamp: log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('en-GB') : 'N/A',
                        details: log.details,
                    }));
            
                if (emailLog.length > 0) {
                    autoTable(doc, {
                        startY: (doc as any).lastAutoTable.finalY + 10,
                        head: [['Notification Email History']],
                        body: emailLog.map(log => [`${log.timestamp}\n${log.details}`]),
                        theme: 'striped',
                        headStyles: { fillColor: primaryColor },
                        styles: { fontSize: 8 },
                    });
                }
            }
    
            doc.save(`Procurement-Request-${request.id}.pdf`);
            return;
        }
    
        // XLSX logic
        const wb = XLSX.utils.book_new();
    
        const detailsDataForSheet = [
            { Key: "Request ID", Value: request.id },
            { Key: "Company", Value: request.companyName || 'N/A' },
            { Key: "Department", Value: request.department },
            { Key: "Period", Value: request.period },
            { Key: "Submitted By", Value: request.submittedBy || 'N/A' },
            { Key: "Total", Value: formatCurrency(request.total) },
            { Key: "Status", Value: request.status },
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailsDataForSheet, { skipHeader: true }), "Request Details");
    
        const opItemsData = operationalItems.map(item => ({ 'Type': item.type, 'Description': item.description, 'Category': item.category, 'Brand': item.brand, 'Quantity': item.qty, 'Unit Price': item.unitPrice, 'Total': item.qty * item.unitPrice }));
        const capItemsData = capitalItems.map(item => ({ 'Type': item.type, 'Description': item.description, 'Category': item.category, 'Brand': item.brand, 'Quantity': item.qty, 'Unit Price': item.unitPrice, 'Total': item.qty * item.unitPrice }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opItemsData), "Operational Items");
        if (capItemsData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(capItemsData), "Capital Items");
    
        const opSummaryDataForSheet = summaryData.operationalSummary.lines.map(line => ({ 'Category': line.category, 'Request Total': line.procurementTotal, 'Forecast Total': line.forecastTotal, 'Variance': line.variance, }));
        opSummaryDataForSheet.push({ 'Category': 'GRAND TOTAL', 'Request Total': summaryData.operationalSummary.totals.procurement, 'Forecast Total': summaryData.operationalSummary.totals.forecast, 'Variance': summaryData.operationalSummary.totals.variance });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opSummaryDataForSheet), "Operational Summary");
    
        const capSummaryDataForSheet = summaryData.capitalSummary.lines.map(line => ({ 'Category': line.category, 'Request Total': line.procurementTotal, 'Forecast Total': line.forecastTotal, 'Variance': line.variance, }));
        if (capSummaryDataForSheet.length > 0) {
            capSummaryDataForSheet.push({ 'Category': 'GRAND TOTAL', 'Request Total': summaryData.capitalSummary.totals.procurement, 'Forecast Total': summaryData.capitalSummary.totals.forecast, 'Variance': summaryData.capitalSummary.totals.variance });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(capSummaryDataForSheet), "Capital Summary");
        }
    
        const timelineData = request.timeline.map(step => ({ 'Stage': step.stage, 'Actor': step.delegatedByName ? `${step.actor} (for ${step.delegatedByName})` : step.actor, 'Status': step.status, 'Date': step.date || 'N/A', }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(timelineData), "Approval History");
    
        XLSX.writeFile(wb, `Procurement-Request-${request.id}.xlsx`);
    };

    const handleApprove = async () => {
        if (!request || !user || !firestore || !allUsers || !profile) return;
    
        setIsSubmittingAction(true);
        let newStatus: ApprovalRequest['status'] = request.status;
        let newTimeline = [...request.timeline];
        let toastMessage: {title: string, description: string} | null = null;
        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        
        const { asDelegate, delegator } = canApproveResult;
        
        const actorName = profile?.displayName || user.email || 'User';
        const actorId = user.uid;
    
        const timelineUpdater = (stepName: string, nextStageName: string) => {
            return (step: ApprovalRequest['timeline'][0]) => {
                if (step.stage === stepName) {
                    return { 
                        ...step, 
                        status: 'completed' as const, 
                        date: currentDate, 
                        actor: actorName,
                        actorId: actorId,
                        delegatedById: asDelegate ? delegator?.id : undefined,
                        delegatedByName: asDelegate ? delegator?.displayName : undefined,
                    };
                }
                if (step.stage === nextStageName) {
                    return { ...step, status: 'pending' as const };
                }
                return step;
            };
        };
    
        if (role === 'Administrator') {
            if (request.status === 'Pending Manager Approval' || request.status === 'Queries Raised') {
                newStatus = 'Pending Executive';
                toastMessage = { title: "Request Stage Advanced", description: `Admin approved. Forwarded for executive approval.`};
                newTimeline = newTimeline.map(timelineUpdater('Manager Review', 'Executive Approval'));
            } else if (request.status === 'Pending Executive') {
                newStatus = 'Approved';
                toastMessage = { title: "Request Stage Advanced", description: `Admin approved. Sent for processing.` };
                newTimeline = newTimeline.map(timelineUpdater('Executive Approval', 'Procurement Processing'));
            } else if (request.status === 'Approved') {
                newStatus = 'In Fulfillment';
                toastMessage = { title: "Request Acknowledged", description: `Admin action. Request is now in fulfillment.`};
                newTimeline = newTimeline.map(timelineUpdater('Procurement Processing', 'In Fulfillment'));
            }
        } else if (role === 'Manager' && canApprove && (request.status === 'Pending Manager Approval' || request.status === 'Queries Raised')) {
            newStatus = 'Pending Executive';
            toastMessage = { title: "Request Approved", description: `Request ${request.id} has been forwarded for executive approval.` };
            newTimeline = newTimeline.map(timelineUpdater('Manager Review', 'Executive Approval'));
        } else if (role === 'Executive' && canApprove && (request.status === 'Pending Executive' || request.status === 'Queries Raised')) {
            newStatus = 'Approved';
            toastMessage = { title: "Request Approved", description: `Request ${request.id} has been approved and sent for processing.` };
            
            const execApprovalIndex = newTimeline.findIndex(s => s.stage === 'Executive Approval');
            const procProcessingIndex = newTimeline.findIndex(s => s.stage === 'Procurement Processing');
    
            if (execApprovalIndex > -1) {
                newTimeline[execApprovalIndex] = { 
                    ...newTimeline[execApprovalIndex], 
                    status: 'completed', 
                    date: currentDate, 
                    actor: actorName, 
                    actorId, 
                    delegatedById: asDelegate ? delegator?.id : undefined, 
                    delegatedByName: asDelegate ? delegator?.displayName : undefined 
                };
            }
            if (procProcessingIndex > -1) {
                newTimeline[procProcessingIndex] = { ...newTimeline[procProcessingIndex], status: 'pending' };
            }
        } else if ((role === 'Procurement Officer' || role === 'Procurement Assistant') && request.status === 'Approved') {
            newStatus = 'In Fulfillment';
            toastMessage = { title: "Request Acknowledged", description: `Request ${request.id} is now in fulfillment.` };
            newTimeline = newTimeline.map(timelineUpdater('Procurement Processing', 'In Fulfillment'));
        }
    
        if (!toastMessage) {
            setIsSubmittingAction(false);
            return;
        }
    
        const requestRef = doc(firestore, 'procurementRequests', request.id);
        const updateData: any = { 
            status: newStatus, 
            timeline: newTimeline,
            delegatorIdForApproval: asDelegate ? (delegator?.id || null) : null,
        };
        const action = 'request.approve';
    
        const finalToastMessage = toastMessage;
        
        try {
            await updateDoc(requestRef, updateData);
            toast(finalToastMessage);
    
            if (newStatus === 'Approved') {
                const reportDataForGeneration: ApprovalRequest = {
                    ...request,
                    ...updateData,
                };
                generateApprovalReport(reportDataForGeneration, { operationalSummary, capitalSummary }, 'xlsx', auditLogs, companies, appMetadata);
            }
    
            const auditDetails = `Approved request ${request.id}, new status "${newStatus}"`;
    
            const auditLogData = {
                userId: user.uid,
                userName: actorName,
                action,
                details: auditDetails,
                entity: { type: 'procurementRequest', id: request.id },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
    
            if ((role === 'Procurement Officer' || role === 'Administrator') && newStatus === 'In Fulfillment') {
                const assistantsQuery = query(collection(firestore, 'users'), where('role', '==', 'Procurement Assistant'));
                const assistantsSnapshot = await getDocs(assistantsQuery);
                const assistantEmails = assistantsSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
        
                if (assistantEmails.length > 0) {
                    const link = `${window.location.origin}/dashboard/fulfillment`;
                    const emailHtml = requestActionRequiredTemplate(
                        { id: request.id, department: request.department, total: request.total, submittedBy: request.submittedBy },
                        "Fulfillment Started",
                        link
                    );
        
                    try {
                        const response = await fetch('/api/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                to: assistantEmails.join(','),
                                subject: `Request Now In Fulfillment: ${request.id}`,
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
                            entity: { type: 'procurementRequest', id: request.id },
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
            
            if (departments && request.departmentId) {
                const department = departments.find(d => d.id === request.departmentId);
                const nextStage = newTimeline.find(step => step.status === 'pending');
                
                if (department && department.workflow && nextStage) {
                    const workflowStageConfig = department.workflow.find(wfStage => wfStage.name === nextStage.stage);
                    
                    if (workflowStageConfig) {
                        const usersCollectionRef = collection(firestore, 'users');
                        let recipients: string[] = [];
    
                        if (workflowStageConfig.approvalGroupId && approvalGroups) {
                            const group = approvalGroups.find(g => g.id === workflowStageConfig.approvalGroupId);
                            if (group?.memberIds && group.memberIds.length > 0) {
                                const groupUsersQuery = query(usersCollectionRef, where('__name__', 'in', group.memberIds));
                                const querySnapshot = await getDocs(groupUsersQuery);
                                querySnapshot.forEach(doc => {
                                    const userProfile = doc.data();
                                    if (userProfile.email) recipients.push(userProfile.email);
                                });
                            }
                        } else if (workflowStageConfig.role) {
                            const q = query(usersCollectionRef, where('role', '==', workflowStageConfig.role));
                            const querySnapshot = await getDocs(q);
                            querySnapshot.forEach(doc => {
                                const userProfile = doc.data();
                                if (userProfile.email) recipients.push(userProfile.email);
                            });
                        }
    
                        let finalRecipients: string[] = [];
                        if (workflowStageConfig.useAlternateEmail && workflowStageConfig.alternateEmail) {
                            if (workflowStageConfig.sendToBoth) {
                                finalRecipients = [...recipients, workflowStageConfig.alternateEmail];
                            } else {
                                finalRecipients = [workflowStageConfig.alternateEmail];
                            }
                        } else {
                            finalRecipients = recipients;
                        }
                        
                        const uniqueRecipients = [...new Set(finalRecipients)];
                
                        if (uniqueRecipients.length > 0) {
                            const link = `${window.location.origin}/dashboard/approvals?id=${request.id}`;
                            const emailHtml = requestActionRequiredTemplate(
                                { id: request.id, department: request.department, total: request.total, submittedBy: request.submittedBy },
                                nextStage.stage,
                                link
                            );
    
                            try {
                                const response = await fetch('/api/send-email', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        to: uniqueRecipients.join(','),
                                        subject: `Procurement Request Action Required: ${request.id}`,
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
                                    entity: { type: 'procurementRequest', id: request.id },
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
                userName: actorName,
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
        if (!request || !user || !firestore || !profile) return;
        
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
        
        const actorString = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;

        let newTimeline = [...request.timeline];
        const currentStepIndex = newTimeline.findIndex(step => step.status === 'pending');
        if (currentStepIndex !== -1) {
            newTimeline[currentStepIndex] = {
                ...newTimeline[currentStepIndex],
                status: 'rejected',
                actor: actorString,
                actorId: user.uid,
                date: currentDate,
            };
        }
        
        const commentData = {
            actor: actorString,
            actorId: user.uid,
            text: `REJECTED: ${newComment}`,
            timestamp: new Date().toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        };

        const requestRef = doc(firestore, 'procurementRequests', request.id);
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
                description: `Request ${request.id} has been rejected.`,
            });
            
            const auditLogData = {
                userId: user.uid,
                userName: actorString,
                action,
                details: `Rejected request ${request.id}`,
                entity: { type: 'procurementRequest', id: request.id },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);

            const userDocRef = doc(firestore, 'users', request.submittedById);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const submitterProfile = userDocSnap.data();
                if (submitterProfile.email) {
                    const link = `${window.location.origin}/dashboard/approvals?id=${request.id}`;
                    const emailHtml = requestRejectedTemplate(request, commentData, link);
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: submitterProfile.email, subject: `Procurement Request Rejected: ${request.id}`, html: emailHtml })
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
                userName: actorString,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };
    
    const handleRaiseQuery = async () => {
        if (!request || !user || !firestore || !profile) return;

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

        const actorString = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;

        const commentData = {
            actor: actorString,
            actorId: user.uid,
            text: newComment,
            timestamp: new Date().toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        };

        const requestRef = doc(firestore, 'procurementRequests', request.id);
        const updateData = { 
            status: newStatus,
            comments: arrayUnion(commentData)
        };
        const action = 'request.query';
        
        try {
            await updateDoc(requestRef, updateData);
            toast({
                title: "Query Raised",
                description: `A query has been raised on request ${request.id}`,
            });
            
            const auditLogData = {
                userId: user.uid,
                userName: actorString,
                action,
                details: `Raised query on request ${request.id}`,
                entity: { type: 'procurementRequest', id: request.id },
                timestamp: serverTimestamp()
            };
            await addDoc(collection(firestore, 'auditLogs'), auditLogData);
            
            const userDocRef = doc(firestore, 'users', request.submittedById);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const submitterProfile = userDocSnap.data();
                if (submitterProfile.email) {
                    const link = `${window.location.origin}/dashboard/approvals?id=${request.id}`;
                    const emailHtml = queryRaisedTemplate(request, commentData, link);
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: submitterProfile.email, subject: `Query on Procurement Request: ${request.id}`, html: emailHtml })
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
                userName: actorString,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleAddComment = async () => {
        if (!request || !user || !newComment.trim() || !firestore || !profile) return;

        setIsSubmittingAction(true);
        const actorString = `${profile?.displayName || user.email || 'User'} (${role || 'N/A'})`;
        const commentData = {
            actor: actorString,
            actorId: user.uid,
            text: newComment,
            timestamp: new Date().toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        };
        const updateData = { comments: arrayUnion(commentData) };
        const requestRef = doc(firestore, "procurementRequests", request.id);
        const action = 'request.comment';

        try {
            await updateDoc(requestRef, updateData);
            toast({ title: "Comment added" });
            setNewComment("");

            const auditLogData = {
                userId: user.uid,
                userName: actorString,
                action,
                details: `Added comment to request ${request.id}`,
                entity: { type: 'procurementRequest', id: request.id },
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
                userName: actorString,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleMarkComplete = async () => {
        if (!request || !user || !firestore || !profile) return;
        
        setIsSubmittingAction(true);
        const requestRef = doc(firestore, 'procurementRequests', request.id);

        const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
        const actorName = `${profile?.displayName || user.email} (${role})`;

        const newTimeline = request.timeline.map(step => {
            if (step.stage === 'In Fulfillment' || step.stage === 'Completed') {
                return {
                    ...step,
                    status: 'completed' as const,
                    date: currentDate,
                    actor: actorName,
                };
            }
            if (step.status !== 'completed' && step.status !== 'rejected') {
                return {
                    ...step,
                    status: 'completed' as const,
                    date: step.date || currentDate,
                    actor: step.actor || actorName,
                }
            }
            return step;
        });

        const updateData = { 
            status: 'Completed' as const, 
            updatedAt: serverTimestamp(),
            timeline: newTimeline
        };
        const action = 'request.manual_complete';

        try {
            await updateDoc(requestRef, updateData);
            toast({ title: "Request Marked as Complete", description: `${request.id} is now complete.` });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: actorName,
                action,
                details: `Manually marked request as complete.`,
                entity: { type: 'procurementRequest', id: request.id },
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
             console.error("Manual Complete Error:", error);
             toast({ variant: "destructive", title: "Operation Failed", description: error.message });
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const showFooterActions = request && (request.status.startsWith('Pending') || ['Approved', 'In Fulfillment', 'Queries Raised'].includes(request.status));
    const showExportAction = request && ['Approved', 'In Fulfillment', 'Completed'].includes(request.status);
    const canComplete = (role === 'Procurement Officer' || role === 'Procurement Assistant' || role === 'Administrator') && request.status === 'In Fulfillment';

    if (budgetsLoading || auditLogsLoading) {
        return <div className="flex justify-center items-center p-8"><Loader className="h-6 w-6 animate-spin" /></div>
    }

    return (
        <>
            <Card>
                <Tabs defaultValue="items">
                    <TabsList className={cn("grid w-full", showFulfillmentTab ? "grid-cols-5" : "grid-cols-4")}>
                        <TabsTrigger value="workflow">Approval Workflow</TabsTrigger>
                        <TabsTrigger value="items">Line Items ({request.items.length})</TabsTrigger>
                        <TabsTrigger value="summary">Budget Summary</TabsTrigger>
                        {showFulfillmentTab && <TabsTrigger value="fulfillment">Fulfillment Details</TabsTrigger>}
                        <TabsTrigger value="communication">Communication Log</TabsTrigger>
                    </TabsList>
                    <TabsContent value="workflow" className="pt-6 px-6">
                        <div className="w-full overflow-x-auto pb-4">
                            <ul className="flex items-center">
                                {request.timeline.map((step, index) => (
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

                                        {index < request.timeline.length - 1 && (
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
                    <TabsContent value="items" className="pt-4 px-6">
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
                                        {request.items.map((item) => (
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
                    <TabsContent value="summary" className="pt-4 px-6">
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <div className="p-4 border rounded-lg bg-muted/50">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="font-semibold text-lg">Budget vs. Actuals: {request.period}</h3>
                                            <p className="text-sm text-muted-foreground">Live comparison of this request against the forecast.</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold">{formatCurrency(operationalSummary.totals.procurement + capitalSummary.totals.procurement)}</p>
                                            <p className="text-sm text-muted-foreground">vs forecast of {formatCurrency(operationalSummary.totals.forecast + capitalSummary.totals.forecast)}</p>
                                        </div>
                                    </div>
                                    <Progress value={budgetProgress} className="mt-4" />
                                </div>
                                <div className="overflow-auto rounded-lg border">
                                    <Table>
                                        <TableHeader><TableRow className="bg-muted hover:bg-muted"><TableHead className="font-bold">Operational Summary</TableHead><TableHead className="text-right font-bold">Request Total</TableHead><TableHead className="text-right font-bold">Forecast Total</TableHead><TableHead className="text-right font-bold">Variance</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {operationalSummary.lines.length > 0 ? operationalSummary.lines.map((item) => (
                                                <Fragment key={item.category}>
                                                    <TableRow className={cn("cursor-pointer", item.isOverBudget && "bg-red-50 dark:bg-red-900/20")} onClick={() => setOpenCategory(openCategory === item.category ? null : item.category)}>
                                                        <TableCell className="font-medium flex items-center gap-2"><ChevronRight className={cn("h-4 w-4 transition-transform", openCategory === item.category && "rotate-90")} />{item.category}</TableCell>
                                                        <TableCell className="text-right font-mono">{formatCurrency(item.procurementTotal)}</TableCell>
                                                        <TableCell className="text-right font-mono">{formatCurrency(item.forecastTotal)}</TableCell>
                                                        <TableCell className={cn("text-right font-mono font-semibold", item.isOverBudget && "text-red-500 flex items-center justify-end gap-2")}>{item.isOverBudget && <AlertTriangle className="h-4 w-4" />}{formatCurrency(item.variance)}</TableCell>
                                                    </TableRow>
                                                    {openCategory === item.category && (<TableRow className="bg-muted/50 hover:bg-muted/50"><TableCell colSpan={4} className="p-2"><div className="p-2 bg-background rounded-md border"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{item.items.map((subItem) => (<TableRow key={subItem.id}><TableCell>{subItem.description}</TableCell><TableCell><Badge variant={subItem.type === 'Recurring' ? 'secondary' : 'outline'}>{subItem.type}</Badge></TableCell><TableCell className="text-center">{subItem.qty}</TableCell><TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice * subItem.qty)}</TableCell></TableRow>))}</TableBody></Table></div></TableCell></TableRow>)}
                                                </Fragment>
                                            )) : <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No operational budget data.</TableCell></TableRow>}
                                        </TableBody>
                                        <TableFooter><TableRow className="bg-muted hover:bg-muted font-bold"><TableCell>Operational Subtotal</TableCell><TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.procurement)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.forecast)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(operationalSummary.totals.variance)}</TableCell></TableRow></TableFooter>
                                    </Table>
                                </div>
                                <div className="overflow-auto rounded-lg border">
                                    <Table>
                                        <TableHeader><TableRow className="bg-muted hover:bg-muted"><TableHead className="font-bold">Capital Summary</TableHead><TableHead className="text-right font-bold">Request Total</TableHead><TableHead className="text-right font-bold">Forecast Total</TableHead><TableHead className="text-right font-bold">Variance</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {capitalSummary.lines.length > 0 ? capitalSummary.lines.map((item) => (
                                                <Fragment key={item.category}>
                                                    <TableRow className={cn("cursor-pointer", item.isOverBudget && "bg-red-50 dark:bg-red-900/20")} onClick={() => setOpenCapitalCategory(openCapitalCategory === item.category ? null : item.category)}>
                                                        <TableCell className="font-medium flex items-center gap-2"><ChevronRight className={cn("h-4 w-4 transition-transform", openCapitalCategory === item.category && "rotate-90")} />{item.category}</TableCell>
                                                        <TableCell className="text-right font-mono">{formatCurrency(item.procurementTotal)}</TableCell>
                                                        <TableCell className="text-right font-mono">{formatCurrency(item.forecastTotal)}</TableCell>
                                                        <TableCell className={cn("text-right font-mono font-semibold", item.isOverBudget && "text-red-500 flex items-center justify-end gap-2")}>{item.isOverBudget && <AlertTriangle className="h-4 w-4" />}{formatCurrency(item.variance)}</TableCell>
                                                    </TableRow>
                                                    {openCapitalCategory === item.category && (<TableRow className="bg-muted/50 hover:bg-muted/50"><TableCell colSpan={4} className="p-2"><div className="p-2 bg-background rounded-md border"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{item.items.map((subItem) => (<TableRow key={subItem.id}><TableCell>{subItem.description}</TableCell><TableCell><Badge variant={subItem.type === 'Recurring' ? 'secondary' : 'outline'}>{subItem.type}</Badge></TableCell><TableCell className="text-center">{subItem.qty}</TableCell><TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(subItem.unitPrice * subItem.qty)}</TableCell></TableRow>))}</TableBody></Table></div></TableCell></TableRow>)}
                                                </Fragment>
                                            )) : <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No capital items in this submission.</TableCell></TableRow>}
                                        </TableBody>
                                        <TableFooter><TableRow className="bg-muted hover:bg-muted font-bold"><TableCell>Capital Subtotal</TableCell><TableCell className="text-right font-mono">{formatCurrency(capitalSummary.totals.procurement)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(capitalSummary.totals.forecast)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(capitalSummary.totals.variance)}</TableCell></TableRow></TableFooter>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                    {showFulfillmentTab && (
                        <TabsContent value="fulfillment" className="pt-4 px-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Fulfillment Status</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Track the fulfillment progress for each item in this request.
                                </p>
                                <div className="overflow-auto rounded-lg border">
                                    <Table>
                                        <TableHeader><TableRow className="bg-muted hover:bg-muted"><TableHead>Item</TableHead><TableHead className="text-center">Total Qty</TableHead><TableHead className="text-center">Rcvd Qty</TableHead><TableHead className="text-center">Outstanding</TableHead><TableHead>Lead Time (days)</TableHead><TableHead>Status</TableHead><TableHead>Comments</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {request.items.map((item) => (
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
                    <TabsContent value="communication" className="pt-6 px-6">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                {request.comments?.map((comment, i) => (
                                    <div key={i} className="flex items-start gap-3"><Avatar><AvatarFallback>{comment.actor.charAt(0)}</AvatarFallback></Avatar><div className="flex-1 p-3 rounded-lg bg-muted"><div className="flex justify-between items-center"><p className="font-semibold">{comment.actor}</p><p className="text-xs text-muted-foreground">{comment.timestamp}</p></div><p className="text-sm mt-1">{comment.text}</p></div></div>
                                ))}
                                {(!request.comments || request.comments?.length === 0) && (<p className="text-sm text-center text-muted-foreground py-4">No comments on this request yet.</p>)}
                            </div>
                            <div className="relative">
                                <Textarea placeholder="Respond to queries or add a comment..." className="pr-24" value={newComment} onChange={(e) => setNewComment(e.target.value)}/><div className="absolute top-2 right-2 flex items-center gap-1"><Button variant="ghost" size="icon"><Paperclip className="h-4 w-4"/></Button><Button size="icon" onClick={handleAddComment} disabled={isSubmittingAction}><Send className="h-4 w-4"/></Button></div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
                {(showFooterActions || showExportAction) && (
                    <CardFooter className="flex justify-end gap-2 border-t pt-6">
                        {showExportAction && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" className="mr-auto"><Download className="mr-2 h-4 w-4"/>Export Report</Button></DropdownMenuTrigger>
                                <DropdownMenuContent><DropdownMenuItem onClick={() => generateApprovalReport(request, { operationalSummary, capitalSummary }, 'xlsx', auditLogs, companies, appMetadata)}>Export as Excel (.xlsx)</DropdownMenuItem><DropdownMenuItem onClick={() => generateApprovalReport(request, { operationalSummary, capitalSummary }, 'pdf', auditLogs, companies, appMetadata)}>Export as PDF (.pdf)</DropdownMenuItem></DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {showFooterActions && (<>
                            {canComplete && (
                                <Button onClick={handleMarkComplete} disabled={isSubmittingAction}>
                                    {isSubmittingAction && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                                    <Check className="mr-2 h-4 w-4" />Mark as Complete
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => setIsQueryDialogOpen(true)} disabled={isSubmittingAction || !canRejectOrQuery}><MessageSquare className="mr-2 h-4 w-4" />Raise Query</Button>
                            <Button variant="destructive" onClick={handleReject} disabled={isSubmittingAction || !canRejectOrQuery}><X className="mr-2 h-4 w-4" />Reject</Button>
                            <Button onClick={handleApprove} disabled={isSubmittingAction || !canApprove}>{isSubmittingAction && <Loader className="mr-2 h-4 w-4 animate-spin"/>}<Check className="mr-2 h-4 w-4" />{(role === 'Procurement Officer' || role === 'Procurement Assistant') ? 'Acknowledge & Process' : 'Approve'}</Button>
                        </>)}
                    </CardFooter>
                )}
            </Card>
            <Dialog open={isQueryDialogOpen} onOpenChange={setIsQueryDialogOpen}><DialogContent><DialogHeader><DialogTitle>Raise a Query</DialogTitle><DialogDescription>Your query will be added to the communication log and the request status will be updated to 'Queries Raised'.</DialogDescription></DialogHeader><div className="py-4"><Textarea placeholder="Enter your query here. Be specific about what information is needed." value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={5}/></div><DialogFooter><Button variant="outline" onClick={() => { setIsQueryDialogOpen(false); setNewComment(''); }}>Cancel</Button><Button onClick={handleRaiseQuery} disabled={isSubmittingAction}>{isSubmittingAction && <Loader className="mr-2 h-4 w-4 animate-spin"/>}Submit Query</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}><DialogContent><DialogHeader><DialogTitle>Reject Request</DialogTitle><DialogDescription>Please provide a reason for rejecting this request. This will be added to the communication log.</DialogDescription></DialogHeader><div className="py-4"><Textarea placeholder="Enter rejection reason here..." value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={5}/></div><DialogFooter><Button variant="outline" onClick={() => { setIsRejectDialogOpen(false); setNewComment(''); }}>Cancel</Button><Button variant="destructive" onClick={handleConfirmReject} disabled={isSubmittingAction}>{isSubmittingAction && <Loader className="mr-2 h-4 w-4 animate-spin"/>}Confirm Rejection</Button></DialogFooter></DialogContent></Dialog>
        </>
    )
}

export default function ApprovalsPage() {
    const { user, profile, loading: userLoading, role, departmentId: userDepartmentId, reportingDepartments } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { roles, loading: rolesLoading } = useRoles();

    const [viewMode, setViewMode] = useState<'list' | 'tile'>('list');
    const [monthFilter, setMonthFilter] = useState<string>('All Months');

    const requestsQuery = useMemo(() => {
        if (!firestore || !role || !profile) return null;
    
        const baseQuery = collection(firestore, 'procurementRequests');
    
        if (role === 'Administrator') {
            return query(baseQuery, where('status', 'not-in', ['Draft', 'Archived']));
        }
        if (role === 'Executive') {
            const statuses = ['Pending Executive', 'Pending Manager Approval', 'Approved', 'Queries Raised', 'In Fulfillment', 'Completed'];
            if (reportingDepartments && reportingDepartments.length > 0) {
                return query(
                    baseQuery,
                    where('status', 'in', statuses),
                    where('departmentId', 'in', reportingDepartments)
                );
            }
            return query(baseQuery, where('status', 'in', statuses));
        }
        if (role === 'Manager') {
            if (!userDepartmentId) return null;
            return query(baseQuery, where('departmentId', '==', userDepartmentId), where('status', 'not-in', ['Draft', 'Archived']));
        }
        if (role === 'Procurement Officer' || role === 'Procurement Assistant') {
            return query(baseQuery, where('status', 'in', ['Approved', 'In Fulfillment', 'Completed']));
        }
        if (role === 'Requester') {
            if (!userDepartmentId) return null;
            return query(baseQuery, where('departmentId', '==', userDepartmentId), where('status', 'not-in', ['Draft', 'Archived']));
        }
    
        return null;
    }, [firestore, role, userDepartmentId, profile, reportingDepartments]);

    const { data: approvals, loading: approvalsLoading } = useCollection<ApprovalRequest>(requestsQuery);
    
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const usersQuery = useMemo(() => collection(firestore, 'users'), [firestore]);
    const { data: allUsers, loading: usersLoading } = useCollection<UserProfile>(usersQuery);

    const approvalGroupsQuery = useMemo(() => collection(firestore, 'approvalGroups'), [firestore]);
    const { data: approvalGroups, loading: groupsLoading } = useCollection<ApprovalGroup>(approvalGroupsQuery);
    
    const companiesQuery = useMemo(() => collection(firestore, 'companies'), [firestore]);
    const { data: companies } = useCollection<Company>(companiesQuery);

    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata } = useDoc<AppMetadata>(appMetadataRef);

    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    
    const availableMonths = useMemo(() => {
        if (!approvals) return [];
        const months = new Set(approvals.map(req => req.period));
        return ['All Months', ...Array.from(months).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())];
    }, [approvals]);

    useEffect(() => {
        const currentMonth = format(new Date(), 'MMMM yyyy');
        if (availableMonths.includes(currentMonth)) {
            setMonthFilter(currentMonth);
        } else if (availableMonths.length > 1) {
            setMonthFilter('All Months');
        }
    }, [availableMonths]);

    const filteredRequests = useMemo(() => {
        if (!approvals) return [];
        let requests = approvals;
        const statusFilter = searchParams.get('status');
        const emergencyFilter = searchParams.get('emergency');
        if (statusFilter) {
            requests = requests.filter(req => req.status === decodeURIComponent(statusFilter));
        }
        if (emergencyFilter === 'true') {
            requests = requests.filter(req => req.isEmergency);
        }
        if (monthFilter && monthFilter !== 'All Months') {
            requests = requests.filter(req => req.period === monthFilter);
        }
        return requests;
    }, [approvals, searchParams, monthFilter]);

    const activeRequest = useMemo(() => approvals?.find((req) => req.id === selectedRequestId), [selectedRequestId, approvals]);
    
    const loading = userLoading || approvalsLoading || rolesLoading || deptsLoading || usersLoading || groupsLoading;

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
    
    const approvalSummary = useMemo(() => {
        if (!filteredRequests) return { pendingCount: 0, totalValue: 0, byDept: [] };
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
    
    if (loading || !user || !role || !profile || !allUsers || !departments || !approvalGroups) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
  return (
    <>
        <div className="flex justify-between items-center mb-4 gap-4">
            <div className="flex items-center gap-2">
                <Label htmlFor="month-filter">Filter by Month:</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger id="month-filter" className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {availableMonths.map(month => (
                            <SelectItem key={month} value={month}>{month}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View:</span>
                <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="gap-2">
                    <List className="h-4 w-4"/> List
                </Button>
                <Button variant={viewMode === 'tile' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('tile')} className="gap-2">
                    <LayoutGrid className="h-4 w-4"/> Tile
                </Button>
            </div>
        </div>

        {viewMode === 'list' ? (
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle>Approvals Overview</CardTitle><CardDescription>Summary of requests for the selected period.</CardDescription></CardHeader>
                        <CardContent><div className="space-y-4"><div className="flex justify-between items-center"><span className="text-muted-foreground">Pending Requests</span><span className="font-bold text-lg">{approvalSummary.pendingCount}</span></div><div className="flex justify-between items-center"><span className="text-muted-foreground">Total Value</span><span className="font-bold text-lg">{formatCurrency(approvalSummary.totalValue)}</span></div><div className="space-y-2 pt-2"><h4 className="text-sm font-medium">By Department</h4>{approvalSummary.byDept.length > 0 ? (<div className="space-y-1 text-sm text-muted-foreground">{approvalSummary.byDept.map(([dept, data]) => (<div key={dept} className="flex justify-between"><span>{dept}</span><span className="font-mono text-foreground font-semibold">{data.count} ({formatCurrency(data.total)})</span></div>))}</div>) : (<p className="text-sm text-muted-foreground text-center py-2">No pending requests.</p>)}</div></div></CardContent>
                    </Card>
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">All Requests</h3>
                        <Accordion type="multiple" className="w-full space-y-2" defaultValue={departmentOrder}>
                            {departmentOrder.map(dept => (<AccordionItem value={dept} key={dept} className="border-0 rounded-lg bg-muted/50"><AccordionTrigger className="px-3 py-2 hover:no-underline rounded-lg data-[state=open]:bg-muted"><div className="flex justify-between items-center w-full"><span className="font-semibold">{dept}</span><Badge variant="secondary" className="mr-4">{requestsByDept[dept].length}</Badge></div></AccordionTrigger><AccordionContent className="p-2 pt-0"><div className="space-y-2">{requestsByDept[dept].map(req => (<Card key={req.id} className={cn("cursor-pointer transition-colors bg-background", selectedRequestId === req.id ? 'bg-primary/10 border-primary/50' : 'hover:bg-muted/50')} onClick={() => setSelectedRequestId(req.id)}><CardContent className="p-3"><div className="flex justify-between items-start"><p className="font-semibold truncate flex items-center gap-2">{req.isEmergency && <AlertTriangle className="h-4 w-4 text-destructive" />}{req.id}</p>{getStatusBadge(req.status)}</div><div className="flex justify-between items-end mt-2"><div><p className="text-xs text-muted-foreground">{req.period}</p><p className="text-lg font-bold">{formatCurrency(req.total)}</p></div><p className="text-xs text-muted-foreground">By: {req.submittedBy || 'N/A'}</p></div></CardContent></Card>))}</div></AccordionContent></AccordionItem>))}
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
                                            <h3 className="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2">
                                                {activeRequest.isEmergency && <AlertTriangle className="h-5 w-5 text-destructive" />}
                                                Request: {activeRequest.id}
                                            </h3>
                                            <p className="text-sm text-muted-foreground mt-1.5">{activeRequest.companyName ? `${activeRequest.companyName} • ` : ''}{activeRequest.period} &bull; {activeRequest.department} &bull; Submitted by {activeRequest.submittedBy || 'N/A'}</p>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <RequestDetailsView request={activeRequest} user={user} profile={profile} role={role} allUsers={allUsers} departments={departments} approvalGroups={approvalGroups} companies={companies} appMetadata={appMetadata} />
                                    </AccordionContent>
                                </Card>
                            </AccordionItem>
                        </Accordion>
                    ) : (
                        <Card><CardContent className="p-12 flex justify-center items-center h-full min-h-[300px]">{loading ? <Loader className="h-8 w-8 animate-spin" /> : <p className="text-muted-foreground">Select a request to view its details.</p>}</CardContent></Card>
                    )}
                </div>
            </div>
        ) : (
             <div className="w-full space-y-4">
                <Accordion type="multiple" className="w-full space-y-4">
                    {departmentOrder.map(deptName => {
                        const requestsForDept = requestsByDept[deptName];
                        const deptTotalValue = requestsForDept.reduce((sum, req) => sum + req.total, 0);

                        return (
                            <AccordionItem value={deptName} key={deptName} className="border-0 rounded-lg bg-card shadow-sm">
                                <AccordionTrigger className="p-4 hover:no-underline">
                                    <div className="flex justify-between items-center w-full">
                                        <div className="text-left">
                                            <h3 className="text-lg font-semibold">{deptName}</h3>
                                            <p className="text-sm text-muted-foreground">{requestsForDept.length} pending request(s)</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-bold">{formatCurrency(deptTotalValue)}</p>
                                            <p className="text-sm text-muted-foreground">Total Value</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 border-t">
                                    <Accordion type="single" collapsible className="w-full space-y-2 mt-4">
                                        {requestsForDept.map(req => (
                                            <AccordionItem value={req.id} key={req.id} className="border-0 rounded-lg bg-muted/50">
                                                <AccordionTrigger className="px-3 py-2 hover:no-underline rounded-lg data-[state=open]:bg-muted">
                                                     <div className="flex justify-between items-start w-full">
                                                        <div>
                                                            <p className="font-semibold truncate flex items-center gap-2">
                                                                {req.isEmergency && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                                                {req.id}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground text-left">By: {req.submittedBy || 'N/A'} • {req.period}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            {getStatusBadge(req.status)}
                                                            <p className="text-lg font-bold">{formatCurrency(req.total)}</p>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-2 pt-0">
                                                    <RequestDetailsView request={req} user={user} profile={profile} role={role} allUsers={allUsers} departments={departments} approvalGroups={approvalGroups} companies={companies} appMetadata={appMetadata} />
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
            </div>
        )}
    </>
  );
}
