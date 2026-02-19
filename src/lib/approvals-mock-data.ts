export type ApprovalItem = {
    id: number | string;
    type: "Recurring" | "One-Off";
    description: string;
    category: string;
    qty: number;
    unitPrice: number;
};

export type ApprovalRequest = {
    id: string;
    department: string;
    period: string;
    total: number;
    status: "Pending Executive" | "Completed" | "Queries Raised" | "Pending Manager Approval" | "Approved" | 'Rejected' | 'Draft';
    submittedBy: string;
    timeline: { stage: string; actor: string; date: string | null; status: 'completed' | 'pending' | 'waiting' }[];
    comments: { actor: string; actorId: string; text: string; timestamp: string }[];
    items: ApprovalItem[];
    createdAt?: { seconds: number, nanoseconds: number };
};
