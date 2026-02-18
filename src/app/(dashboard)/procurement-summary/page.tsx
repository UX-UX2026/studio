
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { capitalData, cashExpensesData } from "@/lib/summary-mock-data";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

const formatPercentage = (value: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};


export default function ProcurementSummaryPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
      const allowedRoles = ['Administrator', 'Manager', 'Procurement Officer', 'Executive'];
      if (!loading && (!user || !role || !allowedRoles.includes(role))) {
        router.push('/');
      }
    }, [user, role, loading, router]);
    
    if (loading || !user) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const subtotalProcurement = cashExpensesData.reduce((sum, item) => sum + item.procurement, 0);
    const subtotalForecast = cashExpensesData.reduce((sum, item) => sum + item.forecast, 0);
    const subtotalVsForecast = subtotalProcurement - subtotalForecast;

  return (
    <div className="space-y-8">
       <Card>
        <CardHeader>
            <CardTitle>Procurement Line Items</CardTitle>
            <CardDescription>Comparison of May procurement against forecast for cash expenses.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[300px]">Item</TableHead>
                        <TableHead className="text-right">May Procurement</TableHead>
                        <TableHead className="text-right">May Forecast</TableHead>
                        <TableHead className="text-right">Procurement vs Forecast</TableHead>
                        <TableHead>Comments</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cashExpensesData.map(item => {
                        const vsForecast = item.procurement - item.forecast;
                        return (
                            <TableRow key={item.item}>
                                <TableCell className="font-medium">{item.item}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.procurement)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.forecast)}</TableCell>
                                <TableCell className={`text-right font-mono ${vsForecast < 0 ? 'text-red-500' : ''}`}>
                                    {formatCurrency(vsForecast)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.comments}</TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
                <TableRow className="font-bold bg-muted/50">
                    <TableHead>Subtotal cash expenses</TableHead>
                    <TableHead className="text-right font-mono">{formatCurrency(subtotalProcurement)}</TableHead>
                    <TableHead className="text-right font-mono">{formatCurrency(subtotalForecast)}</TableHead>
                    <TableHead className={`text-right font-mono ${subtotalVsForecast < 0 ? 'text-red-500' : ''}`}>
                        {formatCurrency(subtotalVsForecast)}
                    </TableHead>
                    <TableHead></TableHead>
                </TableRow>
            </Table>
        </CardContent>
       </Card>

       <Card>
        <CardHeader>
            <CardTitle>Capital</CardTitle>
            <CardDescription>Capital expenditure summary including forecasts and budget comparisons.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[250px]">Item</TableHead>
                        <TableHead className="text-right">May Procurement</TableHead>
                        <TableHead className="text-right">July Forecast</TableHead>
                        <TableHead className="text-right">Year Total</TableHead>
                        <TableHead className="text-right">Act+Forecast vs Budget YR</TableHead>
                        <TableHead>Comments</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {capitalData.map(item => (
                        <TableRow key={item.item}>
                            <TableCell className="font-medium">{item.item}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(item.procurement)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(item.julyForecast)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(item.yearTotal)}</TableCell>
                            <TableCell className={`text-right font-mono ${item.vsBudget < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                {formatPercentage(item.vsBudget)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.comments}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
       </Card>
    </div>
  );
}

