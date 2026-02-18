
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { capitalData as initialCapitalData, cashExpensesData as initialCashExpensesData } from "@/lib/summary-mock-data";
import { Input } from "@/components/ui/input";

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

    // State for editable data
    const [cashExpenses, setCashExpenses] = useState(initialCashExpensesData);
    const [capital, setCapital] = useState(initialCapitalData);
    const [currentPeriod, setCurrentPeriod] = useState('May');


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

    const handleCashCommentChange = (index: number, value: string) => {
        const updatedData = [...cashExpenses];
        updatedData[index].comments = value;
        setCashExpenses(updatedData);
    };

    const handleCapitalCommentChange = (index: number, value: string) => {
        const updatedData = [...capital];
        updatedData[index].comments = value;
        setCapital(updatedData);
    };
    
    const subtotalProcurement = cashExpenses.reduce((sum, item) => sum + item.procurement, 0);
    const subtotalForecast = cashExpenses.reduce((sum, item) => sum + item.forecast, 0);
    const subtotalVsForecast = subtotalProcurement - subtotalForecast;

  return (
    <div className="space-y-8">
       <Card>
        <CardHeader>
            <CardTitle>Procurement Line Items</CardTitle>
            <CardDescription>Comparison of {currentPeriod} procurement against forecast for cash expenses. Over-budget items are highlighted.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px]">Item</TableHead>
                            <TableHead className="text-right">{currentPeriod} Procurement</TableHead>
                            <TableHead className="text-right">{currentPeriod} Forecast</TableHead>
                            <TableHead className="text-right">Procurement vs Forecast</TableHead>
                            <TableHead>Comments</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cashExpenses.map((item, index) => {
                            const vsForecast = item.procurement - item.forecast;
                            const isOverBudget = vsForecast > 0;
                            return (
                                <TableRow key={item.item} className={isOverBudget ? "bg-red-500/10" : ""}>
                                    <TableCell className="font-medium">{item.item}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(item.procurement)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(item.forecast)}</TableCell>
                                    <TableCell className={`text-right font-mono ${isOverBudget ? 'text-red-500' : ''}`}>
                                        {formatCurrency(vsForecast)}
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            value={item.comments} 
                                            onChange={(e) => handleCashCommentChange(index, e.target.value)}
                                            className="bg-transparent border-0 h-auto p-0 text-xs text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                                        />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                    <TableRow className="font-bold bg-muted/50">
                        <TableHead>Subtotal cash expenses</TableHead>
                        <TableHead className="text-right font-mono">{formatCurrency(subtotalProcurement)}</TableHead>
                        <TableHead className="text-right font-mono">{formatCurrency(subtotalForecast)}</TableHead>
                        <TableHead className={`text-right font-mono ${subtotalVsForecast > 0 ? 'text-red-500' : ''}`}>
                            {formatCurrency(subtotalVsForecast)}
                        </TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </Table>
            </div>
        </CardContent>
       </Card>

       <Card>
        <CardHeader>
            <CardTitle>Capital</CardTitle>
            <CardDescription>Capital expenditure summary including forecasts and budget comparisons.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[250px]">Item</TableHead>
                            <TableHead className="text-right">{currentPeriod} Procurement</TableHead>
                            <TableHead className="text-right">July Forecast</TableHead>
                            <TableHead className="text-right">Year Total</TableHead>
                            <TableHead className="text-right">Multiplier</TableHead>
                            <TableHead className="text-right">Act+F vs Budget</TableHead>
                            <TableHead className="text-right">Act+F vs Budget YR</TableHead>
                            <TableHead className="text-right">vs Budget YR %</TableHead>
                            <TableHead>Comments</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {capital.map((item, index) => (
                            <TableRow key={item.item}>
                                <TableCell className="font-medium">{item.item}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.procurement)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.julyForecast)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.yearTotal)}</TableCell>
                                <TableCell className="text-right font-mono">{item.yearTotalMultiplier?.toFixed(4) ?? ''}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.actForecastVsBudget)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.actForecastVsBudgetYR)}</TableCell>
                                <TableCell className={`text-right font-mono ${item.vsBudget < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    {formatPercentage(item.vsBudget)}
                                </TableCell>
                                <TableCell>
                                    <Input 
                                        value={item.comments} 
                                        onChange={(e) => handleCapitalCommentChange(index, e.target.value)}
                                        className="bg-transparent border-0 h-auto p-0 text-xs text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
       </Card>
    </div>
  );
}
