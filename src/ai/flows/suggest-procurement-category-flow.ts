'use server';
/**
 * @fileOverview A Genkit flow that suggests procurement categories based on an item description.
 *
 * - suggestProcurementCategory - A function that handles the category suggestion process.
 * - SuggestProcurementCategoryInput - The input type for the suggestProcurementCategory function.
 * - SuggestProcurementCategoryOutput - The return type for the suggestProcurementCategory function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestProcurementCategoryInputSchema = z.object({
  itemDescription: z.string().describe('The description of the procurement item.').min(1),
});
export type SuggestProcurementCategoryInput = z.infer<typeof SuggestProcurementCategoryInputSchema>;

const SuggestProcurementCategoryOutputSchema = z.object({
  suggestedCategories: z.array(z.string()).describe('An array of suggested procurement categories based on the item description.').min(1),
});
export type SuggestProcurementCategoryOutput = z.infer<typeof SuggestProcurementCategoryOutputSchema>;

export async function suggestProcurementCategory(input: SuggestProcurementCategoryInput): Promise<SuggestProcurementCategoryOutput> {
  return suggestProcurementCategoryFlow(input);
}

const suggestProcurementCategoryPrompt = ai.definePrompt({
  name: 'suggestProcurementCategoryPrompt',
  input: { schema: SuggestProcurementCategoryInputSchema },
  output: { schema: SuggestProcurementCategoryOutputSchema },
  prompt: `You are an expert procurement officer. Based on the following item description, suggest up to 3 appropriate procurement categories.

Item Description: {{{itemDescription}}}

Provide the suggestions as a JSON array of strings, like this: {"suggestedCategories": ["Category A", "Category B"]}`,
});

const suggestProcurementCategoryFlow = ai.defineFlow(
  {
    name: 'suggestProcurementCategoryFlow',
    inputSchema: SuggestProcurementCategoryInputSchema,
    outputSchema: SuggestProcurementCategoryOutputSchema,
  },
  async (input) => {
    const { output } = await suggestProcurementCategoryPrompt(input);
    if (!output) {
      throw new Error('Failed to get category suggestions from the AI model.');
    }
    return output;
  }
);
