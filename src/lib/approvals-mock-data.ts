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
    status: "Pending Executive" | "Completed" | "Queries Raised" | "Pending Manager Approval" | "Approved";
    submittedBy: string;
    timeline: { stage: string; actor: string; date: string | null; status: 'completed' | 'pending' | 'waiting' }[];
    comments: { actor: string; avatarId: string; text: string; timestamp: string }[];
    items: ApprovalItem[];
};


export const approvalsData: ApprovalRequest[] = [
  {
    id: "REQ-00126",
    department: "ICT",
    period: "Mar 2026",
    total: 15000.00,
    status: "Pending Manager Approval",
    submittedBy: "Sam J.",
    timeline: [
      { stage: "Request Submission", actor: "Sam J.", date: "01 Mar 2026", status: "completed" },
      { stage: "Manager Review", actor: "Manager User", date: null, status: "pending" },
      { stage: "Executive Review", actor: "Zukiswa N.", date: null, status: "waiting" },
      { stage: "Procurement Ack.", actor: "Linda K.", date: null, status: "waiting" },
    ],
    comments: [],
    items: [
        { id: 9, type: 'One-Off', description: 'New Monitors for Dev Team', category: 'Hardware Purchase', qty: 5, unitPrice: 3000.00 }
    ]
  },
  {
    id: "REQ-00124",
    department: "ICT",
    period: "Feb 2026",
    total: 132178.02,
    status: "Pending Executive",
    submittedBy: "Tarryn M.",
    timeline: [
      { stage: "Manager Sign-off", actor: "Tarryn M.", date: "27 Jan 2026", status: "completed" },
      { stage: "Executive Review", actor: "Zukiswa N.", date: null, status: "pending" },
      { stage: "Procurement Ack.", actor: "Linda K.", date: null, status: "waiting" },
    ],
    comments: [
        {actor: "Zukiswa N.", avatarId: 'avatar-1', text: "Can you please double-check the quote for the Cisco router? Seems a bit high.", timestamp: "2 hours ago"}
    ],
    items: [
        { id: 'rec-1', type: 'Recurring', description: 'DataCentrix MSP', category: 'Tech Support - SA', qty: 1, unitPrice: 48793.50 },
        { id: 'rec-3', type: 'Recurring', description: 'Dell Laptops (29 units)', category: 'Operational Lease/Rental - SA', qty: 1, unitPrice: 19197.02 },
        { id: 3, type: 'One-Off', description: 'Cisco Catalyst Router', category: 'ICT Maintenance - SA', qty: 1, unitPrice: 33677.00 },
        { id: 4, type: 'One-Off', description: 'Additional Sophos Licenses', category: 'Software Licenses', qty: 10, unitPrice: 3051.05 }
    ]
  },
  {
    id: "REQ-00125",
    department: "Operations",
    period: "Feb 2026",
    total: 75000.0,
    status: "Pending Executive",
    submittedBy: "John D.",
    timeline: [
        { stage: "Manager Sign-off", actor: "John D.", date: "28 Jan 2026", status: "completed" },
        { stage: "Executive Review", actor: "Zukiswa N.", date: null, status: "pending" },
        { stage: "Procurement Ack.", actor: "Linda K.", date: null, status: "waiting" },
    ],
    comments: [],
    items: [
        { id: 5, type: 'One-Off', description: 'Ergonomic Office Chairs', category: 'Office Furniture', qty: 15, unitPrice: 5000.00 }
    ]
  },
  {
    id: "REQ-00123",
    department: "Marketing",
    period: "Jan 2026",
    total: 298100.0,
    status: "Completed",
    submittedBy: "Tarryn M.",
    timeline: [
        { stage: "Manager Sign-off", actor: "Tarryn M.", date: "27 Dec 2025", status: "completed" },
        { stage: "Executive Review", actor: "Zukiswa N.", date: "28 Dec 2025", status: "completed" },
        { stage: "Procurement Ack.", actor: "Linda K.", date: "29 Dec 2025", status: "completed" },
    ],
    comments: [],
    items: [
        { id: 6, type: 'One-Off', description: 'Social Media Campaign Boost', category: 'Marketing Spend', qty: 1, unitPrice: 150000.00 },
        { id: 7, type: 'One-Off', description: 'Consulting Services for SEO', category: 'Consulting', qty: 1, unitPrice: 148100.00 }
    ]
  },
    {
    id: "REQ-00122",
    department: "ICT",
    period: "Jan 2026",
    total: 45000.0,
    status: "Approved",
    submittedBy: "Tarryn M.",
    timeline: [
        { stage: "Manager Sign-off", actor: "Tarryn M.", date: "15 Jan 2026", status: "completed" },
        { stage: "Executive Review", actor: "Zukiswa N.", date: "16 Jan 2026", status: "completed" },
        { stage: "Procurement Ack.", actor: "Linda K.", date: null, status: "pending" },
    ],
    comments: [],
    items: [
        { id: 8, type: 'One-Off', description: 'New Server Rack', category: 'Hardware Purchase', qty: 1, unitPrice: 45000.00 }
    ]
  },
];
