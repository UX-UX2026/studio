import type { ApprovalRequest } from './approvals-mock-data';

export const testUsers = [
    { displayName: 'Heinrich', email: 'heinrich@ubuntux.co.za', role: 'Administrator', department: 'Executive', status: 'Active' as const },
    { displayName: 'Manager Mike', email: 'manager.mike@procurportal.local', role: 'Manager', department: 'ICT', status: 'Active' as const },
    { displayName: 'Executive Eve', email: 'executive.eve@procurportal.local', role: 'Executive', department: 'Executive', status: 'Active' as const },
    { displayName: 'Procurement Pete', email: 'procurement.pete@procurportal.local', role: 'Procurement Officer', department: 'Finance', status: 'Active' as const },
    { displayName: 'Requester Ray', email: 'requester.ray@procurportal.local', role: 'Requester', department: 'Marketing', status: 'Active' as const },
    { displayName: 'Assistant Amy', email: 'assistant.amy@procurportal.local', role: 'Procurement Assistant', department: 'Finance', status: 'Active' as const },
    { displayName: 'Admin User', email: 'admin@procurportal.local', role: 'Administrator', department: 'Executive', status: 'Active' as const },
    { displayName: 'Procurement Assistant User', email: 'proca@procurportal.com', role: 'Procurement Assistant', department: 'Finance', status: 'Active' as const },
    { displayName: 'Procurement Officer User', email: 'proc@procurportal.com', role: 'Procurement Officer', department: 'Finance', status: 'Active' as const },
    { displayName: 'Executive User', email: 'ex@procurportal.com', role: 'Executive', department: 'Executive', status: 'Active' as const },
    { displayName: 'Manager User', email: 'man@procurportal.com', role: 'Manager', department: 'Operations', status: 'Active' as const },
];

export const testProcurementRequests: Omit<ApprovalRequest, 'id' | 'createdAt'>[] = [
    {
        department: 'ICT',
        departmentId: '',
        period: 'Feb 2026',
        total: 7500,
        status: 'Pending Manager Approval',
        submittedBy: 'Requester Ray',
        submittedById: '',
        timeline: [
            { stage: 'Request Submission', actor: 'Requester Ray', date: '01 Feb 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Manager Mike', date: null, status: 'pending' },
            { stage: 'Executive Review', actor: 'Executive Eve', date: null, status: 'waiting' },
            { stage: 'Procurement Ack.', actor: 'Procurement Pete', date: null, status: 'waiting' },
        ],
        comments: [
            { actor: 'Requester Ray', actorId: '', text: 'Please prioritize this, we need it for the new project.', timestamp: '01 Feb 2026, 10:00' }
        ],
        items: [
            { id: 1, type: 'One-Off', description: '10ft Ethernet Cables', brand: 'CableCorp', qty: 50, category: 'Hardware Purchase', unitPrice: 150, fulfillmentStatus: 'Pending', receivedQty: 0, fulfillmentComments: [] },
        ]
    },
    {
        department: 'Marketing',
        departmentId: '',
        period: 'Feb 2026',
        total: 125000,
        status: 'Approved',
        submittedBy: 'Requester Ray',
        submittedById: '',
        timeline: [
            { stage: 'Request Submission', actor: 'Requester Ray', date: '28 Jan 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Manager Mike', date: '29 Jan 2026', status: 'completed' },
            { stage: 'Executive Review', actor: 'Executive Eve', date: '30 Jan 2026', status: 'completed' },
            { stage: 'Procurement Ack.', actor: 'Procurement Pete', date: null, status: 'pending' },
        ],
        comments: [],
        items: [
            { id: 2, type: 'One-Off', description: 'Social Media Campaign Boost', brand: 'Meta', qty: 1, category: 'Consulting Services', unitPrice: 125000, fulfillmentStatus: 'Pending', receivedQty: 0, fulfillmentComments: [] },
        ]
    },
    {
        department: 'Operations',
        departmentId: '',
        period: 'Jan 2026',
        total: 45000,
        status: 'In Fulfillment',
        submittedBy: 'Manager Mike',
        submittedById: '',
        timeline: [
            { stage: 'Request Submission', actor: 'Manager Mike', date: '15 Jan 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Manager Mike', date: '15 Jan 2026', status: 'completed' },
            { stage: 'Executive Review', actor: 'Executive Eve', date: '16 Jan 2026', status: 'completed' },
            { stage: 'Procurement Ack.', actor: 'Procurement Pete', date: '17 Jan 2026', status: 'completed' },
        ],
        comments: [
            { actor: 'Procurement Pete', actorId: '', text: 'Vendor has been contacted, awaiting quote.', timestamp: '18 Jan 2026, 14:00' }
        ],
        items: [
            { id: 3, type: 'One-Off', description: 'Ergonomic Office Chairs', brand: 'Chairly', qty: 10, category: 'Office Supplies', unitPrice: 4500, fulfillmentStatus: 'Sourcing', receivedQty: 0, fulfillmentComments: ['Initial contact made with vendor.'] },
        ]
    }
];
