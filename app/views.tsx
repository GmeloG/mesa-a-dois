import { useEffect, useState } from 'react';
import { CalendarDays, ShoppingBasket, Plus, ChevronLeft, ChevronRight, ArrowUpRight, Utensils, Search, Heart, Clock, Copy, Trash2, Flame, SlidersHorizontal, Package, Download, Users, ChefHat, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  type State, type Recipe, type Meal, type Person, type ShoppingRow, type Profile,
  PEOPLE, NAMES, SLOTS, MACRO_KEYS, localDate, monday, plusDay, nutrition, totals, fmt, amount, newMeal, scale, uid,
  exampleWeek, suggested, batchUsage, batchServingsLeft, mealNutrition, mealTotal, weekSummary,
} from '@/lib/model';
import { Choice, NumberField, MacroLine, ingredientText } from './controls';
import type { Commit } from './editors';
import type { Modal, View } from './meal-app';
import type { PlanStore } from '@/lib/store';

export type Ctx = {
  state: State; revision: number; person: Person; setPerson: (p: Person) => void;
  date: string; setDate: (d: string) => void; week: string; changeWeek: (w: string) => void;
  offline: boolean; saving: boolean; commit: Commit; setModal: (m: Modal) => void;
  setConfirm: (c: { title: string; description: string; run: () => void } | null) => void;
  removeWithUndo: <T extends { id: string }>(title: string, description: string, key: 'meals' | 'recipes' | 'manual' | 'batches', item: T, guard?: (s: State) => void) => void;
  addMeal: (slot?: string, onDate?: string, recipe?: Recipe) => void; navigate: (v: View) => void;
  rows: ShoppingRow[]; outstanding: number; from: string; to: string; setFrom: (d: string) => void; setTo: (d: string) => void;
  store: PlanStore; onExit: () => Promise<void>; install: () => void; local: boolean;
};
export const dateLabel = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) => new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', opts);
const MACRO_NAMES = ['Calorias', 'Proteína', 'Hidratos de carbono', 'Gordura'];
const SLOT_TIMES = ['07:30', '10:30', '13:00', '16:30', '20:00', 'Opcional'];
const weekDays = (week: string) => Array.from({ length: 7 }, (_, i) => plusDay(week, i));
const unitOf = (key: string) => key === 'kcal' ? 'kcal' : 'g';

export function WeekToolbar({ ctx }: { ctx: Ctx }) {
  const { state, week, date, setDate, changeWeek, offline, commit, setConfirm } = ctx;
  const duplicateWeek = () => {
    const target = plusDay(week, 7);
    setConfirm({ title: 'Duplicar para a semana seguinte?', description: `Copiar refeições e preparações para a semana de ${dateLabel(target)}. Só é possível se essa semana estiver vazia.`, run: () => {
      commit(s => {
        if (s.meals.some(m => m.date >= target && m.date <= plusDay(target, 6))) throw new Error('A semana seguinte já tem refeições.');
        const source = s.meals.filter(m => m.date >= week && m.date <= plusDay(week, 6));
        const batchIds = new Set(source.map(m => m.batchId).filter(Boolean));
        const batches = s.batches.filter(b => batchIds.has(b.id) || (b.date >= week && b.date <= plusDay(week, 6)));
        const map = new Map(batches.map(b => [b.id, uid()]));
        return { ...s,
          batches: [...s.batches, ...batches.map(b => ({ ...b, id: map.get(b.id)!, date: plusDay(b.date, 7) }))],
          meals: [...s.meals, ...source.map(m => { const copy: Meal = { ...structuredClone(m), id: uid(), date: plusDay(m.date, 7) }; if (m.batchId) copy.batchId = map.get(m.batchId); return copy; })] };
      }, 'Semana duplicada').then(ok => { if (ok) changeWeek(target); });
    } });
  };
  return <>
    <div className="week-toolbar">
      <div className="week-select">
        <Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => changeWeek(plusDay(week, -7))}><ChevronLeft /></Button>
        <strong>{dateLabel(week, { day: 'numeric', month: 'short' })} – {dateLabel(plusDay(week, 6), { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
        <Button variant="ghost" size="icon" aria-label="Semana seguinte" onClick={() => changeWeek(plusDay(week, 7))}><ChevronRight /></Button>
        <Button variant="ghost" className="back-today" onClick={() => { changeWeek(monday(localDate())); setDate(localDate()); }}>Hoje</Button>
      </div>
      <Button variant="outline" onClick={duplicateWeek} disabled={offline}><Copy size={16} />Duplicar semana</Button>
    </div>
    <div className="day-rail">{weekDays(week).map(d => <button key={d} className={`day-button ${d === date ? 'selected' : ''} ${d === localDate() ? 'is-today' : ''}`} onClick={() => setDate(d)} aria-pressed={d === date}>
      <span>{dateLabel(d, { weekday: 'short' }).replace('.', '').slice(0, 3)}</span><strong>{dateLabel(d, { day: 'numeric' })}</strong><small>{state.meals.filter(m => m.date === d).length} ref.</small>
    </button>)}</div>
  </>;
}

/** Totais do dia: resumo dos dois e detalhe da pessoa escolhida. */
export function NutritionPanel({ ctx }: { ctx: Ctx }) {
  const { state, date, person, setPerson, navigate } = ctx;
  const dayTotals = totals(state, date, person);
  const goals = state.profiles[person].goals;
  return <>
    <div className="people-summary">{PEOPLE.map(p => {
      const t = totals(state, date, p); const goal = state.profiles[p].goals.kcal;
      return <button key={p} className={`person-total ${p === person ? 'active' : ''}`} onClick={() => setPerson(p)} aria-pressed={p === person}>
        <span className={`tiny-avatar ${p}`}>{NAMES[p][0]}</span>
        <span><strong>{NAMES[p]}</strong><small>{t.missing.length ? '≥ ' : ''}{fmt(t.kcal)} {goal ? `/ ${fmt(goal)} ` : ''}kcal{t.missing.length ? ' · incompleto' : ''}</small></span>
      </button>;
    })}</div>
    <div className="nutrition-heading"><h2>Resumo nutricional <span>· {dateLabel(date, { day: 'numeric', month: 'short' })}</span></h2>
      <Tabs value={person} onValueChange={v => setPerson(v as Person)}><TabsList className="person-tabs">{PEOPLE.map(p => <TabsTrigger key={p} value={p}><span className={`tiny-avatar ${p}`}>{NAMES[p][0]}</span>{NAMES[p]}</TabsTrigger>)}</TabsList></Tabs>
    </div>
    <div className="macro-cards">{MACRO_KEYS.map((key, i) => <div className={`macro-card macro-${key}`} key={key}>
      <div className="macro-label"><span>{MACRO_NAMES[i]}</span>{i === 0 ? <Flame size={18} /> : <span className="macro-symbol">{['', 'P', 'HC', 'G'][i]}</span>}</div>
      <div className="macro-value">{dayTotals.missing.length ? '≥' : ''}{fmt(dayTotals[key], i ? 1 : 0)}<small>{unitOf(key)}</small></div>
      <Progress value={goals[key] > 0 ? Math.min(100, dayTotals[key] / goals[key] * 100) : 0} />
      <small>{goals[key] > 0 ? `de ${fmt(goals[key])} ${unitOf(key)} · ${dayTotals[key] > goals[key] ? `${fmt(dayTotals[key] - goals[key])} acima` : `${fmt(goals[key] - dayTotals[key])} em falta`}` : <button className="text-link" onClick={() => navigate('profiles')}>Definir objetivo diário</button>}</small>
    </div>)}</div>
    <p className="nutrition-note">Totais planeados para {NAMES[person]}.{dayTotals.estimated ? ' Inclui valores de exemplo estimados.' : ''}{dayTotals.missing.length ? ` Sem dados nutricionais: ${dayTotals.missing.join(', ')} — o total real é superior.` : ''}</p>
  </>;
}

function MealCard({ meal, ctx }: { meal: Meal; ctx: Ctx }) {
  const { state, person, setModal, removeWithUndo, offline } = ctx;
  const items = meal.portions[person];
  const people = PEOPLE.filter(p => meal.portions[p]);
  const total = mealTotal(meal);
  const title = meal.outside ? `Fora de casa${meal.name && meal.name !== state.recipes.find(r => r.id === meal.recipeId)?.name ? ` · ${meal.name}` : ''}` : meal.name;
  const edit = () => setModal({ type: 'meal', meal });
  return <article className="meal-card">
    <div className="meal-card-main">
      <div className={`meal-marker ${meal.outside ? 'outside' : ''}`}><Utensils size={20} /></div>
      <div className="meal-card-text">
        <button className="meal-title" onClick={edit}>{title}</button>
        <div className="meal-people">{people.map(p => <span key={p} className={p}>{NAMES[p]} · <MacroInline value={mealNutrition(meal, p, state.foods)} /></span>)}{meal.batchId && <span>Da preparação</span>}</div>
        {meal.outside ? <p className="note">Excluída das compras.</p> : items ? <>
          <p className="ingredient-summary">{ingredientText(items, state.foods)}</p>
          <MacroLine value={nutrition(items, state.foods)} />
          {people.length > 1 && <p className="prepare-total"><strong>Total a preparar:</strong> {ingredientText(total, state.foods)}</p>}
        </> : <p className="note">Não planeada para {NAMES[person]}.</p>}
      </div>
    </div>
    <div className="meal-actions">
      <Button variant="ghost" size="icon" aria-label={`Editar ou mover ${meal.name}`} onClick={edit} disabled={offline}><SlidersHorizontal size={16} /></Button>
      <Button variant="ghost" size="icon" aria-label={`Copiar ${meal.name} para outro dia`} disabled={offline} onClick={() => { const copy: Meal = { ...structuredClone(meal), id: uid(), date: plusDay(meal.date, 1) }; delete copy.batchId; setModal({ type: 'meal', meal: copy }); }}><Copy size={16} /></Button>
      <Button variant="ghost" size="icon" aria-label={`Remover ${meal.name}`} disabled={offline} onClick={() => removeWithUndo('Remover esta refeição?', 'As quantidades saem do plano e das compras. Podes desfazer logo a seguir.', 'meals', meal)}><Trash2 size={16} /></Button>
    </div>
  </article>;
}
function MacroInline({ value }: { value: ReturnType<typeof mealNutrition> }) {
  if (!value) return null;
  if (value.missing.length && value.kcal === 0) return <>? kcal</>;
  return <>{value.missing.length ? '≥' : ''}{fmt(value.kcal)} kcal</>;
}

export function TodayView({ ctx }: { ctx: Ctx }) {
  const { state, date, week, offline, commit, addMeal, navigate, outstanding } = ctx;
  const dayMeals = state.meals.filter(m => m.date === date);
  const nextSlot = SLOTS.slice(0, 5).find(s => !dayMeals.some(m => m.slot === s)) || 'Almoço';
  const suggestions = suggested(state, nextSlot, PEOPLE, week, plusDay(week, 6));
  return <div className="today-grid">
    <section className="meal-list">
      <div className="section-heading"><h2>À mesa</h2><span>{dayMeals.length} refeições planeadas</span></div>
      {!dayMeals.length && <div className="empty-plan"><CalendarDays /><h3>O dia está por planear.</h3><p>Escolhe uma receita ou começa com uma semana de exemplo editável.</p>
        <div className="button-row"><Button className="primary" onClick={() => addMeal()} disabled={offline}>Escolher refeição</Button><Button variant="outline" disabled={offline} onClick={() => commit(s => exampleWeek(s, week), 'Semana de exemplo adicionada — ajusta as porções e as metas.')}>Usar semana de exemplo</Button></div>
        <small>As porções de exemplo não são recomendações nutricionais.</small></div>}
      {SLOTS.map((slot, index) => {
        const meals = dayMeals.filter(m => m.slot === slot);
        return <div className="meal-slot" key={slot}>
          <div className="slot-label"><span className="slot-number">{String(index + 1).padStart(2, '0')}</span>{slot}<span className="slot-time">{SLOT_TIMES[index]}</span></div>
          {meals.map(m => <MealCard key={m.id} meal={m} ctx={ctx} />)}
          {!meals.length ? <button className="add-slot" onClick={() => addMeal(slot)} disabled={offline}><Plus size={17} />{slot === 'Ceia' ? 'Adicionar ceia, se fizer sentido' : 'Escolher refeição'}</button>
            : <button className="text-link slot-extra" onClick={() => addMeal(slot)} disabled={offline}>+ Outra refeição neste horário (ex.: diferente para cada um)</button>}
        </div>;
      })}
    </section>
    <aside className="right-column">
      <button className="shopping-summary" onClick={() => navigate('shopping')}><div className="shopping-icon"><ShoppingBasket /></div><div><h3>Lista de compras</h3><p>{outstanding ? `${outstanding} artigos por comprar esta semana` : 'Nada em falta para esta semana'}</p></div><ArrowUpRight size={20} /></button>
      <div className="suggestions">
        <div className="section-heading"><h2>Sugestões · {nextSlot}</h2><ChefHat size={20} /></div>
        <p className="note">Sugestões baseadas em regras, a partir da vossa biblioteca: categoria, preferências, alimentos a evitar, despensa e variedade. Nada é adicionado sem confirmares.</p>
        {suggestions.length === 0 && <p className="note">Sem receitas compatíveis. Revê os alimentos a evitar ou cria uma receita.</p>}
        {suggestions.slice(0, 3).map(r => <button className="suggestion" key={r.id} onClick={() => addMeal(nextSlot, date, r)} disabled={offline}><div><strong>{r.name}</strong><small>{r.category} · {r.minutes} min · <MacroInline value={nutrition(scale(r.ingredients, 1 / r.servings), state.foods)} /> / porção</small></div><Plus size={18} /></button>)}
      </div>
      <div className="inspiration"><img src={`${import.meta.env.BASE_URL}meal.jpg`} alt="Taça de arroz com frango e legumes, imagem ilustrativa" loading="lazy" /><div className="inspiration-caption"><span>PARA A VOSSA PRÓXIMA REFEIÇÃO</span><h3>Um prato cheio de boas ideias.</h3></div></div>
    </aside>
  </div>;
}

export function WeekView({ ctx }: { ctx: Ctx }) {
  const { state, week, date, setDate, person, offline, commit, addMeal, setModal } = ctx;
  return <>
    <section className="week-summary"><div className="section-heading"><h2>Resumo semanal</h2><span>{dateLabel(week, { day: 'numeric', month: 'short' })} – {dateLabel(plusDay(week, 6), { day: 'numeric', month: 'short' })}</span></div>
      <div className="week-summary-grid">{PEOPLE.map(p => {
        const w = weekSummary(state, week, p); const g = state.profiles[p].goals;
        return <div key={p} className="week-person"><div className="profile-title"><span className={`profile-avatar ${p}`}>{NAMES[p][0]}</span><div><h3>{NAMES[p]}</h3><p>{w.plannedDays} de 7 dias planeados</p></div></div>
          <table><thead><tr><th></th><th>Semana</th><th>Média/dia</th><th>Objetivo/dia</th></tr></thead><tbody>{MACRO_KEYS.map((k, i) => <tr key={k}><th>{MACRO_NAMES[i]}</th><td>{w.total.missing.length ? '≥' : ''}{fmt(w.total[k])} {unitOf(k)}</td><td>{fmt(w.average[k])} {unitOf(k)}</td><td>{g[k] ? `${fmt(g[k])} ${unitOf(k)}` : '—'}</td></tr>)}</tbody></table>
          {w.total.missing.length > 0 && <p className="warning">Incompleto: sem dados para {w.total.missing.join(', ')}.</p>}
        </div>;
      })}</div>
    </section>
    <div className="section-heading"><h2>Plano da semana</h2><Button variant="outline" onClick={() => commit(s => exampleWeek(s, week), 'Espaços vazios preenchidos com exemplos editáveis.')} disabled={offline}>Preencher vazios com exemplos</Button></div>
    <div className="weekly-grid">{weekDays(week).map(d => <section className={`week-day ${d === date ? 'active' : ''}`} key={d}>
      <button className="week-day-title" onClick={() => setDate(d)}><strong>{dateLabel(d, { weekday: 'long' })}</strong><span>{dateLabel(d, { day: 'numeric', month: 'short' })}</span></button>
      {SLOTS.map(slot => <div key={slot} className="weekly-slot"><small>{slot}</small>
        {state.meals.filter(m => m.date === d && m.slot === slot).map(m => <button key={m.id} onClick={() => setModal({ type: 'meal', meal: m })} className="weekly-meal">
          <strong>{m.outside ? 'Fora de casa' : m.name}</strong><span>{PEOPLE.filter(p => m.portions[p]).map(p => NAMES[p]).join(' + ')}</span>
          {m.portions[person] && <small><MacroInline value={mealNutrition(m, person, state.foods)} /> · {NAMES[person]}</small>}
        </button>)}
        <button className="week-add" aria-label={`Adicionar ${slot} em ${dateLabel(d)}`} onClick={() => addMeal(slot, d)} disabled={offline}><Plus size={16} /></button>
      </div>)}
      <div className="week-total"><MacroInline value={totals(state, d, person)} /><small>{NAMES[person]}</small></div>
    </section>)}</div>
  </>;
}

export function RecipesView({ ctx }: { ctx: Ctx }) {
  const { state, date, offline, commit, setModal, removeWithUndo, addMeal } = ctx;
  const [tab, setTab] = useState('recipes');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const q = search.trim().toLowerCase();
  const foodName = (id: string) => state.foods.find(f => f.id === id)?.name.toLowerCase() || '';
  const recipes = state.recipes
    .filter(r => !q || r.name.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q)) || r.ingredients.some(i => foodName(i.foodId).includes(q)))
    .filter(r => category === 'all' || (category === 'favorites' && r.favorite) || r.category === category)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'pt'));
  return <>
    <div className="recipe-toolbar">
      <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="recipes">Receitas</TabsTrigger><TabsTrigger value="foods">Alimentos</TabsTrigger><TabsTrigger value="batches">Preparações</TabsTrigger></TabsList></Tabs>
      <div className="search-box"><Search size={18} /><Input aria-label="Pesquisar" placeholder={tab === 'foods' ? 'Pesquisar alimentos…' : 'Pesquisar receitas ou ingredientes…'} value={search} onChange={e => setSearch(e.target.value)} /></div>
    </div>
    {tab === 'recipes' && <>
      <div className="recipe-build"><Sparkles size={28} /><div><h3>Uma ideia com o que há em casa?</h3><p>Escolhe ingredientes e recebe uma proposta com quantidades e passos, gerada por regras simples. Revês e editas antes de guardar ou planear.</p></div>
        <div className="button-row"><Button variant="outline" onClick={() => setModal({ type: 'proposal' })} disabled={offline}>A partir de ingredientes</Button><Button variant="ghost" onClick={() => setModal({ type: 'recipe' })} disabled={offline}>Criar manualmente</Button></div></div>
      <div className="filter-row"><Choice label="Mostrar" value={category} onChange={setCategory} options={[{ value: 'all', label: 'Todas as refeições' }, { value: 'favorites', label: 'Favoritas' }, ...SLOTS.map(s => ({ value: s, label: s }))]} /><p className="note">P = proteína · HC = hidratos · G = gordura. Ajusta a porção de cada pessoa ao planear.</p></div>
      {recipes.length === 0 && <div className="empty-plan"><Search /><h3>Nenhuma receita encontrada.</h3><p>Muda a pesquisa ou o filtro.</p></div>}
      <div className="recipe-grid">{recipes.map(r => <article className="recipe-card" key={r.id}>
        <div className="recipe-card-top"><span className="recipe-category">{r.category}</span><Button variant="ghost" size="icon" aria-pressed={r.favorite} aria-label={`${r.favorite ? 'Retirar' : 'Marcar'} ${r.name} ${r.favorite ? 'das' : 'como'} favorita${r.favorite ? 's' : ''}`} disabled={offline} onClick={() => commit(s => ({ ...s, recipes: s.recipes.map(x => x.id === r.id ? { ...x, favorite: !x.favorite } : x) }))}><Heart size={18} fill={r.favorite ? '#087e70' : 'none'} /></Button></div>
        <h3>{r.name}</h3>
        <div className="recipe-meta"><span><Clock size={14} />{r.minutes} min</span><span><Users size={14} />{fmt(r.servings, 2)} {r.servings === 1 ? 'porção' : 'porções'}</span>{r.example && <span className="example-badge">Exemplo</span>}</div>
        <small className="muted">Por porção</small><MacroLine value={nutrition(scale(r.ingredients, 1 / r.servings), state.foods)} />
        {r.servings !== 1 && <><small className="muted">Receita completa</small><MacroLine compact value={nutrition(r.ingredients, state.foods)} /></>}
        <div className="recipe-tags">{r.tags.map((t, i) => <span key={i}>{t}</span>)}</div>
        <details><summary>Ingredientes e preparação</summary><ul>{r.ingredients.map(i => { const f = state.foods.find(f => f.id === i.foodId); return <li key={i.foodId}>{f ? <>{amount(i.quantity, f.unit)} de {f.name.toLowerCase()} <small>({f.state})</small></> : 'Alimento removido'}</li>; })}</ul><p className="steps">{r.steps || 'Sem passos de preparação.'}</p></details>
        <div className="recipe-actions">
          <Button className="primary" onClick={() => addMeal(r.category, date, r)} disabled={offline}><Plus size={16} />Planear</Button>
          <Button variant="outline" onClick={() => setModal({ type: 'recipe', recipe: r })} disabled={offline}>Editar</Button>
          <Button variant="ghost" size="icon" aria-label={`Eliminar receita ${r.name}`} disabled={offline} onClick={() => removeWithUndo('Eliminar esta receita?', 'As refeições já planeadas mantêm as suas quantidades. Podes desfazer logo a seguir.', 'recipes', r)}><Trash2 size={16} /></Button>
        </div>
      </article>)}</div>
    </>}
    {tab === 'foods' && <>
      <div className="section-heading"><p className="notice">Os valores iniciais são estimativas genéricas («≈»). Substitui-os pelos rótulos dos teus produtos. Pesos crus e cozinhados são alimentos distintos.</p><Button className="primary" onClick={() => setModal({ type: 'food' })} disabled={offline}><Plus size={17} />Novo alimento</Button></div>
      <div className="food-list">{state.foods.filter(f => `${f.name} ${f.brand || ''}`.toLowerCase().includes(q)).sort((a, b) => a.section.localeCompare(b.section, 'pt') || a.name.localeCompare(b.name, 'pt')).map(f => <button className="food-row" key={f.id} onClick={() => setModal({ type: 'food', food: f })} disabled={offline}>
        <div><strong>{f.name}{f.brand ? ` · ${f.brand}` : ''}</strong><small>{f.state} · por {amount(f.basis, f.unit)} · {f.section}{f.pack ? ` · embalagem ${amount(f.pack, f.unit)}` : ''}</small><small>{f.estimated ? 'Estimado · ' : ''}{f.source}</small></div>
        {f.nutrition ? <MacroLine value={{ ...f.nutrition, missing: [], estimated: !!f.estimated }} /> : <MacroLine value={null} />}<SlidersHorizontal size={18} />
      </button>)}</div>
    </>}
    {tab === 'batches' && <BatchesTab ctx={ctx} />}
  </>;
}

function BatchesTab({ ctx }: { ctx: Ctx }) {
  const { state, offline, setModal, removeWithUndo } = ctx;
  return <>
    <div className="section-heading"><p className="note">Prepara uma vez, distribui as porções pelo plano. As compras contam os ingredientes só no dia da preparação.</p><Button className="primary" onClick={() => setModal({ type: 'batch' })} disabled={offline || !state.recipes.length}><Plus size={17} />Nova preparação</Button></div>
    {state.batches.length === 0 ? <div className="empty-plan"><Package /><h3>Ainda não há preparações.</h3><p>Prepara uma receita para vários dias e associa cada refeição em «Origem».</p></div>
      : [...state.batches].sort((a, b) => b.date.localeCompare(a.date)).map(b => {
        const usage = batchUsage(state, b); const left = batchServingsLeft(state, b);
        const recipe = state.recipes.find(r => r.id === b.recipeId) || state.recipes.find(r => r.name === b.name);
        return <article className="batch-card" key={b.id}>
          <div className="section-heading"><div><h3>{b.name}</h3><p>{dateLabel(b.date)} · {b.servings ? `${fmt(b.servings, 2)} porções · ` : ''}{state.meals.filter(m => m.batchId === b.id).length} refeições associadas{left !== null ? ` · ${fmt(left, 1)} porções disponíveis` : ''}</p></div>
            <Button variant="ghost" size="icon" aria-label={`Eliminar preparação ${b.name}`} disabled={offline} onClick={() => removeWithUndo('Eliminar preparação?', 'Só é possível eliminar uma preparação sem refeições associadas.', 'batches', b, s => { if (s.meals.some(m => m.batchId === b.id)) throw new Error('Remove primeiro a associação nas refeições.'); })}><Trash2 size={17} /></Button></div>
          <table className="batch-table"><thead><tr><th>Ingrediente</th><th>Preparado</th><th>Reservado</th><th>Disponível</th></tr></thead><tbody>{usage.map(u => { const f = state.foods.find(f => f.id === u.foodId); return f && <tr key={u.foodId}><td>{f.name}</td><td>{amount(u.prepared, f.unit)}</td><td>{amount(u.reserved, f.unit)}</td><td className={u.available <= 0.001 ? 'muted' : ''}>{amount(Math.max(0, u.available), f.unit)}</td></tr>; })}</tbody></table>
          <Button variant="outline" disabled={offline || (left !== null && left <= 0.001)} onClick={() => {
            if (!recipe) { toast.error('A receita original já não existe. Cria uma refeição e escolhe esta preparação em «Origem».'); return; }
            const perServing = scale(b.ingredients, 1 / (b.servings || recipe.servings));
            const meal = newMeal(recipe, b.date, recipe.category);
            setModal({ type: 'meal', meal: { ...meal, name: b.name, batchId: b.id, portions: Object.fromEntries(PEOPLE.map(p => [p, structuredClone(perServing)])) } });
          }}>Distribuir no plano</Button>
        </article>;
      })}
  </>;
}

export function ShoppingView({ ctx }: { ctx: Ctx }) {
  const { state, rows, outstanding, from, to, setFrom, setTo, week, offline, saving, commit, setModal, navigate, removeWithUndo } = ctx;
  const sections = [...new Set(rows.map(r => r.food.section))];
  return <>
    <div className="shopping-toolbar">
      <div className="two-cols">
        <label className="field">De<Input type="date" value={from} max={to} onChange={e => { if (e.target.value) setFrom(e.target.value); }} /></label>
        <label className="field">Até<Input type="date" value={to} min={from} onChange={e => { if (e.target.value) setTo(e.target.value); }} /></label>
      </div>
      <div className="button-row range-shortcuts"><Button variant="ghost" onClick={() => { setFrom(week); setTo(plusDay(week, 6)); }}>Semana</Button><Button variant="ghost" onClick={() => { setFrom(localDate()); setTo(plusDay(localDate(), 2)); }}>Próximos 3 dias</Button></div>
      <div className="shopping-count"><strong>{outstanding}</strong><span>artigos por comprar</span></div>
    </div>
    <p className="note">Inclui todas as refeições e lanches do intervalo (exceto fora de casa). O que existe em casa é descontado uma única vez no intervalo. As preparações contam no dia em que são feitas. Marcar como comprado não altera a despensa.</p>
    {rows.length === 0 && <div className="empty-plan"><ShoppingBasket /><h3>A lista começa no vosso plano.</h3><p>Adiciona refeições neste intervalo para calcular os ingredientes.</p><Button onClick={() => navigate('week')}>Abrir plano semanal</Button></div>}
    {sections.map(section => <section className="shopping-section" key={section}><h2>{section}<span>{rows.filter(r => r.food.section === section).length} artigos</span></h2>
      {rows.filter(r => r.food.section === section).map(row => <ShoppingItem key={`${from}:${to}:${row.food.id}`} row={row} disabled={offline || saving}
        saveStock={value => commit(s => { const pantry = { ...s.pantry }; if (value > 0) pantry[row.food.id] = value; else delete pantry[row.food.id]; return { ...s, pantry }; }, 'Quantidade em casa atualizada')}
        toggle={() => commit(s => { const purchased = { ...s.purchased }; const key = `${from}:${to}:${row.food.id}`; if (row.checked) delete purchased[key]; else purchased[key] = row.missing; return { ...s, purchased }; })}
        edit={() => setModal({ type: 'food', food: row.food })} />)}
    </section>)}
    {state.manual.length > 0 && <section className="shopping-section"><h2>Outros artigos<span>{state.manual.length} artigos</span></h2>
      {state.manual.map(m => <div className="manual-row" key={m.id}>
        <Checkbox aria-label={`Comprado: ${m.name}`} checked={m.checked} disabled={offline || saving} onCheckedChange={() => commit(s => ({ ...s, manual: s.manual.map(x => x.id === m.id ? { ...x, checked: !x.checked } : x) }))} />
        <strong className={m.checked ? 'crossed' : ''}>{m.name}</strong><span>{m.quantity}</span>
        <Button variant="ghost" size="icon" aria-label={`Remover artigo ${m.name}`} disabled={offline} onClick={() => removeWithUndo('Remover artigo?', `«${m.name}» sai da lista. Podes desfazer logo a seguir.`, 'manual', m)}><Trash2 size={16} /></Button>
      </div>)}
    </section>}
  </>;
}

function ShoppingItem({ row, disabled, saveStock, toggle, edit }: { row: ShoppingRow; disabled: boolean; saveStock: (n: number) => Promise<boolean>; toggle: () => void; edit: () => void }) {
  const [stock, setStock] = useState(row.stock);
  useEffect(() => setStock(row.stock), [row.stock]);
  const u = row.food.unit;
  return <div className={`shopping-row ${row.checked ? 'is-checked' : ''}`}>
    <div className="shopping-main">
      <Checkbox aria-label={`Comprado: ${row.food.name}`} checked={row.checked} disabled={disabled || row.missing === 0} onCheckedChange={toggle} />
      <div className="shopping-name"><strong>{row.food.name}{row.food.brand ? ` · ${row.food.brand}` : ''}</strong>
        <small>{row.food.state} · necessário {amount(row.required, u)}{row.stock > 0 ? ` · em casa ${amount(row.stock, u)}` : ''}</small>
        {row.packages !== null && row.missing > 0 && <small>{row.packages} × {amount(row.food.pack!, u)} · sobra {amount(row.leftover, u)}</small>}
        {row.changed && <span className="warning">A quantidade mudou depois de marcares como comprado.</span>}</div>
      <div className="shopping-amount"><strong>{row.missing === 0 ? 'Em casa' : amount(row.missing, u)}</strong><small>{row.missing > 0 ? 'em falta' : 'não é preciso comprar'}</small></div>
    </div>
    <details><summary>Despensa, embalagens e origem</summary>
      <dl className="shopping-breakdown"><div><dt>Necessário</dt><dd>{amount(row.required, u)}</dd></div><div><dt>Em casa</dt><dd>{amount(row.stock, u)}</dd></div><div><dt>Em falta</dt><dd>{amount(row.missing, u)}</dd></div>
        <div><dt>Embalagens</dt><dd>{row.packages === null ? 'tamanho não definido' : `${row.packages} × ${amount(row.food.pack!, u)}`}</dd></div>{row.packages !== null && <div><dt>Sobra prevista</dt><dd>{amount(row.leftover, u)}</dd></div>}</dl>
      <div className="stock-controls"><NumberField label={`Já existe em casa (${u})`} required={false} value={stock} onChange={setStock} /><Button variant="outline" disabled={disabled || stock === row.stock} onClick={() => saveStock(stock)}>Guardar</Button><Button variant="ghost" onClick={edit} disabled={disabled}>Definir embalagem</Button></div>
      <ul className="source-list">{row.sources.map(s => <li key={s.label}>{s.label} — {amount(s.quantity, u)}</li>)}</ul>
    </details>
  </div>;
}

export function ProfilesView({ ctx }: { ctx: Ctx }) {
  const { state, commit, store, onExit, install, local, offline } = ctx;
  return <>
    <div className="profiles-grid">{PEOPLE.map(p => <ProfileCard key={p} person={p} saved={state.profiles[p]} commit={commit} offline={offline} />)}</div>
    <div className="settings-card"><div><h2>No vosso telemóvel</h2><p>Instala a aplicação para a abrir a partir do ecrã inicial. Sem ligação, podes consultar a última cópia sincronizada neste dispositivo; para guardar é preciso ligação.</p></div><Button variant="outline" onClick={install}><Download size={16} />Como instalar</Button><Button variant="ghost" onClick={() => { store.clearCache(); toast.success('Cópia offline removida deste dispositivo.'); }}>Apagar cópia offline</Button></div>
    <div className="settings-card"><div><h2>{local ? 'Demonstração' : 'Conta ligada'}</h2><p>{store.identity}</p></div><Button variant="outline" onClick={onExit}>{local ? 'Sair da demonstração' : 'Terminar sessão'}</Button></div>
    <div className="notice">{local ? 'Demonstração: dados de exemplo guardados apenas neste dispositivo. Para partilhar o plano, sai da demonstração e inicia sessão numa conta autorizada.' : 'O plano é partilhado entre as duas contas autorizadas e sincroniza automaticamente enquanto há ligação. Se o outro dispositivo guardar primeiro, a tua alteração não é sobreposta: o plano é atualizado e pedimos que a repitas.'}</div>
  </>;
}

function ProfileCard({ person, saved, commit, offline }: { person: Person; saved: Profile; commit: Commit; offline: boolean }) {
  const [profile, setProfile] = useState(() => structuredClone(saved));
  const [dirty, setDirty] = useState(false);
  // Atualiza com alterações feitas no outro dispositivo, se não houver edição em curso.
  useEffect(() => { if (!dirty) setProfile(structuredClone(saved)); }, [saved, dirty]);
  const change = (p: Profile) => { setProfile(p); setDirty(true); };
  return <form className="profile-card" onSubmit={async e => { e.preventDefault(); if (await commit(s => ({ ...s, profiles: { ...s.profiles, [person]: profile } }), `Perfil de ${NAMES[person]} guardado`)) setDirty(false); }}>
    <div className="profile-title"><span className={`profile-avatar ${person}`}>{NAMES[person][0]}</span><div><h2>{NAMES[person]}</h2><p>Objetivos diários</p></div></div>
    <p className="note">Introduz as tuas metas. Nada é calculado automaticamente; vazio = objetivo por definir.</p>
    <div className="two-cols">{MACRO_KEYS.map((key, i) => <NumberField key={key} required={false} label={['Calorias (kcal)', 'Proteína (g)', 'Hidratos (g)', 'Gordura (g)'][i]} value={profile.goals[key]} onChange={v => change({ ...profile, goals: { ...profile.goals, [key]: v } })} />)}</div>
    <label className="field">Alimentos a evitar<Textarea value={profile.avoid} placeholder="Ex.: atum, nozes · separados por vírgulas" onChange={e => change({ ...profile, avoid: e.target.value })} /></label>
    <label className="field">Preferências<Textarea value={profile.preferences} placeholder="Ex.: rápida, forno, frango" onChange={e => change({ ...profile, preferences: e.target.value })} /></label>
    <p className="note">As sugestões excluem receitas com ingredientes a evitar (pelo nome). Confirma sempre os rótulos em caso de alergia.</p>
    <div className="button-row"><Button type="submit" className="primary" disabled={offline || !dirty}>Guardar perfil</Button>{dirty && <Button type="button" variant="ghost" onClick={() => { setProfile(structuredClone(saved)); setDirty(false); }}>Cancelar</Button>}</div>
  </form>;
}
