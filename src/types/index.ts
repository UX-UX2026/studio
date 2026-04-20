import type { UserRole } from '@/firebase/auth/use-user';

export type ApprovalItem = {
    id: number | string;
    type: "Recurring" | "One-Off";
    expenseType: 'Operational' | 'Capital';
    description: string;
    category: string;
    brand: string;
    qty: number;
    unitPrice: number;
    fulfillmentStatus: 'Pending' | 'Sourcing' | 'Quoted' | 'Ordered' | 'Completed';
    receivedQty: number;
    fulfillmentComments: string[];
    estimatedLeadTimeDays?: number;
    comments?: string;
    addedById?: string;
    addedByName?: string;
};

export type ApprovalRequest = {
    id: string;
    department: string;
    departmentId: string;
    period: string;
    total: number;
    status: "Pending Executive" | "Completed" | "Queries Raised" | "Pending Manager Approval" | "Approved" | 'Rejected' | 'Draft' | 'In Fulfillment' | 'Archived';
    isEmergency?: boolean;
    emergencyJustification?: string;
    submittedBy: string;
    submittedById: string;
    companyId?: string;
    companyName?: string;
    timeline: {
        stage: string;
        actor: string;
        actorId?: string;
        date: string | null;
        status: 'completed' | 'pending' | 'waiting' | 'rejected';
        delegatedById?: string;
        delegatedByName?: string;
        fingerprint?: string;
    }[];
    comments: { actor: string; actorId: string; text: string; timestamp: string }[];
    items: ApprovalItem[];
    createdAt?: { seconds: number, nanoseconds: number };
    updatedAt?: { seconds: number, nanoseconds: number };
};

export type RecurringItem = {
    id: string;
    category: string;
    name: string;
    amount: number;
    expenseType: 'Operational' | 'Capital';
    nextLoad: string;
    active: boolean;
    frequency: string;
    departmentId: string | null;
    departmentName: string | null;
};

export type BudgetItem = {
    id: string;
    budgetUploadId: string;
    departmentId: string;
    departmentName: string;
    category: string;
    expenseType: 'Operational' | 'Capital';
    forecasts: number[];
    yearTotal: number;
};

export type WorkflowStage = {
    id: string;
    name: string;
    role?: UserRole;
    approvalGroupId?: string;
    approvalGroupName?: string;
    permissions: string[];
    useAlternateEmail?: boolean;
    alternateEmail?: string;
    sendToBoth?: boolean;
};

export type Department = {
  id: string;
  name: string;
  managerId?: string | null;
  budget?: number;
  workflow?: WorkflowStage[];
  budgetHeaders?: string[];
  budgetYear?: number;
  periodSettings?: {
      [period: string]: {
          status: 'Open' | 'Locked';
      }
  };
  companyIds?: string[];
};

export type Company = {
    id: string;
    name: string;
    logoUrl?: string;
};

export type AuditEvent = {
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

export type PdfSettings = {
    primaryColor?: string;
};

export type SecuritySettings = {
    autoLogoutEnabled?: boolean;
    inactivityTimeoutMinutes?: number;
};

export type OdooConfig = {
    url?: string;
    db?: string;
    username?: string;
    apiKey?: string;
    purchaseOrderModel?: string;
    vendorBillModel?: string;
    vendorModel?: string;
};

export type QuickBooksConfig = {
    clientId?: string;
    clientSecret?: string;
    realmId?: string;
};

export type XeroConfig = {
    clientId?: string;
    clientSecret?: string;
    tenantId?: string;
};

export type SageConfig = {
    clientId?: string;
    clientSecret?: string;
};

export type AppMetadata = {
    id: string;
    adminIsSetUp?: boolean;
    limitToOneSubmissionPerPeriod?: boolean;
    pdfSettings?: PdfSettings;
    reminderSettings?: {
        frequency: 'daily' | 'weekly' | 'off';
        lastSent?: { seconds: number, nanoseconds: number };
    };
    securitySettings?: SecuritySettings;
    odooConfig?: OdooConfig;
    quickbooksConfig?: QuickBooksConfig;
    xeroConfig?: XeroConfig;
    sageConfig?: SageConfig;
    accountingPlatform?: 'odoo' | 'quickbooks' | 'xero' | 'sage';
};

export type BudgetUpload = {
    id: string;
    departmentId: string;
    departmentName: string;
    financialYear: number;
    uploadedAt: { seconds: number, nanoseconds: number };
    uploadedById: string;
    uploadedByName: string;
    monthHeaders: string[];
    isActive: boolean;
    uploadType: 'Operational' | 'Capital';
};

export type ApprovalGroup = {
    id: string;
    name: string;
    memberIds: string[];
};

export type Vendor = {
    id: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    category: string;
    status: 'Active' | 'Inactive';
};

export type UserProfileData = {
    id: string;
    displayName: string;
    email: string;
    photoURL?: string;
    role: string;
};