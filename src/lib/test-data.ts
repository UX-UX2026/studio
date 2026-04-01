import type { ApprovalRequest } from './approvals-mock-data';
import { type UserProfile } from '@/context/authentication-provider';

export const testUsers: (Omit<UserProfile, 'id'> & { id: string; isTestData?: boolean })[] = [
    {
        id: 'user-alice-manager',
        displayName: 'Alice Manager',
        email: 'alice.manager@example.com',
        role: 'Manager',
        department: 'Marketing',
        departmentId: 'dept-mktg',
        status: 'Active',
        photoURL: `https://i.pravatar.cc/150?u=alice.manager@example.com`,
        isTestData: true,
    },
    {
        id: 'user-bob-requester',
        displayName: 'Bob Requester',
        email: 'bob.requester@example.com',
        role: 'Requester',
        department: 'Marketing',
        departmentId: 'dept-mktg',
        status: 'Active',
        photoURL: `https://i.pravatar.cc/150?u=bob.requester@example.com`,
        isTestData: true,
    },
    {
        id: 'user-charlie-executive',
        displayName: 'Charlie Executive',
        email: 'charlie.executive@example.com',
        role: 'Executive',
        department: 'Executive',
        departmentId: 'dept-exec',
        status: 'Active',
        photoURL: `https://i.pravatar.cc/150?u=charlie.executive@example.com`,
        reportingDepartments: ['dept-mktg', 'dept-sales'],
        isTestData: true,
    },
    {
        id: 'user-diana-procurement',
        displayName: 'Diana Procurement',
        email: 'diana.procurement@example.com',
        role: 'Procurement Officer',
        department: 'Finance',
        departmentId: 'dept-fin',
        status: 'Active',
        photoURL: `https://i.pravatar.cc/150?u=diana.procurement@example.com`,
        isTestData: true,
    },
    {
        id: 'user-eve-requester',
        displayName: 'Eve Requester (Sales)',
        email: 'eve.requester@example.com',
        role: 'Requester',
        department: 'Sales',
        departmentId: 'dept-sales',
        status: 'Active',
        photoURL: `https://i.pravatar.cc/150?u=eve.requester@example.com`,
        isTestData: true,
    },
    {
        id: 'user-frank-manager',
        displayName: 'Frank Manager (Sales)',
        email: 'frank.manager@example.com',
        role: 'Manager',
        department: 'Sales',
        departmentId: 'dept-sales',
        status: 'Active',
        photoURL: `https://i.pravatar.cc/150?u=frank.manager@example.com`,
        isTestData: true,
    }
];

export const testProcurementRequests: (Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'> & { isTestData?: boolean })[] = [
    // 1. Simple request from Requester, pending Manager approval
    {
        department: 'Marketing',
        departmentId: 'dept-mktg',
        period: 'August 2026',
        total: 1500,
        status: 'Pending Manager Approval',
        submittedBy: 'Bob Requester',
        submittedById: 'user-bob-requester',
        timeline: [
            { stage: 'Request Submission', actor: 'Bob Requester', date: '01 Aug 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Manager', date: null, status: 'pending' },
            { stage: 'Executive Approval', actor: 'Executive', date: null, status: 'waiting' },
        ],
        comments: [],
        items: [
            { id: 101, type: 'One-Off', expenseType: 'Operational', description: 'Social Media Campaign Boost', category: 'Marketing', brand: 'Meta', qty: 1, unitPrice: 1500, fulfillmentStatus: 'Pending', receivedQty: 0, fulfillmentComments: [] },
        ],
        isTestData: true,
    },
    // 2. Manager submission, bypassing manager approval
    {
        department: 'Marketing',
        departmentId: 'dept-mktg',
        period: 'August 2026',
        total: 45000,
        status: 'Pending Executive',
        submittedBy: 'Alice Manager',
        submittedById: 'user-alice-manager',
        timeline: [
            { stage: 'Request Submission', actor: 'Alice Manager', date: '02 Aug 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Alice Manager', date: '02 Aug 2026', status: 'completed' },
            { stage: 'Executive Approval', actor: 'Executive', date: null, status: 'pending' },
        ],
        comments: [],
        items: [
            { id: 201, type: 'One-Off', expenseType: 'Capital', description: 'New Video Camera for Content Team', category: 'Hardware Purchase', brand: 'Sony', qty: 1, unitPrice: 45000, fulfillmentStatus: 'Pending', receivedQty: 0, fulfillmentComments: [] },
        ],
        isTestData: true,
    },
    // 3. Request with queries
    {
        department: 'Sales',
        departmentId: 'dept-sales',
        period: 'July 2026',
        total: 8000,
        status: 'Queries Raised',
        submittedBy: 'Eve Requester (Sales)',
        submittedById: 'user-eve-requester',
        timeline: [
            { stage: 'Request Submission', actor: 'Eve Requester (Sales)', date: '15 Jul 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Manager', date: null, status: 'pending' },
        ],
        comments: [
            { actor: 'Frank Manager (Sales)', actorId: 'user-frank-manager', text: 'Is this conference essential for this quarter? Please provide justification.', timestamp: '16 Jul 2026' }
        ],
        items: [
            { id: 301, type: 'One-Off', expenseType: 'Operational', description: 'Tickets for Sales Conference', category: 'Staff Travel - SA', brand: 'SalesConf Inc.', qty: 2, unitPrice: 4000, fulfillmentStatus: 'Pending', receivedQty: 0, fulfillmentComments: [] },
        ],
        isTestData: true,
    },
    // 4. Rejected Request
    {
        department: 'Marketing',
        departmentId: 'dept-mktg',
        period: 'June 2026',
        total: 25000,
        status: 'Rejected',
        submittedBy: 'Bob Requester',
        submittedById: 'user-bob-requester',
        timeline: [
            { stage: 'Request Submission', actor: 'Bob Requester', date: '10 Jun 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Alice Manager', date: '11 Jun 2026', status: 'completed' },
            { stage: 'Executive Approval', actor: 'Charlie Executive', date: '12 Jun 2026', status: 'rejected' },
        ],
        comments: [
            { actor: 'Charlie Executive', actorId: 'user-charlie-executive', text: 'REJECTED: This software is not within our current strategic focus. Re-evaluate in the next financial year.', timestamp: '12 Jun 2026' }
        ],
        items: [
            { id: 401, type: 'One-Off', expenseType: 'Capital', description: 'Experimental Analytics Software License', category: 'Software Licenses', brand: 'DataDream', qty: 1, unitPrice: 25000, fulfillmentStatus: 'Pending', receivedQty: 0, fulfillmentComments: [] },
        ],
        isTestData: true,
    },
    // 5. Approved Request, ready for fulfillment
    {
        department: 'Sales',
        departmentId: 'dept-sales',
        period: 'August 2026',
        total: 12000,
        status: 'Approved',
        submittedBy: 'Eve Requester (Sales)',
        submittedById: 'user-eve-requester',
        timeline: [
            { stage: 'Request Submission', actor: 'Eve Requester (Sales)', date: '03 Aug 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Frank Manager (Sales)', date: '04 Aug 2026', status: 'completed' },
            { stage: 'Executive Approval', actor: 'Charlie Executive', date: '05 Aug 2026', status: 'completed' },
            { stage: 'Procurement Processing', actor: 'Procurement', date: null, status: 'pending' },
        ],
        comments: [],
        items: [
            { id: 501, type: 'One-Off', expenseType: 'Operational', description: 'New Laptops for Sales Team (x3)', category: 'IT Hardware', brand: 'Dell', qty: 3, unitPrice: 4000, fulfillmentStatus: 'Pending', receivedQty: 0, fulfillmentComments: [] },
        ],
        isTestData: true,
    },
    // 6. In Fulfillment
    {
        department: 'Marketing',
        departmentId: 'dept-mktg',
        period: 'July 2026',
        total: 5000,
        status: 'In Fulfillment',
        submittedBy: 'Bob Requester',
        submittedById: 'user-bob-requester',
        timeline: [
            { stage: 'Request Submission', actor: 'Bob Requester', date: '05 Jul 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Alice Manager', date: '06 Jul 2026', status: 'completed' },
            { stage: 'Executive Approval', actor: 'Charlie Executive', date: '07 Jul 2026', status: 'completed' },
            { stage: 'Procurement Processing', actor: 'Diana Procurement', date: '08 Jul 2026', status: 'completed' },
            { stage: 'In Fulfillment', actor: 'Procurement', date: null, status: 'pending' },
        ],
        comments: [],
        items: [
            { id: 601, type: 'One-Off', expenseType: 'Operational', description: 'Branded merchandise for event', category: 'Marketing', brand: 'PromoCorp', qty: 500, unitPrice: 10, fulfillmentStatus: 'Sourcing', receivedQty: 0, fulfillmentComments: [] },
        ],
        isTestData: true,
    },
    // 7. Completed Request
    {
        department: 'Sales',
        departmentId: 'dept-sales',
        period: 'June 2026',
        total: 2500,
        status: 'Completed',
        submittedBy: 'Frank Manager (Sales)',
        submittedById: 'user-frank-manager',
        timeline: [
            { stage: 'Request Submission', actor: 'Frank Manager (Sales)', date: '01 Jun 2026', status: 'completed' },
            { stage: 'Manager Review', actor: 'Frank Manager (Sales)', date: '01 Jun 2026', status: 'completed' },
            { stage: 'Executive Approval', actor: 'Charlie Executive', date: '02 Jun 2026', status: 'completed' },
            { stage: 'Procurement Processing', actor: 'Diana Procurement', date: '03 Jun 2026', status: 'completed' },
            { stage: 'In Fulfillment', actor: 'Diana Procurement', date: '10 Jun 2026', status: 'completed' },
            { stage: 'Completed', actor: 'System', date: '10 Jun 2026', status: 'completed' },
        ],
        comments: [],
        items: [
            { id: 701, type: 'One-Off', expenseType: 'Operational', description: 'Office Printer Ink', category: 'Office Supplies', brand: 'HP', qty: 5, unitPrice: 500, fulfillmentStatus: 'Completed', receivedQty: 5, fulfillmentComments: ['Ordered from Takealot, delivered promptly'] },
        ],
        isTestData: true,
    },
    // 8. Draft Request
    {
        department: 'Marketing',
        departmentId: 'dept-mktg',
        period: 'September 2026',
        total: 980,
        status: 'Draft',
        submittedBy: 'Bob Requester',
        submittedById: 'user-bob-requester',
        timeline: [],
        comments: [],
        items: [
            { id: 801, type: 'One-Off', expenseType: 'Operational', description: 'Graphic Design Software Subscription', category: 'Software Licenses', brand: 'Adobe', qty: 1, unitPrice: 980, fulfillmentStatus: 'Pending', receivedQty: 0, fulfillmentComments: [] },
        ],
        isTestData: true,
    },
];
