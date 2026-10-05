'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Choice, NumberField, Ingredients, MacroLine } from './controls';
import { State, Recipe, Meal, Food, Person, PEOPLE, NAMES, SLOTS, nutrition, scale, newMeal, uid, zero, batchRemaining, localDate } from '@/lib/model';
export type Commit = (change: (s: State) => State, message?: string) => Promise<boolean>;
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
    function selectRecipe(id: string) { const r = state.recipes.find(r => r.id === id)!; setMeal({ ...newMeal(r, meal.date, meal.slot, PEOPLE.filter(p => meal.portions[p])), id: meal.id }); setUpdateRecipe(false); }
    async function save(e: React.FormEvent) { e.preventDefault(); if (!PEOPLE.some(p => meal.portions[p]))
        return; if (await commit(s => { const next = { ...s, meals: [...s.meals.filter(m => m.id !== meal.id), meal] }; if (updateRecipe && recipe && !meal.batchId)
        next.recipes = s.recipes.map(r => r.id === recipe.id ? { ...r, servings: 1, ingredients: meal.portions[person] || [], example: false } : r); return next; }, 'Refeição guardada'))
        close(); }
    return <form onSubmit={save} className="form-stack"><DialogTitle>Planear refeição</DialogTitle><DialogDescription>As quantidades atualizam as calorias, os macros e as compras.</DialogDescription><div className="two-cols"><label className="field">Dia<Input type="date" required value={meal.date} onChange={e => setMeal({ ...meal, date: e.target.value })}/></label><Choice label="Refeição" value={meal.slot} onChange={slot => setMeal({ ...meal, slot })} options={SLOTS.map(s => ({ value: s, label: s }))}/></div><label className="check-label"><Checkbox checked={meal.outside} onCheckedChange={v => setMeal({ ...meal, outside: !!v, batchId: undefined })}/>Fora de casa · excluir das compras e dos totais conhecidos</label>{!meal.outside && <><Choice label="Receita" value={meal.recipeId} onChange={selectRecipe} options={state.recipes.map(r => ({ value: r.id, label: r.name }))}/>{state.batches.length > 0 && <Choice label="Origem" value={meal.batchId || 'fresh'} onChange={id => { setMeal({ ...meal, batchId: id === 'fresh' ? undefined : id }); setUpdateRecipe(false); }} options={[{ value: 'fresh', label: 'Preparar nesta refeição' }, ...state.batches.map(b => ({ value: b.id, label: `${b.name} · preparado a ${b.date}` }))]}/>}</>}<div className="people-check">{PEOPLE.map(p => <label key={p} className="check-label"><Checkbox checked={!!meal.portions[p]} onCheckedChange={v => { const portions = { ...meal.portions }; if (v)
        portions[p] = recipe ? scale(recipe.ingredients, 1 / recipe.servings) : [];
    else
        delete portions[p]; setMeal({ ...meal, portions }); if (!v && person === p)
        setPerson(PEOPLE.find(x => x !== p) || 'goncalo'); }}/>{NAMES[p]}</label>)}</div>{!PEOPLE.some(p => meal.portions[p]) && <p className="warning">Seleciona pelo menos uma pessoa.</p>}{!meal.outside && <><Tabs value={person} onValueChange={v => setPerson(v as Person)}><TabsList>{PEOPLE.filter(p => meal.portions[p]).map(p => <TabsTrigger key={p} value={p}>Porção de {NAMES[p]}</TabsTrigger>)}</TabsList></Tabs>{meal.portions[person] && <><Ingredients items={meal.portions[person]!} foods={state.foods} allowAdd={!batch} onChange={items => setMeal({ ...meal, portions: { ...meal.portions, [person]: items } })}/><MacroLine value={nutrition(meal.portions[person]!, state.foods)}/></>}{batch && <p className="note">As compras contam esta preparação uma única vez, no dia {batch.date}. Não podes distribuir mais ingredientes do que os preparados.</p>}{!batch && recipe && <label className="check-label"><Checkbox checked={updateRecipe} onCheckedChange={v => setUpdateRecipe(!!v)}/>Guardar também a porção de {NAMES[person]} como receita base de 1 pessoa</label>}{updateRecipe && <p className="note">As outras refeições já planeadas mantêm as respetivas quantidades.</p>}</>}<Button type="submit" className="primary" disabled={!PEOPLE.some(p => meal.portions[p])}>Guardar refeição</Button></form>;
}
export function RecipeEditor({ state, initial, commit, close }: {
    state: State;
    initial?: Recipe;
    commit: Commit;
    close: () => void;
}) {
    const [r, setR] = useState<Recipe>(initial ? structuredClone(initial) : { id: uid(), name: '', category: 'Almoço', servings: 1, ingredients: [], steps: '', minutes: 15, favorite: false, example: false, tags: [] });
    async function save(e: React.FormEvent) { e.preventDefault(); if (!r.ingredients.length)
        return; if (await commit(s => ({ ...s, recipes: [...s.recipes.filter(x => x.id !== r.id), { ...r, example: false }] }), 'Receita guardada'))
        close(); }
    return <form onSubmit={save} className="form-stack"><DialogTitle>{initial ? 'Editar receita' : 'Criar receita'}</DialogTitle><DialogDescription>Quantidades da receita completa; os macros abaixo são por porção.</DialogDescription><label className="field">Nome<Input required maxLength={150} value={r.name} onChange={e => setR({ ...r, name: e.target.value })} placeholder="Ex.: Arroz de frango com legumes"/></label><div className="two-cols"><Choice label="Categoria" value={r.category} onChange={category => setR({ ...r, category })} options={SLOTS.map(s => ({ value: s, label: s }))}/><NumberField label="Porções da receita" value={r.servings} min={0.1} onChange={servings => setR({ ...r, servings })}/></div><Ingredients foods={state.foods} items={r.ingredients} onChange={ingredients => setR({ ...r, ingredients })}/>{r.servings > 0 && <MacroLine value={nutrition(scale(r.ingredients, 1 / r.servings), state.foods)}/>}<label className="field">Preparação<Textarea value={r.steps} onChange={e => setR({ ...r, steps: e.target.value })} placeholder="Escreve os passos de preparação…" rows={4}/></label><div className="two-cols"><NumberField label="Tempo total (min)" value={r.minutes} onChange={minutes => setR({ ...r, minutes })}/><label className="field">Etiquetas, separadas por vírgulas<Input value={r.tags.join(',')} onChange={e => setR({ ...r, tags: e.target.value.split(',') })}/></label></div><Button type="submit" className="primary" disabled={!r.ingredients.length}>Guardar receita</Button></form>;
}
export function FoodEditor({ initial, commit, close }: {
    initial?: Food;
    commit: Commit;
    close: () => void;
}) {
    const [f, setF] = useState<Food>(initial ? structuredClone(initial) : { id: uid(), name: '', unit: 'g', basis: 100, state: 'tal como vendido', section: 'Mercearia', nutrition: zero(), source: 'Rótulo introduzido pelo utilizador' });
    async function save(e: React.FormEvent) { e.preventDefault(); if (await commit(s => { if (initial && (f.unit !== initial.unit || f.state !== initial.state))
        throw new Error('Cria um novo alimento para mudar a unidade ou o estado.'); return ({ ...s, foods: [...s.foods.filter(x => x.id !== f.id), f] }); }, 'Alimento guardado; valores nutricionais recalculados'))
        close(); }
    return <form onSubmit={save} className="form-stack"><DialogTitle>{initial ? 'Editar alimento' : 'Adicionar alimento'}</DialogTitle><DialogDescription>Transcreve os valores do rótulo. Um produto diferente deve ser um novo alimento.</DialogDescription><label className="field">Nome e marca<Input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex.: Iogurte natural · marca"/></label><div className="two-cols"><Choice label="Unidade" value={f.unit} onChange={unit => setF({ ...f, unit: unit as Food['unit'] })} options={['g', 'ml', 'un'].map(s => ({ value: s, label: s }))}/><NumberField label={`Valores por (${f.unit})`} value={f.basis} min={0.01} onChange={basis => setF({ ...f, basis })}/></div><label className="field">Estado do alimento<Input required value={f.state} onChange={e => setF({ ...f, state: e.target.value })} placeholder="cru, cozinhado, escorrido…"/></label><div className="two-cols">{(['kcal', 'protein', 'carbs', 'fat'] as const).map((key, i) => <NumberField key={key} label={['Calorias (kcal)', 'Proteína (g)', 'Hidratos (g)', 'Gordura (g)'][i]} value={f.nutrition[key]} onChange={v => setF({ ...f, nutrition: { ...f.nutrition, [key]: v } })}/>)}</div><div className="two-cols"><label className="field">Secção do supermercado<Input required value={f.section} onChange={e => setF({ ...f, section: e.target.value })}/></label><NumberField label={`Embalagem (${f.unit}) · 0 = não definida`} value={f.pack || 0} onChange={pack => setF({ ...f, pack: pack || undefined })}/></div><label className="field">Fonte dos valores<Input required value={f.source} onChange={e => setF({ ...f, source: e.target.value })}/></label>{initial && <p className="note">A alteração dos valores nutricionais recalcula também as refeições guardadas com este alimento. Mantém a unidade e o estado; cria outro alimento para pesos crus/cozinhados diferentes.</p>}<Button type="submit" className="primary">Guardar alimento</Button></form>;
}
export function BatchEditor({ state, commit, close }: {
    state: State;
    commit: Commit;
    close: () => void;
}) {
    const [recipeId, setRecipe] = useState(state.recipes[0]?.id || '');
    const [servings, setServings] = useState(4);
    const [date, setDate] = useState(localDate());
    async function save(e: React.FormEvent) { e.preventDefault(); const r = state.recipes.find(x => x.id === recipeId)!; if (await commit(s => ({ ...s, batches: [...s.batches, { id: uid(), name: r.name, date, ingredients: scale(r.ingredients, servings / r.servings) }] }), 'Preparação guardada. Distribui-a nas refeições em «Origem».'))
        close(); }
    return <form onSubmit={save} className="form-stack"><DialogTitle>Preparar para vários dias</DialogTitle><DialogDescription>As compras contam toda a preparação no dia escolhido. Depois, associa as refeições a esta preparação.</DialogDescription><Choice label="Receita" value={recipeId} onChange={setRecipe} options={state.recipes.map(r => ({ value: r.id, label: r.name }))}/><NumberField label="Número total de porções" value={servings} min={0.1} onChange={setServings}/><label className="field">Dia de preparação<Input type="date" required value={date} onChange={e => setDate(e.target.value)}/></label><Button type="submit" className="primary" disabled={!recipeId}>Guardar preparação</Button></form>;
}
