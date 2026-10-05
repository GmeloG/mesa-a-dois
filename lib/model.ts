export type Macros = {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
};
export type Food = {
    id: string;
    name: string;
    unit: 'g' | 'ml' | 'un';
    basis: number;
    state: string;
    section: string;
    nutrition: Macros;
    source: string;
    pack?: number;
};
export type Ingredient = {
    foodId: string;
    quantity: number;
};
export type Person = 'goncalo' | 'ines';
export const PEOPLE: Person[] = ['goncalo', 'ines'];
export const NAMES = { goncalo: 'Gonçalo', ines: 'Inês' };
export const SLOTS = ['Pequeno-almoço', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'] as const;
export type Recipe = {
    id: string;
    name: string;
    category: string;
    servings: number;
    ingredients: Ingredient[];
    steps: string;
    minutes: number;
    favorite: boolean;
    example: boolean;
    tags: string[];
};
export type Meal = {
    id: string;
    date: string;
    slot: string;
    recipeId: string;
    name: string;
    portions: Partial<Record<Person, Ingredient[]>>;
    outside: boolean;
    batchId?: string;
};
export type Batch = {
    id: string;
    name: string;
    date: string;
    ingredients: Ingredient[];
};
export type Profile = {
    name: string;
    goals: Macros;
    avoid: string;
    preferences: string;
};
export type ManualItem = {
    id: string;
    name: string;
    quantity: string;
    checked: boolean;
};
export type State = {
    version: 1;
    foods: Food[];
    recipes: Recipe[];
    meals: Meal[];
    batches: Batch[];
    profiles: Record<Person, Profile>;
    pantry: Record<string, number>;
    purchased: Record<string, number>;
    manual: ManualItem[];
};
export const zero = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
export function nutrition(items: Ingredient[], foods: Food[]): Macros {
    return items.reduce((total, item) => { const food = foods.find(f => f.id === item.foodId); if (!food)
        throw new Error('Alimento não encontrado'); for (const key of Object.keys(total) as (keyof Macros)[])
        total[key] += food.nutrition[key] * item.quantity / food.basis; return total; }, zero());
}
export function totals(state: State, date: string, person: Person) { return nutrition(state.meals.filter(m => m.date === date && !m.outside).flatMap(m => m.portions[person] || []), state.foods); }
export function scale(items: Ingredient[], factor: number) { return items.map(i => ({ ...i, quantity: Math.round(i.quantity * factor * 100) / 100 })); }
export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function localDate(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function plusDay(date: string, n: number) { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d); }
export function monday(date: string) { const d = new Date(date + 'T12:00:00'); return plusDay(date, -((d.getDay() + 6) % 7)); }
export const fmt = (n: number, digits = 0) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: digits }).format(n);
export function amount(n: number, unit: string) { return n >= 1000 && (unit === 'g' || unit === 'ml') ? `${fmt(n / 1000, 2)} ${unit === 'g' ? 'kg' : 'l'}` : `${fmt(n, 2)} ${unit}`; }
export function newMeal(recipe: Recipe, date: string, slot: string, people: Person[] = PEOPLE): Meal { return { id: uid(), date, slot, recipeId: recipe.id, name: recipe.name, portions: Object.fromEntries(people.map(p => [p, scale(recipe.ingredients, 1 / recipe.servings)])), outside: false }; }
export type ShoppingRow = {
    food: Food;
    required: number;
    stock: number;
    missing: number;
    packages: number | null;
    buy: number;
    leftover: number;
    checked: boolean;
    changed: boolean;
    sources: string[];
};
export function shopping(state: State, from: string, to: string): ShoppingRow[] {
    const quantities = new Map<string, {
        quantity: number;
        sources: Set<string>;
    }>();
    const add = (items: Ingredient[], source: string) => items.forEach(i => { const row = quantities.get(i.foodId) || { quantity: 0, sources: new Set<string>() }; row.quantity += i.quantity; row.sources.add(source); quantities.set(i.foodId, row); });
    state.batches.filter(b => b.date >= from && b.date <= to).forEach(b => add(b.ingredients, `${b.date} · Preparação: ${b.name}`));
    state.meals.filter(m => m.date >= from && m.date <= to && !m.outside && !m.batchId).forEach(m => add(Object.values(m.portions).flatMap(x => x || []), `${m.date} · ${m.slot}: ${m.name}`));
    return [...quantities].map(([id, row]) => { const food = state.foods.find(f => f.id === id)!; const stock = state.pantry[id] || 0; const missing = Math.max(0, row.quantity - stock); const packages = food.pack ? Math.ceil(missing / food.pack) : null; const buy = packages === null ? missing : packages * food.pack!; const checkedAmount = state.purchased[`${from}:${to}:${id}`]; return { food, required: row.quantity, stock, missing, packages, buy, leftover: Math.max(0, buy - missing), checked: checkedAmount !== undefined && Math.abs(checkedAmount - missing) < 0.001, changed: checkedAmount !== undefined && Math.abs(checkedAmount - missing) >= 0.001, sources: [...row.sources] }; }).sort((a, b) => a.food.section.localeCompare(b.food.section, 'pt') || a.food.name.localeCompare(b.food.name, 'pt'));
}
export function suggested(state: State, slot: string, people: Person[], from: string, to: string) {
    const avoid = people.flatMap(p => state.profiles[p].avoid.toLowerCase().split(',').map(x => x.trim()).filter(Boolean));
    const preferences = people.flatMap(p => state.profiles[p].preferences.toLowerCase().split(',').map(x => x.trim()).filter(Boolean));
    return state.recipes.filter(r => !avoid.some(word => r.ingredients.some(i => state.foods.find(f => f.id === i.foodId)?.name.toLowerCase().includes(word)))).map(r => ({ recipe: r, score: (r.category === slot ? 6 : 0) + (r.favorite ? 2 : 0) + r.ingredients.filter(i => (state.pantry[i.foodId] || 0) >= i.quantity / r.servings).length + preferences.filter(w => (r.name + ' ' + r.tags.join(' ')).toLowerCase().includes(w)).length - state.meals.filter(m => m.date >= from && m.date <= to && m.recipeId === r.id).length * 2 })).sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.recipe);
}
const f = (id: string, name: string, kcal: number, protein: number, carbs: number, fat: number, section: string, state = 'cru', unit: Food['unit'] = 'g', basis = 100): Food => ({ id, name, unit, basis, state, section, nutrition: { kcal, protein, carbs, fat }, source: 'Exemplo genérico estimado; confirmar no rótulo do produto.' });
export const seedFoods: Food[] = [
    f('rice', 'Arroz agulha', 360, 7, 79, 1, 'Mercearia'), f('pasta', 'Massa integral', 350, 13, 65, 2.5, 'Mercearia'), f('chicken', 'Peito de frango', 110, 23, 0, 1.8, 'Carne e peixe', 'cru, sem osso'), f('turkey', 'Peru picado', 120, 22, 0, 3.5, 'Carne e peixe', 'cru, sem osso'), f('salmon', 'Salmão', 208, 20, 0, 13, 'Carne e peixe', 'cru, sem espinhas'), f('tuna', 'Atum ao natural', 110, 25, 0, 1, 'Conservas', 'escorrido'), f('oats', 'Flocos de aveia', 370, 13, 60, 7, 'Mercearia', 'seco'), f('yogurt', 'Iogurte natural', 63, 4, 5, 3, 'Laticínios', 'tal como vendido'), f('skyr', 'Skyr natural', 62, 11, 4, 0.2, 'Laticínios', 'tal como vendido'), f('milk', 'Leite meio-gordo', 47, 3.4, 4.8, 1.6, 'Laticínios', 'tal como vendido', 'ml'), f('banana', 'Banana', 89, 1.1, 23, 0.3, 'Fruta e legumes', 'parte comestível'), f('apple', 'Maçã', 52, 0.3, 14, 0.2, 'Fruta e legumes', 'parte comestível'), f('berries', 'Frutos vermelhos', 45, 1, 9, 0.5, 'Fruta e legumes', 'parte comestível'), f('broccoli', 'Brócolos', 34, 2.8, 4, 0.4, 'Fruta e legumes', 'parte comestível'), f('tomato', 'Tomate', 18, 0.9, 3, 0.2, 'Fruta e legumes', 'parte comestível'), f('lettuce', 'Alface', 15, 1.4, 1.5, 0.2, 'Fruta e legumes', 'parte comestível'), f('potato', 'Batata-doce', 86, 1.6, 20, 0.1, 'Fruta e legumes', 'crua, descascada'), f('oil', 'Azeite', 884, 0, 0, 100, 'Mercearia', 'tal como vendido'), f('bread', 'Pão integral', 250, 9, 43, 4, 'Padaria', 'tal como vendido'), f('egg', 'Ovo médio', 72, 6.3, 0.4, 4.8, 'Ovos', '1 ovo médio, parte comestível', 'un', 1), f('nuts', 'Nozes', 654, 15, 7, 65, 'Mercearia', 'miolo'), f('peanut', 'Manteiga de amendoim', 600, 26, 14, 50, 'Mercearia', 'tal como vendido'), f('wrap', 'Tortilha integral', 310, 9, 50, 8, 'Mercearia', 'tal como vendido'), f('passata', 'Polpa de tomate', 30, 1.5, 4.5, 0.3, 'Conservas', 'tal como vendido'), f('whey', 'Proteína whey', 390, 78, 7, 6, 'Mercearia', 'pó')
];
const ing = (pairs: [
    string,
    number
][]): Ingredient[] => pairs.map(([foodId, quantity]) => ({ foodId, quantity }));
const r = (id: string, name: string, category: string, pairs: [
    string,
    number
][], minutes: number, steps: string, tags: string[]): Recipe => ({ id, name, category, servings: 1, ingredients: ing(pairs), steps, minutes, tags, favorite: false, example: true });
export const seedRecipes: Recipe[] = [
    r('oatbowl', 'Taça de skyr, aveia e fruta', 'Pequeno-almoço', [['skyr', 170], ['oats', 50], ['berries', 80], ['peanut', 10]], 5, 'Colocar o skyr numa taça. Juntar a aveia, a fruta lavada e a manteiga de amendoim.', ['Rápida', 'Sem fogão']),
    r('chickenrice', 'Frango com arroz e brócolos', 'Almoço', [['chicken', 175], ['rice', 75], ['broccoli', 150], ['oil', 8]], 25, 'Cozer o arroz segundo a embalagem. Cozer os brócolos. Confecionar o frango por completo numa frigideira com o azeite e juntar os acompanhamentos.', ['Para levar', 'Proteína']),
    r('yogurtfruit', 'Iogurte, banana e nozes', 'Lanche da manhã', [['yogurt', 170], ['banana', 100], ['nuts', 15]], 3, 'Juntar o iogurte, a banana descascada às rodelas e as nozes.', ['Rápida', 'Sem fogão']),
    r('tunawrap', 'Wrap de atum e salada', 'Lanche da tarde', [['wrap', 60], ['tuna', 80], ['lettuce', 30], ['tomato', 60]], 10, 'Escorrer o atum, lavar e cortar os legumes. Rechear a tortilha e enrolar.', ['Para levar', 'Rápida']),
    r('salmonpotato', 'Salmão com batata-doce', 'Jantar', [['salmon', 150], ['potato', 200], ['broccoli', 150], ['oil', 5]], 35, 'Cortar a batata-doce e levar ao forno a 200 °C. Acrescentar o salmão e cozinhar por completo. Servir com brócolos cozidos e o azeite.', ['Forno']),
    r('bolognese', 'Massa à bolonhesa de peru', 'Almoço', [['pasta', 80], ['turkey', 160], ['passata', 120], ['oil', 8]], 25, 'Cozer a massa. Saltear o peru no azeite, juntar a polpa de tomate e deixar cozinhar completamente. Envolver a massa no molho.', ['Para vários dias']),
    r('eggsbread', 'Ovos mexidos com pão', 'Pequeno-almoço', [['egg', 2], ['bread', 70], ['tomato', 80], ['oil', 4]], 10, 'Mexer os ovos numa frigideira com o azeite até ficarem cozinhados. Servir com pão e tomate lavado.', ['Rápida']),
    r('skyr', 'Skyr com frutos vermelhos', 'Ceia', [['skyr', 170], ['berries', 80]], 3, 'Colocar o skyr numa taça e acrescentar a fruta lavada.', ['Sem fogão']),
    r('shake', 'Batido de banana e aveia', 'Lanche da tarde', [['milk', 250], ['banana', 100], ['oats', 30]], 5, 'Triturar o leite com a banana descascada e a aveia.', ['Rápida']),
    r('applebread', 'Pão com manteiga de amendoim e maçã', 'Lanche da manhã', [['bread', 60], ['peanut', 15], ['apple', 150]], 5, 'Barrar o pão e servir com a maçã lavada e cortada.', ['Sem fogão'])
];
export function initialState(): State { return { version: 1, foods: structuredClone(seedFoods), recipes: structuredClone(seedRecipes), meals: [], batches: [], profiles: { goncalo: { name: 'Gonçalo', goals: zero(), avoid: '', preferences: '' }, ines: { name: 'Inês', goals: zero(), avoid: '', preferences: '' } }, pantry: {}, purchased: {}, manual: [] }; }
export function exampleWeek(state: State, week: string): State {
    const next = structuredClone(state);
    for (let d = 0; d < 7; d++) {
        const date = plusDay(week, d);
        SLOTS.slice(0, 5).forEach((slot, s) => { if (next.meals.some(m => m.date === date && m.slot === slot))
            return; const ids = [d % 2 ? 'eggsbread' : 'oatbowl', d % 2 ? 'applebread' : 'yogurtfruit', d % 2 ? 'bolognese' : 'chickenrice', d % 2 ? 'shake' : 'tunawrap', d % 2 ? 'chickenrice' : 'salmonpotato']; const recipe = next.recipes.find(r => r.id === ids[s]); if (recipe)
            next.meals.push(newMeal(recipe, date, slot)); });
    }
    return next;
}
export function batchRemaining(state: State, batch: Batch, excludeMeal?: string): Ingredient[] { const used = new Map<string, number>(); state.meals.filter(m => m.batchId === batch.id && m.id !== excludeMeal).flatMap(m => Object.values(m.portions).flatMap(x => x || [])).forEach(i => used.set(i.foodId, (used.get(i.foodId) || 0) + i.quantity)); return batch.ingredients.map(i => ({ ...i, quantity: i.quantity - (used.get(i.foodId) || 0) })); }
export function validateState(state: State) {
    const nonnegative = (v: number) => Number.isFinite(v) && v >= 0;
    const ids = new Set(state.foods.map(f => f.id));
    if (ids.size !== state.foods.length)
        throw new Error('Alimentos duplicados');
    const validItems = (items: Ingredient[]) => items.every(i => ids.has(i.foodId) && nonnegative(i.quantity)) && new Set(items.map(i => i.foodId)).size === items.length;
    if (state.foods.some(f => !f.name.trim() || !Number.isFinite(f.basis) || f.basis <= 0 || !Object.values(f.nutrition).every(nonnegative) || (f.pack !== undefined && (!Number.isFinite(f.pack) || f.pack <= 0))))
        throw new Error('Valores dos alimentos inválidos');
    if (state.recipes.some(r => !r.name.trim() || r.servings <= 0 || !validItems(r.ingredients)))
        throw new Error('Receita inválida');
    if (state.meals.some(m => !Object.values(m.portions).every(x => validItems(x || [])) || (m.batchId && !state.batches.some(b => b.id === m.batchId))))
        throw new Error('Refeição inválida');
    if (state.batches.some(b => !validItems(b.ingredients) || batchRemaining(state, b).some(i => i.quantity < -.001)))
        throw new Error('As porções excedem a quantidade preparada');
    for (const meal of state.meals.filter(m => m.batchId)) {
        const batch = state.batches.find(b => b.id === meal.batchId)!;
        if (meal.date < batch.date || Object.values(meal.portions).flatMap(x => x || []).some(i => !batch.ingredients.some(b => b.foodId === i.foodId)))
            throw new Error('A refeição não corresponde à preparação');
    }
    if (!Object.values(state.pantry).every(nonnegative) || !Object.values(state.purchased).every(nonnegative) || PEOPLE.some(p => !Object.values(state.profiles[p].goals).every(nonnegative)))
        throw new Error('Quantidades inválidas');
    return state;
}
