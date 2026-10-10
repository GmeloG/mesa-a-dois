// Ligação à base de dados aberta Open Food Facts (https://world.openfoodfacts.org).
// Chamada diretamente pelo navegador: sem servidor próprio e sem chaves.
// Os dados são submetidos por utilizadores; devem ser confirmados no rótulo.
import { uid, type Food, type Macros } from './model.ts';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_pt,brands,quantity,product_quantity,product_quantity_unit,nutriments,categories_tags';

export type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_pt?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  nutriments?: Record<string, number | string | undefined>;
  categories_tags?: string[];
};

export type OffResult = { code: string; label: string; detail: string; food: Food; complete: boolean };

const num = (v: unknown) => { const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) && n >= 0 ? n : null; };

function section(categories: string[] = []): string {
  const has = (...k: string[]) => categories.some(c => k.some(x => c.includes(x)));
  if (has('milk', 'dairies', 'yogurt', 'cheese', 'dairy')) return 'Laticínios';
  if (has('meat', 'poultry', 'fish', 'seafood')) return 'Carne e peixe';
  if (has('canned')) return 'Conservas';
  if (has('fruit', 'vegetable')) return 'Fruta e legumes';
  if (has('bread', 'bakery')) return 'Padaria';
  if (has('egg')) return 'Ovos';
  if (has('frozen')) return 'Congelados';
  if (has('beverage', 'drink', 'water')) return 'Bebidas';
  return 'Mercearia';
}

/** Converte um produto do Open Food Facts num alimento da aplicação. Valores em falta ficam desconhecidos (nunca 0). */
export function offToFood(p: OffProduct): OffResult {
  const n = p.nutriments || {};
  const liquid = /\b(ml|cl|l)\b/i.test(`${p.product_quantity_unit || ''} ${p.quantity || ''}`) && !/\bg\b/i.test(p.product_quantity_unit || '');
  const values = { kcal: num(n['energy-kcal_100g']), protein: num(n['proteins_100g']), carbs: num(n['carbohydrates_100g']), fat: num(n['fat_100g']) };
  if (values.kcal === null) { const kj = num(n['energy-kj_100g'] ?? n['energy_100g']); if (kj !== null) values.kcal = Math.round(kj / 4.184); }
  const complete = Object.values(values).every(v => v !== null);
  const nutrition: Macros | null = complete ? values as Macros : null;
  let pack = num(p.product_quantity) ?? undefined;
  if (pack !== undefined && /^(kg|l)$/i.test(p.product_quantity_unit || '')) pack *= 1000;
  if (pack !== undefined && /^cl$/i.test(p.product_quantity_unit || '')) pack *= 10;
  const name = (p.product_name_pt || p.product_name || 'Produto sem nome').trim();
  const brand = (p.brands || '').split(',')[0].trim() || undefined;
  const code = p.code || '';
  const food: Food = {
    id: uid(), name, unit: liquid ? 'ml' : 'g', basis: 100, state: 'tal como vendido', section: section(p.categories_tags),
    nutrition, source: `Open Food Facts${code ? `, código ${code}` : ''} — valores submetidos por utilizadores; confirmar no rótulo.`,
  };
  if (brand) food.brand = brand;
  if (pack && pack > 0) food.pack = pack;
  const detail = nutrition ? `${Math.round(nutrition.kcal)} kcal · P ${nutrition.protein} g · HC ${nutrition.carbs} g · G ${nutrition.fat} g por 100 ${food.unit}` : 'Valores nutricionais incompletos';
  return { code, label: [name, brand, p.quantity].filter(Boolean).join(' · '), detail, food, complete };
}

async function getJson(url: string, signal?: AbortSignal) {
  let response: Response;
  try { response = await fetch(url, { signal, headers: { Accept: 'application/json' } }); }
  catch (e) { if ((e as Error).name === 'AbortError') throw e; throw new Error('Não foi possível ligar ao Open Food Facts. Verifica a ligação.'); }
  if (response.status === 429) throw new Error('O Open Food Facts recebeu demasiados pedidos. Tenta daqui a um minuto.');
  if (!response.ok) throw new Error(`O Open Food Facts respondeu com erro ${response.status}.`);
  return response.json();
}

export async function searchOff(query: string, signal?: AbortSignal): Promise<OffResult[]> {
  const q = query.trim();
  if (/^\d{8,14}$/.test(q)) { const one = await barcodeOff(q, signal); return one ? [one] : []; }
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&sort_by=unique_scans_n&fields=${FIELDS}`;
  const data = await getJson(url, signal);
  return ((data?.products || []) as OffProduct[]).map(offToFood);
}

export async function barcodeOff(code: string, signal?: AbortSignal): Promise<OffResult | null> {
  const data = await getJson(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, signal);
  if (!data || data.status !== 1 || !data.product) return null;
  return offToFood({ code, ...data.product });
}
