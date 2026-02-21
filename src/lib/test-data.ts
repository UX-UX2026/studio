import type { ApprovalRequest } from './approvals-mock-data';

export const testUsers: { displayName: string; email: string; role: string; department: string; status: 'Active' | 'Invited' }[] = [];

export const testProcurementRequests: Omit<ApprovalRequest, 'id' | 'createdAt'>[] = [];
