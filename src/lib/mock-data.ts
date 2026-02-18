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
