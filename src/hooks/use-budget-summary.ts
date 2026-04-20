
'use client';

import { useMemo } from 'react';
import type { BudgetItem, ApprovalItem, Department } from '@/types';

export function useBudgetSummary(
    procurementItems: ApprovalItem[],
    selectedDepartmentId: string,
    selectedPeriod: string,
    budgetItems: BudgetItem[] | null,
    departments: Department[] | null
) {
    return useMemo(() => {
        const emptySummary = { lines: [], totals: { procurement: 0, forecast: 0, variance: 0 } };
        if (!selectedDepartmentId || !selectedPeriod || !budgetItems || !departments) {
            return { operationalSummary: emptySummary, capitalSummary: emptySummary };
        }

        const selectedDept = departments.find(d => d.id === selectedDepartmentId);
        const procurementYear = new Date(selectedPeriod).getFullYear();
        
        const monthName = selectedPeriod.split(' ')[0];
        const monthIndex = (selectedDept?.budgetYear === procurementYear)
            ? selectedDept?.budgetHeaders?.findIndex(h => h.toLowerCase().startsWith(monthName.toLowerCase().substring(0,3))) ?? -1
            : -1;

        const calculateSummary = (itemsToSummarize: ApprovalItem[], expenseType: 'Operational' | 'Capital') => {
            const budgetItemsForType = budgetItems.filter(bi => bi.expenseType === expenseType);

            const allCategories = new Set([
                ...itemsToSummarize.map(item => item.category),
                ...budgetItemsForType.map(item => item.category)
            ]);

            const lines = Array.from(allCategories).map(category => {
                if (!category) return null;

                const itemsForCategory = itemsToSummarize.filter(item => item.category === category);
                const procurementTotal = itemsForCategory.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
                
                const budgetItem = budgetItemsForType.find(item => item.category === category);
                const forecastTotal = (budgetItem && monthIndex !== -1 && budgetItem.forecasts.length > monthIndex)
                    ? budgetItem.forecasts[monthIndex]
                    : 0;
                
                const variance = procurementTotal - forecastTotal;
                const isOverBudget = procurementTotal > forecastTotal;
                const comments = itemsForCategory.filter(item => item.comments).map(item => item.comments).join('; ');

                return { category, procurementTotal, forecastTotal, variance, isOverBudget, comments, items: itemsForCategory };
            }).filter(Boolean) as { category: string; procurementTotal: number; forecastTotal: number; variance: number; isOverBudget: boolean; comments: string; items: ApprovalItem[] }[];
            
            const totals = lines.reduce((acc, line) => {
                acc.procurement += line.procurementTotal;
                acc.forecast += line.forecastTotal;
                acc.variance += line.variance;
                return acc;
            }, { procurement: 0, forecast: 0, variance: 0 });

            return { lines, totals };
        };
        
        const operationalItems = procurementItems.filter(item => item.expenseType === 'Operational' || !item.expenseType);
        const capitalItems = procurementItems.filter(item => item.expenseType === 'Capital');

        const operationalSummary = calculateSummary(operationalItems, 'Operational');
        const capitalSummary = calculateSummary(capitalItems, 'Capital');

        return { operationalSummary, capitalSummary };

    }, [procurementItems, selectedDepartmentId, selectedPeriod, budgetItems, departments]);
}

    