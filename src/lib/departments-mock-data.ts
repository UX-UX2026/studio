export type Department = {
    id: string;
    name: string;
    managerId: string | null;
    budget: number;
};

export const mockDepartments: Department[] = [
    { id: '1', name: 'Executive', managerId: '1', budget: 500000 },
    { id: '2', name: 'Marketing', managerId: '2', budget: 250000 },
    { id: '3', name: 'Procurement', managerId: '3', budget: 100000 },
    { id: '4', name: 'Administration', managerId: '4', budget: 75000 },
    { id: '5', name: 'ICT', managerId: null, budget: 300000 },
    { id: '6', name: 'HR', managerId: null, budget: 150000 },
    { id: '7', name: 'Operations', managerId: null, budget: 400000 },
];
