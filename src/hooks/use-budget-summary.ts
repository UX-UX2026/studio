'use client';

import { useMemo } from 'react';

// Using a simplified Item type that only includes what's needed for the summary
type Item = {
    qty: number;
    category: string;
    unitPrice: number;
    comments?: string;
};

type BudgetItem = {
    id: string;
    departmentId: string;
    category: string;
    forecasts: number[];
    yearTotal: number;
};

type Department = {
    id: string;
    name: string;
    budgetHeaders?: string[];
    budgetYear?: number;
};

export function useBudgetSummary(
    procurementItems: Item[],
    selectedDepartmentId: string,
    selectedPeriod: string,
    budgetItems: BudgetItem[] | null,
    departments: Department[] | null
) {
    return useMemo(() => {
        if (!selectedDepartmentId || !selectedPeriod || !budgetItems || !departments) {
            return { lines: [], totals: { procurement: 0, forecast: 0, variance: 0 } };
        }

        const selectedDept = departments.find(d => d.id === selectedDepartmentId);
        const procurementYear = new Date(selectedPeriod).getFullYear();
        
        const monthName = selectedPeriod.split(' ')[0];
        const monthIndex = (selectedDept?.budgetYear === procurementYear)
            ? selectedDept?.budgetHeaders?.findIndex(h => h.toLowerCase().startsWith(monthName.toLowerCase().substring(0,3))) ?? -1
            : -1;

        const allCategories = new Set([
            ...procurementItems.map(item => item.category),
            ...budgetItems.map(item => item.category)
        ]);

        const lines = Array.from(allCategories).map(category => {
            if (!category) return null;

            const procurementTotal = procurementItems
                .filter(item => item.category === category)
                .reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

            const budgetItem = budgetItems.find(item => item.category === category);
            const forecastTotal = (budgetItem && monthIndex !== -1 && budgetItem.forecasts.length > monthIndex)
                ? budgetItem.forecasts[monthIndex]
                : 0;

            const variance = procurementTotal - forecastTotal;
            const isOverBudget = forecastTotal > 0 && procurementTotal > forecastTotal;

            const comments = procurementItems
                .filter(item => item.category === category && item.comments)
                .map(item => item.comments)
                .join('; ');

            return { category, procurementTotal, forecastTotal, variance, isOverBudget, comments };
        }).filter(Boolean) as { category: string; procurementTotal: number; forecastTotal: number; variance: number; isOverBudget: boolean; comments: string; }[];
        
        const totals = lines.reduce((acc, line) => {
            acc.procurement += line.procurementTotal;
            acc.forecast += line.forecastTotal;
            acc.variance += line.variance;
            return acc;
        }, { procurement: 0, forecast: 0, variance: 0 });

        return { lines, totals };
    }, [procurementItems, selectedDepartmentId, selectedPeriod, budgetItems, departments]);
}
