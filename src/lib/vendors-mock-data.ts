export type Vendor = {
    id: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    category: string;
    status: 'Active' | 'Inactive';
};

export const mockVendors: Vendor[] = [
    { 
        id: 'ven-1', 
        name: 'DataCentrix', 
        contactPerson: 'John Doe', 
        email: 'john.d@datacentrix.co.za', 
        phone: '011 555 1234', 
        category: 'IT Services', 
        status: 'Active' 
    },
    { 
        id: 'ven-2', 
        name: 'Dell Technologies', 
        contactPerson: 'Jane Smith', 
        email: 'jane.s@dell.com', 
        phone: '011 555 5678', 
        category: 'IT Hardware', 
        status: 'Active' 
    },
    { 
        id: 'ven-3', 
        name: 'Waltons', 
        contactPerson: 'Peter Jones', 
        email: 'peter.j@waltons.co.za', 
        phone: '021 555 8765', 
        category: 'Office Supplies', 
        status: 'Active' 
    },
     { 
        id: 'ven-4', 
        name: 'Vox Telecom', 
        contactPerson: 'Susan Miller', 
        email: 'susan.m@voxtelecom.co.za', 
        phone: '087 805 0000', 
        category: 'Connectivity', 
        status: 'Inactive' 
    },
];
