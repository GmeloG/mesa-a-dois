import { useEffect, useRef, useState } from 'react';
import { searchOff, type OffResult } from '@/lib/openfoodfacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Choice, NumberField, Ingredients, MacroLine, ingredientText } from './controls';
import {
  type State, type Recipe, type Meal, type Food, type Person, type Macros,
  PEOPLE, NAMES, SLOTS, MACRO_KEYS, nutrition, scale, newMeal, uid, zero, batchRemaining, localDate,
  mealTotal, mealNutrition, proposeRecipe, amount,
} from '@/lib/model';

export type Commit = (change: (s: State) => State, message?: string) => Promise<boolean>;
const MACRO_LABELS = ['Calorias (kcal)', 'Proteína (g)', 'Hidratos (g)', 'Gordura (g)'];

export function MealEditor({ state, initial, commit, close }: {
  state: State;
  initial: Meal;
  commit: Commit;
  close: () => void;
}) {
  const [meal, setMeal] = useState<Meal>(structuredClone(initial));
  const [person, setPerson] = useState<Person>(PEOPLE.find(p => initial.portions[p]) || 'goncalo');
  const [updateRecipe, setUpdateRecipe] = useState(false);
  const recipe = state.recipes.find(r => r.id === meal.recipeId);
  const batch = state.batches.find(b => b.id === meal.batchId);
  const people = PEOPLE.filter(p => meal.portions[p]);
  const isNew = !state.meals.some(m => m.id === initial.id);

  // Excesso face à preparação (contando as outras refeições já associadas).
  const overBatch = batch ? batchRemaining(state, batch, meal.id).flatMap(left => {
    const used = mealTotal(meal).find(i => i.foodId === left.foodId)?.quantity || 0;
    const food = state.foods.find(f => f.id === left.foodId);
    return used - left.quantity > 0.001 && food ? [`${food.name}: disponível ${amount(Math.max(0, left.quantity), food.unit)}`] : [];
  }) : [];

  function selectRecipe(id: string) {
    const r = state.recipes.find(r => r.id === id);
    if (!r) return;
    setMeal({ ...newMeal(r, meal.date, meal.slot, people.length ? people : PEOPLE), id: meal.id, outside: meal.outside });
    setUpdateRecipe(false);
  }
  function selectOrigin(id: string) {
    if (id === 'fresh') { setMeal({ ...meal, batchId: undefined }); return; }
    const b = state.batches.find(x => x.id === id);
    if (!b) return;
    const r = state.recipes.find(x => x.id === b.recipeId);
    const perServing = scale(b.ingredients, 1 / (b.servings || r?.servings || 1));
    const portions = Object.fromEntries((people.length ? people : PEOPLE).map(p => [p, structuredClone(perServing)]));
    setMeal({ ...meal, batchId: b.id, recipeId: b.recipeId || meal.recipeId, name: b.name, portions });
    setUpdateRecipe(false);
  }
  function togglePerson(p: Person, on: boolean) {
    const portions = { ...meal.portions };
    if (on) {
      const other = PEOPLE.find(x => x !== p && meal.portions[x]);
      portions[p] = batch && other ? structuredClone(meal.portions[other]!) : recipe ? scale(recipe.ingredients, 1 / recipe.servings) : [];
    } else delete portions[p];
    const outsideMacros = { ...meal.outsideMacros };
    if (!on) delete outsideMacros[p];
    setMeal({ ...meal, portions, outsideMacros });
    if (!on && person === p) setPerson(PEOPLE.find(x => x !== p) || 'goncalo');
    if (on && !meal.portions[person]) setPerson(p);
  }
  function setOutsideMacro(p: Person, key: keyof Macros, value: number) {
    const current = meal.outsideMacros?.[p] || zero();
    setMeal({ ...meal, outsideMacros: { ...meal.outsideMacros, [p]: { ...current, [key]: value } } });
  }
  function toggleOutsideKnown(p: Person, known: boolean) {
    const outsideMacros = { ...meal.outsideMacros };
    if (known) outsideMacros[p] = zero(); else delete outsideMacros[p];
    setMeal({ ...meal, outsideMacros });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!people.length || overBatch.length) return;
    const ok = await commit(s => {
      const clean: Meal = { ...meal, outsideMacros: meal.outside && meal.outsideMacros && Object.keys(meal.outsideMacros).length ? meal.outsideMacros : undefined, batchId: meal.outside ? undefined : meal.batchId };
      if (!clean.outsideMacros) delete clean.outsideMacros;
      if (!clean.batchId) delete clean.batchId;
      const next = { ...s, meals: [...s.meals.filter(m => m.id !== meal.id), clean] };
      if (updateRecipe && recipe && !meal.batchId && !meal.outside)
        next.recipes = s.recipes.map(r => r.id === recipe.id ? { ...r, servings: 1, ingredients: (meal.portions[person] || []).filter(i => i.quantity > 0), example: false } : r);
      return next;
    }, updateRecipe ? 'Refeição e receita guardadas' : 'Refeição guardada');
    if (ok) close();
  }

  const total = mealTotal(meal);
  return <form onSubmit={save} className="form-stack">
    <DialogTitle>{isNew ? 'Planear refeição' : 'Editar refeição'}</DialogTitle>
    <DialogDescription>Muda o dia ou a refeição para mover. As quantidades atualizam calorias, macros e compras.</DialogDescription>
    <div className="two-cols">
      <label className="field">Dia<Input type="date" required value={meal.date} onChange={e => e.target.value && setMeal({ ...meal, date: e.target.value })} /></label>
      <Choice label="Refeição" value={meal.slot} onChange={slot => setMeal({ ...meal, slot })} options={SLOTS.map(s => ({ value: s, label: s }))} />
    </div>
    <label className="check-label"><Checkbox checked={meal.outside} onCheckedChange={v => setMeal({ ...meal, outside: !!v, batchId: undefined })} />Fora de casa · excluída das compras</label>
    {!meal.outside && <>
      <Choice label="Receita ou refeição simples" value={meal.recipeId} onChange={selectRecipe}
        options={[...(recipe ? [] : [{ value: meal.recipeId, label: meal.name || 'Receita eliminada' }]), ...state.recipes.map(r => ({ value: r.id, label: r.name }))]} />
      {state.batches.length > 0 && <Choice label="Origem" value={meal.batchId || 'fresh'} onChange={selectOrigin}
        options={[{ value: 'fresh', label: 'Preparar nesta refeição' }, ...state.batches.filter(b => b.date <= meal.date).map(b => ({ value: b.id, label: `Preparação: ${b.name} · ${b.date}` }))]} />}
    </>}
    {meal.outside && <label className="field">Descrição (opcional)<Input value={meal.name} maxLength={150} onChange={e => setMeal({ ...meal, name: e.target.value })} placeholder="Ex.: Jantar de anos" /></label>}
    <div className="people-check">{PEOPLE.map(p => <label key={p} className="check-label"><Checkbox checked={!!meal.portions[p]} onCheckedChange={v => togglePerson(p, !!v)} />{NAMES[p]}</label>)}</div>
    {!people.length && <p className="warning">Seleciona pelo menos uma pessoa.</p>}

    {meal.outside && people.map(p => {
      const known = meal.outsideMacros?.[p];
      return <fieldset key={p} className="outside-values"><legend>{NAMES[p]}</legend>
        <label className="check-label"><Checkbox checked={!!known} onCheckedChange={v => toggleOutsideKnown(p, !!v)} />Conheço os valores nutricionais</label>
        {known ? <div className="two-cols">{MACRO_KEYS.map((key, i) => <NumberField key={key} label={MACRO_LABELS[i]} required={false} value={known[key]} onChange={v => setOutsideMacro(p, key, v)} />)}</div>
          : <p className="note">Valores desconhecidos: o total do dia ficará assinalado como incompleto.</p>}
      </fieldset>;
    })}

    {!meal.outside && people.length > 0 && <>
      <Tabs value={person} onValueChange={v => setPerson(v as Person)}><TabsList>{people.map(p => <TabsTrigger key={p} value={p}>Porção de {NAMES[p]}</TabsTrigger>)}</TabsList></Tabs>
      {meal.portions[person] && <>
        <Ingredients items={meal.portions[person]!} foods={state.foods} allowAdd={!batch}
          onChange={items => setMeal({ ...meal, portions: { ...meal.portions, [person]: items } })} />
        <MacroLine value={nutrition(meal.portions[person]!, state.foods)} />
      </>}
      {people.length > 1 && <div className="per-person">{people.map(p => <div key={p}><span className={`tiny-avatar ${p}`}>{NAMES[p][0]}</span>{NAMES[p]}<MacroLine compact value={mealNutrition(meal, p, state.foods)} /></div>)}</div>}
      {total.length > 0 && <p className="prepare-total"><strong>Total a preparar:</strong> {ingredientText(total, state.foods)}</p>}
      {batch && <p className="note">Vem da preparação de {batch.date}: as compras contam-na uma única vez. Não é possível distribuir mais do que o preparado.</p>}
      {overBatch.length > 0 && <p className="warning" role="alert">Excede a preparação — {overBatch.join('; ')}.</p>}
      {!batch && recipe && <Choice label="Aplicar alterações a" value={updateRecipe ? 'recipe' : 'meal'} onChange={v => setUpdateRecipe(v === 'recipe')}
        options={[{ value: 'meal', label: 'Apenas esta refeição' }, { value: 'recipe', label: `Esta refeição e a receita guardada (porção de ${NAMES[person]})` }]} />}
      {updateRecipe && <p className="note">A receita «{recipe?.name}» passa a ter 1 porção com as quantidades de {NAMES[person]}. As refeições já planeadas mantêm as suas quantidades.</p>}
    </>}
    <Button type="submit" className="primary" disabled={!people.length || overBatch.length > 0}>Guardar refeição</Button>
  </form>;
}

export function RecipeEditor({ state, initial, isNew, commit, close, onPlan }: {
  state: State;
  initial?: Recipe;
  isNew?: boolean;
  commit: Commit;
  close: () => void;
  onPlan?: (recipe: Recipe) => void;
}) {
  const [r, setR] = useState<Recipe>(initial ? structuredClone(initial) : { id: uid(), name: '', category: 'Almoço', servings: 1, ingredients: [], steps: '', minutes: 15, favorite: false, example: false, tags: [] });
  const creating = isNew ?? !initial;
  const proposal = r.tags.includes('Proposta por regras');
  async function save(plan: boolean) {
    if (!r.ingredients.length || !r.name.trim() || !(r.servings > 0)) return;
    const saved: Recipe = { ...r, name: r.name.trim(), example: false, tags: r.tags.map(t => t.trim()).filter(Boolean), ingredients: r.ingredients.filter(i => i.quantity > 0) };
    if (await commit(s => ({ ...s, recipes: [...s.recipes.filter(x => x.id !== r.id), saved] }), 'Receita guardada')) {
      if (plan && onPlan) onPlan(saved); else close();
    }
  }
  const valid = r.ingredients.length > 0 && !!r.name.trim() && r.servings > 0;
  return <form onSubmit={e => { e.preventDefault(); save(false); }} className="form-stack">
    <DialogTitle>{creating ? (proposal ? 'Rever proposta de receita' : 'Criar receita') : 'Editar receita'}</DialogTitle>
    <DialogDescription>Quantidades da receita completa. Os valores abaixo mostram o total e cada porção.</DialogDescription>
    {proposal && creating && <p className="notice">Proposta gerada por regras predefinidas (não por IA). As quantidades são indicativas: revê-as e ajusta os passos antes de guardar.</p>}
    <label className="field">Nome<Input required maxLength={150} value={r.name} onChange={e => setR({ ...r, name: e.target.value })} placeholder="Ex.: Arroz de frango com legumes" /></label>
    <div className="two-cols">
      <Choice label="Categoria" value={r.category} onChange={category => setR({ ...r, category })} options={SLOTS.map(s => ({ value: s, label: s }))} />
      <NumberField label="Porções da receita" value={r.servings} min={0.1} onChange={servings => setR({ ...r, servings })} />
    </div>
    <Ingredients foods={state.foods} items={r.ingredients} onChange={ingredients => setR({ ...r, ingredients })} />
    {r.servings > 0 && r.ingredients.length > 0 && <div className="recipe-totals">
      <div><small>Receita completa</small><MacroLine value={nutrition(r.ingredients, state.foods)} /></div>
      <div><small>Por porção</small><MacroLine value={nutrition(scale(r.ingredients, 1 / r.servings), state.foods)} /></div>
    </div>}
    <label className="field">Preparação<Textarea value={r.steps} onChange={e => setR({ ...r, steps: e.target.value })} placeholder="Escreve os passos de preparação…" rows={4} /></label>
    <div className="two-cols">
      <NumberField label="Tempo total (min)" value={r.minutes} onChange={minutes => setR({ ...r, minutes })} />
      <label className="field">Etiquetas, separadas por vírgulas<Input value={r.tags.join(',')} onChange={e => setR({ ...r, tags: e.target.value.split(',') })} /></label>
    </div>
    <div className="button-row">
      <Button type="submit" className="primary" disabled={!valid}>Guardar receita</Button>
      {onPlan && <Button type="button" variant="outline" disabled={!valid} onClick={() => save(true)}>Guardar e planear</Button>}
    </div>
  </form>;
}

export function ProposalEditor({ state, onPropose }: { state: State; onPropose: (recipe: Recipe) => void }) {
  const [category, setCategory] = useState('Almoço');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(() => state.foods.filter(f => (state.pantry[f.id] || 0) > 0).map(f => f.id));
  const avoid = PEOPLE.flatMap(p => state.profiles[p].avoid.toLowerCase().split(',').map(x => x.trim()).filter(Boolean));
  const foods = state.foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return <form className="form-stack" onSubmit={e => { e.preventDefault(); if (selected.length) onPropose(proposeRecipe(state.foods, selected, category)); }}>
    <DialogTitle>Receita a partir de ingredientes</DialogTitle>
    <DialogDescription>Escolhe os ingredientes. A proposta usa regras simples e predefinidas; poderás rever tudo antes de guardar ou planear.</DialogDescription>
    <Choice label="Para que refeição?" value={category} onChange={setCategory} options={SLOTS.map(s => ({ value: s, label: s }))} />
    <label className="field">Pesquisar alimentos<Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ex.: frango" /></label>
    <div className="food-picker">{foods.map(f => {
      const avoided = avoid.some(w => f.name.toLowerCase().includes(w));
      return <label key={f.id} className="check-label"><Checkbox checked={selected.includes(f.id)} onCheckedChange={() => toggle(f.id)} />
        <span>{f.name} <small>· {f.state}{(state.pantry[f.id] || 0) > 0 ? ' · em casa' : ''}{avoided ? ' · a evitar' : ''}</small></span></label>;
    })}</div>
    <Button type="submit" className="primary" disabled={!selected.length}>Gerar proposta com {selected.length} ingrediente{selected.length === 1 ? '' : 's'}</Button>
  </form>;
}

export function FoodEditor({ initial, commit, close }: {
  initial?: Food;
  commit: Commit;
  close: () => void;
}) {
  const [f, setF] = useState<Food>(initial ? structuredClone(initial) : { id: uid(), name: '', unit: 'g', basis: 100, state: 'tal como vendido', section: 'Mercearia', nutrition: zero(), source: 'Rótulo introduzido pelo utilizador' });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean: Food = { ...f, name: f.name.trim(), brand: f.brand?.trim() || undefined };
    if (!clean.brand) delete clean.brand;
    if (!clean.pack) delete clean.pack;
    if (!clean.estimated) delete clean.estimated;
    if (await commit(s => ({ ...s, foods: [...s.foods.filter(x => x.id !== f.id), clean] }), 'Alimento guardado; valores recalculados')) close();
  }
  const known = f.nutrition !== null;
  const [offNote, setOffNote] = useState('');
  function pick(result: OffResult) {
    const food = result.food;
    if (initial && food.unit !== f.unit) { setOffNote(`Este produto está em ${food.unit} e o alimento em ${f.unit}. Cria um novo alimento para o usar.`); return; }
    setF(prev => initial
      ? { ...prev, brand: food.brand ?? prev.brand, basis: food.basis, nutrition: food.nutrition, estimated: undefined, pack: food.pack ?? prev.pack, source: food.source }
      : { ...food, id: prev.id });
    setOffNote(result.complete ? 'Valores preenchidos a partir do Open Food Facts. Confirma-os no rótulo antes de guardar.' : 'Este produto não tem todos os valores nutricionais no Open Food Facts: ficam como desconhecidos até os preencheres.');
  }
  return <form onSubmit={save} className="form-stack">
    <DialogTitle>{initial ? 'Editar alimento' : 'Adicionar alimento'}</DialogTitle>
    <DialogDescription>Procura o produto no Open Food Facts ou transcreve os valores do rótulo. Um produto ou estado diferente (cru/cozinhado) deve ser um novo alimento.</DialogDescription>
    <OffSearch onPick={pick} />
    {offNote && <p className="notice" role="status">{offNote}</p>}
    <div className="two-cols">
      <label className="field">Nome<Input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex.: Iogurte natural" /></label>
      <label className="field">Marca (opcional)<Input value={f.brand || ''} onChange={e => setF({ ...f, brand: e.target.value })} /></label>
    </div>
    <div className="two-cols">
      {initial ? <label className="field">Unidade<Input value={f.unit} disabled /></label>
        : <Choice label="Unidade" value={f.unit} onChange={unit => setF({ ...f, unit: unit as Food['unit'], basis: unit === 'un' ? 1 : 100 })} options={[{ value: 'g', label: 'gramas (g)' }, { value: 'ml', label: 'mililitros (ml)' }, { value: 'un', label: 'unidades (un)' }]} />}
      <NumberField label={`Valores por (${f.unit})`} value={f.basis} min={0.01} onChange={basis => setF({ ...f, basis })} />
    </div>
    <label className="field">Estado de pesagem<Input required disabled={!!initial} value={f.state} onChange={e => setF({ ...f, state: e.target.value })} placeholder="cru, cozinhado, escorrido, parte comestível, com osso…" /></label>
    <label className="check-label"><Checkbox checked={!known} onCheckedChange={v => setF({ ...f, nutrition: v ? null : zero() })} />Valores nutricionais desconhecidos</label>
    {known && <>
      <div className="two-cols">{MACRO_KEYS.map((key, i) => <NumberField key={key} label={MACRO_LABELS[i]} required={false} value={f.nutrition![key]} onChange={v => setF({ ...f, nutrition: { ...f.nutrition!, [key]: v } })} />)}</div>
      <label className="check-label"><Checkbox checked={!!f.estimated} onCheckedChange={v => setF({ ...f, estimated: !!v })} />Valores estimados (ainda não confirmados no rótulo)</label>
    </>}
    <div className="two-cols">
      <label className="field">Secção do supermercado<Input required value={f.section} onChange={e => setF({ ...f, section: e.target.value })} /></label>
      <NumberField label={`Embalagem (${f.unit}) · vazio = não definida`} required={false} value={f.pack || 0} onChange={pack => setF({ ...f, pack: pack || undefined })} />
    </div>
    <label className="field">Fonte dos valores<Input required value={f.source} onChange={e => setF({ ...f, source: e.target.value })} /></label>
    {initial && <p className="note">Alterar os valores recalcula as refeições que usam este alimento. A unidade e o estado não se alteram: cria outro alimento (por exemplo, arroz cozinhado), porque não há conversão cru → cozinhado sem um fator de rendimento.</p>}
    <Button type="submit" className="primary">Guardar alimento</Button>
  </form>;
}

export function BatchEditor({ state, commit, close }: {
  state: State;
  commit: Commit;
  close: () => void;
}) {
  const [recipeId, setRecipe] = useState(state.recipes[0]?.id || '');
  const [servings, setServings] = useState(4);
  const [date, setDate] = useState(localDate());
  const r = state.recipes.find(x => x.id === recipeId);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!r || !(servings > 0)) return;
    if (await commit(s => ({ ...s, batches: [...s.batches, { id: uid(), name: r.name, recipeId: r.id, servings, date, ingredients: scale(r.ingredients, servings / r.servings) }] }), 'Preparação guardada. Distribui-a nas refeições.')) close();
  }
  return <form onSubmit={save} className="form-stack">
    <DialogTitle>Preparar para vários dias</DialogTitle>
    <DialogDescription>As compras contam toda a preparação no dia em que é feita. Depois, distribui as porções pelas refeições.</DialogDescription>
    <Choice label="Receita" value={recipeId} onChange={setRecipe} options={state.recipes.map(r => ({ value: r.id, label: r.name }))} />
    <NumberField label="Número total de porções" value={servings} min={0.1} onChange={setServings} />
    <label className="field">Dia de preparação<Input type="date" required value={date} onChange={e => e.target.value && setDate(e.target.value)} /></label>
    {r && servings > 0 && <p className="prepare-total"><strong>Preparar:</strong> {ingredientText(scale(r.ingredients, servings / r.servings), state.foods)}</p>}
    <Button type="submit" className="primary" disabled={!r}>Guardar preparação</Button>
  </form>;
}

export function ManualEditor({ commit, close }: { commit: Commit; close: () => void }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1 unidade');
  return <form className="form-stack" onSubmit={async e => { e.preventDefault(); if (await commit(s => ({ ...s, manual: [...s.manual, { id: uid(), name: name.trim(), quantity: quantity.trim(), checked: false }] }), 'Artigo adicionado')) close(); }}>
    <DialogTitle>Adicionar às compras</DialogTitle>
    <DialogDescription>Para produtos que não vêm das receitas, como detergente ou papel higiénico. Mantêm-se quando o plano muda.</DialogDescription>
    <label className="field">Artigo<Input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Detergente da loiça" /></label>
    <label className="field">Quantidade<Input required value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
    <Button type="submit" className="primary">Adicionar artigo</Button>
  </form>;
}

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
/** Pesquisa no Open Food Facts por nome, marca ou código de barras (e leitura pela câmara quando o navegador suporta). */
function OffSearch({ onPick }: { onPick: (r: OffResult) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OffResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const abort = useRef<AbortController | null>(null);
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
  useEffect(() => () => abort.current?.abort(), []);
  async function run(value = query) {
    if (!value.trim()) return;
    if (!navigator.onLine) { setError('Sem ligação: a pesquisa precisa de internet.'); return; }
    abort.current?.abort(); abort.current = new AbortController();
    setBusy(true); setError(''); setResults(null);
    try { setResults(await searchOff(value, abort.current.signal)); }
    catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null; let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current || stop) return;
        video.current.srcObject = stream; await video.current.play();
        const Ctor = (window as unknown as { BarcodeDetector: new (o: object) => Detector }).BarcodeDetector;
        const detector = new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        while (!stop) {
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0]?.rawValue) { const code = codes[0].rawValue; setQuery(code); setScanning(false); run(code); return; }
          await new Promise(r => setTimeout(r, 300));
        }
      } catch { setError('Não foi possível usar a câmara. Escreve o código de barras.'); setScanning(false); }
    })();
    return () => { stop = true; stream?.getTracks().forEach(t => t.stop()); };
  }, [scanning]);
  return <div className="off-search">
    <label className="field">Procurar no Open Food Facts
      <div className="off-row">
        <Input value={query} placeholder="Ex.: Mimosa proteína, arroz agulha ou código de barras" enterKeyHint="search"
          onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run(); } }} />
        <Button type="button" variant="outline" onClick={() => run()} disabled={busy || !query.trim()}>{busy ? 'A procurar…' : 'Procurar'}</Button>
        {canScan && <Button type="button" variant="ghost" onClick={() => setScanning(!scanning)}>{scanning ? 'Parar' : 'Câmara'}</Button>}
      </div>
    </label>
    {scanning && <video ref={video} className="off-video" muted playsInline />}
    {error && <p className="warning" role="alert">{error}</p>}
    {results && results.length === 0 && <p className="note">Sem resultados. Experimenta outro nome, a marca ou o código de barras.</p>}
    {results && results.length > 0 && <ul className="off-results">{results.map((r, i) => <li key={`${r.code}-${i}`}>
      <button type="button" onClick={() => { onPick(r); setResults(null); }}><strong>{r.label}</strong><small>{r.detail}</small></button>
    </li>)}</ul>}
    <small className="muted">Dados abertos e colaborativos do Open Food Facts; podem ter erros.</small>
  </div>;
}
