export const recurringItems = [
    {
        id: 'rec-1',
        category: 'Tech Support - SA',
        name: 'DataCentrix MSP',
        amount: 48793.50,
        nextLoad: 'March 1st',
        active: true,
        frequency: 'Monthly'
    },
    {
        id: 'rec-2',
        category: 'License Fees - SA',
        name: 'Sophos License renewal',
        amount: 12450.00,
        nextLoad: 'March 1st',
        active: true,
        frequency: 'Annually'
    },
    {
        id: 'rec-3',
        category: 'Operational Lease/Rental - SA',
        name: 'Dell Laptops (29 units)',
        amount: 19197.02,
        nextLoad: 'March 1st',
        active: true,
        frequency: 'Monthly'
    },
    {
        id: 'rec-4',
        category: 'Connectivity - SA',
        name: 'Vox Fibre Line',
        amount: 3500.00,
        nextLoad: 'March 1st',
        active: false,
        frequency: 'Monthly'
    },
];

export const oneOffSubmissionItems = [
  {
    id: 3,
    type: "One-Off" as const,
    description: "Cisco Catalyst Router",
    brand: "Cisco",
    qty: 1,
    category: "ICT Maintenance - SA",
    unitPrice: 33677,
  },
];

export const fulfillmentItems = [
  {
    id: "FUL-001",
    item: "Cisco Catalyst Router",
    department: "ICT",
    qty: 1,
    approvedOn: "2026-02-28",
    outstandingDays: 5,
    status: "Sourcing",
    request: {
        itemName: "Cisco Catalyst Router",
        itemDescription: "High-performance router for core network infrastructure upgrade.",
        quantity: 1,
        category: "ICT Maintenance - SA",
        unitPrice: 33677,
        department: "ICT",
    }
  },
  {
    id: "FUL-002",
    item: "12-Month Zoom Subscription",
    department: "HR",
    qty: 5,
    approvedOn: "2026-02-25",
    outstandingDays: 8,
    status: "Sourcing",
    request: {
        itemName: "12-Month Zoom Subscription",
        itemDescription: "Zoom Pro licenses for new HR team members.",
        quantity: 5,
        category: "Software Licenses",
        department: "HR",
    }
  },
  {
    id: "FUL-003",
    item: "Ergonomic Office Chairs",
    department: "Operations",
    qty: 10,
    approvedOn: "2026-02-20",
    outstandingDays: 13,
    status: "Quoted",
    request: {
        itemName: "Ergonomic Office Chairs",
        itemDescription: "High-back, adjustable ergonomic chairs for the operations team.",
        quantity: 10,
        category: "Office Furniture",
        department: "Operations",
    }
  },
  {
    id: "FUL-004",
    item: "Graphic Design Services",
    department: "Marketing",
    qty: 1,
    approvedOn: "2026-03-01",
    outstandingDays: 4,
    status: "Completed",
    request: {
        itemName: "Graphic Design Services",
        itemDescription: "Freelance graphic designer for new campaign materials.",
        quantity: 1,
        category: "Consulting Services",
        department: "Marketing",
    }
  },
];
