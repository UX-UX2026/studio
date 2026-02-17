'use server';
/**
 * @fileOverview A Genkit flow that suggests optimal fulfillment strategies for procurement requests.
 *
 * - recommendFulfillmentStrategy - A function that handles the fulfillment strategy recommendation process.
 * - RecommendFulfillmentStrategyInput - The input type for the recommendFulfillmentStrategy function.
 * - RecommendFulfillmentStrategyOutput - The return type for the recommendFulfillmentStrategy function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecommendFulfillmentStrategyInputSchema = z.object({
  itemName: z.string().describe('The name of the item to be procured.'),
  itemDescription: z.string().describe('A detailed description of the item.'),
  quantity: z.number().int().positive().describe('The quantity of the item requested.'),
  category: z.string().describe('The procurement category of the item (e.g., IT Hardware, Office Supplies, Services).'),
  unitPrice: z.number().optional().describe('The estimated or last known unit price of the item.'),
  department: z.string().describe('The department requesting the item.'),
  historicalPreviousVendors: z.array(z.string()).optional().describe('A list of vendors previously used for similar items.'),
  historicalAverageLeadTimeDays: z.number().int().positive().optional().describe('Average lead time in days for similar past procurements.'),
  historicalAverageCost: z.number().optional().describe('Average cost for similar past procurements.'),
});
export type RecommendFulfillmentStrategyInput = z.infer<typeof RecommendFulfillmentStrategyInputSchema>;

const RecommendFulfillmentStrategyOutputSchema = z.object({
  strategySummary: z.string().describe('A concise summary of the recommended fulfillment strategy.'),
  suggestedVendors: z.array(z.object({
    name: z.string().describe('The name of the suggested vendor.'),
    reasoning: z.string().describe('The reason why this vendor is suggested (e.g., cost, reliability, lead time).'),
  })).describe('A list of potential vendors for the item.'),
  estimatedLeadTimeDays: z.number().int().positive().describe('The estimated lead time in days for procuring the item.'),
  costSavingOptions: z.array(z.string()).describe('A list of potential cost-saving options for this procurement.'),
});
export type RecommendFulfillmentStrategyOutput = z.infer<typeof RecommendFulfillmentStrategyOutputSchema>;

export async function recommendFulfillmentStrategy(input: RecommendFulfillmentStrategyInput): Promise<RecommendFulfillmentStrategyOutput> {
  return recommendFulfillmentStrategyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendFulfillmentStrategyPrompt',
  input: {schema: RecommendFulfillmentStrategyInputSchema},
  output: {schema: RecommendFulfillmentStrategyOutputSchema},
  prompt: `You are an expert procurement officer tasked with recommending optimal fulfillment strategies for a procurement request.
Analyze the provided item details and historical data to suggest suitable vendors, estimated lead times, and cost-saving opportunities.

Item Name: {{{itemName}}}
Item Description: {{{itemDescription}}}
Quantity: {{{quantity}}}
Category: {{{category}}}
Department: {{{department}}}
{{#if unitPrice}}Estimated Unit Price: {{{unitPrice}}}{{/if}}

{{#if historicalPreviousVendors}}
Historical Data:
  Previous Vendors for similar items: {{#each historicalPreviousVendors}}- {{{this}}}
  {{/each}}{{/if}}
{{#if historicalAverageLeadTimeDays}}  Average Lead Time (days) for similar items: {{{historicalAverageLeadTimeDays}}}{{/if}}
{{#if historicalAverageCost}}  Average Cost for similar items: {{{historicalAverageCost}}}{{/if}}
{{#if historicalPreviousVendors}}
Consider these historical insights when formulating your recommendations.
{{/if}}

Please provide:
1. A concise strategy summary.
2. A list of 2-3 suggested vendors with a brief reasoning for each.
3. An estimated lead time in days.
4. A few potential cost-saving options.
`
});

const recommendFulfillmentStrategyFlow = ai.defineFlow(
  {
    name: 'recommendFulfillmentStrategyFlow',
    inputSchema: RecommendFulfillmentStrategyInputSchema,
    outputSchema: RecommendFulfillmentStrategyOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
