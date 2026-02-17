import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Wand2 } from "lucide-react";
import { FulfillmentClient } from "@/components/app/fulfillment-client";


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

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Sourcing': return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{status}</Badge>;
        case 'Quoted': return <Badge variant="outline" className="bg-blue-100 text-blue-800">{status}</Badge>;
        case 'Ordered': return <Badge variant="outline" className="bg-purple-100 text-purple-800">{status}</Badge>;
        case 'Completed': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">{status}</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>
    }
}

export default function FulfillmentPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Procurement Fulfillment</CardTitle>
        <p className="text-sm text-muted-foreground">
            Track and manage all outstanding procurement items from approval to completion.
        </p>
      </CardHeader>
      <CardContent>
        <FulfillmentClient items={fulfillmentItems} />
      </CardContent>
    </Card>
  );
}
