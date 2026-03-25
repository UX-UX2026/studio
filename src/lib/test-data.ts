import type { ApprovalRequest } from './approvals-mock-data';

export const testUsers: { displayName: string; email: string; role: string; department: string; status: 'Active' | 'Invited' }[] = [
    {
        displayName: 'Alice Manager',
        email: 'alice.manager@example.com',
        role: 'Manager',
        department: 'Marketing',
        status: 'Active',
    },
    {
        displayName: 'Bob Requester',
        email: 'bob.requester@example.com',
        role: 'Requester',
        department: 'Marketing',
        status: 'Active',
    },
    {
        displayName: 'Charlie Executive',
        email: 'charlie.executive@example.com',
        role: 'Executive',
        department: 'Executive',
        status: 'Active',
    },
    {
        displayName: 'Diana Procurement',
        email: 'diana.procurement@example.com',
        role: 'Procurement Officer',
        department: 'Finance',
        status: 'Active',
    }
];

export const testProcurementRequests: Omit<ApprovalRequest, 'id' | 'createdAt'>[] = [];
