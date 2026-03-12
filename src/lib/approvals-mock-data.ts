export type ApprovalItem = {
    id: number | string;
    type: "Recurring" | "One-Off";
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
    submittedBy: string;
    submittedById: string;
    timeline: {
        stage: string;
        actor: string;
        date: string | null;
        status: 'completed' | 'pending' | 'waiting' | 'rejected';
        delegatedById?: string;
        delegatedByName?: string;
    }[];
    comments: { actor: string; actorId: string; text: string; timestamp: string }[];
    items: ApprovalItem[];
    createdAt?: { seconds: number, nanoseconds: number };
    updatedAt?: { seconds: number, nanoseconds: number };
};
