import { z } from 'zod';
const qty = z.number().finite().nonnegative().max(10000000);
const text = z.string().max(10000);
const id = z.string().min(1).max(100);
const macros = z.object({ kcal: qty, protein: qty, carbs: qty, fat: qty });
const ingredient = z.object({ foodId: id, quantity: qty });
const ingredients = z.array(ingredient).max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)), 'Data inválida');
const profile = z.object({ name: text, goals: macros, avoid: text, preferences: text });
export const stateSchema = z.object({
    version: z.literal(1), foods: z.array(z.object({ id, name: text, unit: z.enum(['g', 'ml', 'un']), basis: qty.positive(), state: text, section: text, nutrition: macros, source: text, pack: qty.positive().optional() })).max(2000),
    recipes: z.array(z.object({ id, name: text, category: text, servings: qty.positive(), ingredients, steps: text, minutes: qty, favorite: z.boolean(), example: z.boolean(), tags: z.array(text).max(30) })).max(2000),
    meals: z.array(z.object({ id, date, slot: z.enum(['Pequeno-almoço', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia']), recipeId: z.string().max(100), name: text, portions: z.object({ goncalo: ingredients.optional(), ines: ingredients.optional() }), outside: z.boolean(), batchId: id.optional() })).max(15000),
    batches: z.array(z.object({ id, name: text, date, ingredients })).max(2000), profiles: z.object({ goncalo: profile, ines: profile }), pantry: z.record(id, qty), purchased: z.record(z.string().max(200), qty), manual: z.array(z.object({ id, name: text, quantity: text, checked: z.boolean() })).max(500)
});
