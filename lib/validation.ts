import { z } from 'zod';
// passthrough(): campos desconhecidos (de uma versão mais recente da aplicação) são preservados
// em vez de apagados silenciosamente quando um dispositivo com uma versão antiga guarda o plano.
const qty = z.number().finite().nonnegative().max(10000000);
const text = z.string().max(10000);
const id = z.string().min(1).max(100);
const macros = z.object({ kcal: qty, protein: qty, carbs: qty, fat: qty }).passthrough();
const ingredient = z.object({ foodId: id, quantity: qty }).passthrough();
const ingredients = z.array(ingredient).max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)), 'Data inválida');
const profile = z.object({ name: text, goals: macros, avoid: text, preferences: text }).passthrough();
const people = <T extends z.ZodTypeAny>(value: T) => z.object({ goncalo: value.optional(), ines: value.optional() }).passthrough();
export const stateSchema = z.object({
    version: z.literal(1),
    foods: z.array(z.object({ id, name: text, brand: text.optional(), unit: z.enum(['g', 'ml', 'un']), basis: qty.positive(), state: text, section: text, nutrition: macros.nullable(), estimated: z.boolean().optional(), source: text, pack: qty.positive().optional() }).passthrough()).max(2000),
    recipes: z.array(z.object({ id, name: text, category: text, servings: qty.positive(), ingredients, steps: text, minutes: qty, favorite: z.boolean(), example: z.boolean(), tags: z.array(text).max(30) }).passthrough()).max(2000),
    meals: z.array(z.object({ id, date, slot: z.enum(['Pequeno-almoço', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia']), recipeId: z.string().max(100), name: text, portions: people(ingredients), outside: z.boolean(), outsideMacros: people(macros).optional(), batchId: id.optional() }).passthrough()).max(15000),
    batches: z.array(z.object({ id, name: text, date, ingredients, recipeId: z.string().max(100).optional(), servings: qty.positive().optional() }).passthrough()).max(2000),
    profiles: z.object({ goncalo: profile, ines: profile }).passthrough(),
    pantry: z.record(id, qty),
    purchased: z.record(z.string().max(200), qty),
    manual: z.array(z.object({ id, name: text, quantity: text, checked: z.boolean() }).passthrough()).max(500),
}).passthrough();
