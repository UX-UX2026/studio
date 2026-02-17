import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, History } from "lucide-react";

const recurringItems = [
    {
        id: 'rec-1',
        category: 'Tech Support - SA',
        name: 'DataCentrix MSP',
        amount: 48793.50,
        nextLoad: 'March 1st',
        active: true,
    },
    {
        id: 'rec-2',
        category: 'License Fees - SA',
        name: 'Sophos License renewal',
        amount: 12450.00,
        nextLoad: 'March 1st',
        active: true,
    },
    {
        id: 'rec-3',
        category: 'Operational Lease/Rental - SA',
        name: 'Dell Laptops (29 units)',
        amount: 19197.02,
        nextLoad: 'March 1st',
        active: true,
    },
    {
        id: 'rec-4',
        category: 'Connectivity - SA',
        name: 'Vox Fibre Line',
        amount: 3500.00,
        nextLoad: 'March 1st',
        active: false,
    },
];

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
};


export default function RecurringPage() {
  return (
    <div className="space-y-6">
       <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-primary">
                <History className="h-6 w-6" />
                Monthly Recurring Master List
            </CardTitle>
            <CardDescription>
                Items defined here are automatically added to every period submission.
            </CardDescription>
          </div>
          <Button className="shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4 mr-2"/>
            New Recurring Item
          </Button>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recurringItems.map(item => (
                    <Card key={item.id} className="flex flex-col justify-between hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-sm font-medium uppercase text-primary tracking-wider">{item.category}</CardTitle>
                                <Switch id={`switch-${item.id}`} checked={item.active} aria-label="Toggle item status"/>
                            </div>
                            <CardDescription className="!mt-2 text-base font-semibold text-foreground">{item.name}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-black">{formatCurrency(item.amount)}</p>
                            <p className="text-xs text-muted-foreground mt-2">Next Auto-Load: {item.nextLoad}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </CardContent>
       </Card>
    </div>
  );
}
