'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Sun, BookOpen, ShoppingBasket, Settings2, Plus, ChevronLeft, ChevronRight, ArrowUpRight, Utensils, Check, CloudCheck, WifiOff, RefreshCw, Search, Heart, Clock, Copy, Trash2, Flame, SlidersHorizontal, Package, Download, Users, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Toaster, toast } from 'sonner';
import { State, Recipe, Meal, Food, Person, PEOPLE, NAMES, SLOTS, Macros, ShoppingRow, initialState, localDate, monday, plusDay, nutrition, totals, shopping, fmt, amount, newMeal, scale, uid, exampleWeek, suggested, batchRemaining, validateState } from '@/lib/model';
import { Choice, NumberField, MacroLine } from './controls';
import { MealEditor, RecipeEditor, FoodEditor, BatchEditor, Commit } from './editors';
import { ConflictError, type PlanStore, type Snapshot } from '@/lib/store';
import { firebaseMessage } from '@/lib/firebase-store';
type View = 'today' | 'week' | 'recipes' | 'shopping' | 'profiles';
type Modal = {
    type: 'meal';
    meal: Meal;
} | {
    type: 'recipe';
    recipe?: Recipe;
} | {
    type: 'food';
    food?: Food;
} | {
    type: 'batch';
} | {
    type: 'manual';
} | null;
const nav = [{ id: 'today', name: 'Hoje', icon: Sun }, { id: 'week', name: 'Plano semanal', icon: CalendarDays }, { id: 'recipes', name: 'Receitas', icon: BookOpen }, { id: 'shopping', name: 'Compras', icon: ShoppingBasket }, { id: 'profiles', name: 'Perfis', icon: Settings2 }] as const;
const dateLabel = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) => new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', opts);
export default function MealApp({store,onExit}:{store:PlanStore;onExit:()=>Promise<void>}) {
    const [state, setState] = useState<State>(initialState);
    const [loaded, setLoaded] = useState(false);
    const [status, setStatus] = useState('A abrir o plano…');
    const [offline, setOffline] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const local = store.mode === 'demo';
    const [view, setView] = useState<View>('today');
    const [date, setDate] = useState(localDate);
    const [week, setWeek] = useState(() => monday(localDate()));
    const [person, setPerson] = useState<Person>('goncalo');
    const [modal, setModal] = useState<Modal>(null);
    const [confirm, setConfirm] = useState<{
        title: string;
        description: string;
        run: () => void;
    } | null>(null);
    const [search, setSearch] = useState('');
    const [recipeTab, setRecipeTab] = useState('recipes');
    const [category, setCategory] = useState('all');
    const [from, setFrom] = useState(week);
    const [to, setTo] = useState(plusDay(week, 6));
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const ref = useRef(state);
    const rev = useRef(0);
    const lock = useRef(false);
    const modalRef = useRef(modal);
    modalRef.current = modal;
    const loadedRef = useRef(false);
    const pending = useRef<Snapshot | null>(null);
    const applySnapshot = useCallback((data: Snapshot) => {
        if (data.revision < rev.current) return;
        ref.current = data.state; rev.current = data.revision; setState(data.state);
        setLoaded(true); loadedRef.current = true; setOffline(!!data.cached || !navigator.onLine);
        setLoadError('');
        setStatus(data.cached ? `Cópia offline de ${new Date(data.updatedAt).toLocaleString('pt-PT')}` : `${local ? 'Demonstração guardada' : 'Sincronizado'} às ${new Date(data.updatedAt).toLocaleTimeString('pt-PT', {hour:'2-digit',minute:'2-digit'})}`);
    }, [local]);
    const load = useCallback(async (silent = false) => {
        if (lock.current) return;
        try { const data = await store.load(); if (!lock.current) applySnapshot(data); }
        catch(error) {
            if (!navigator.onLine) { const cached = store.cached(); if (cached) { applySnapshot({...cached,cached:true}); return; } }
            const message = firebaseMessage(error); setLoadError(message); setStatus('Não foi possível sincronizar');
            if ((error as {code?:string})?.code === 'permission-denied') { store.clearCache(); setLoaded(false); loadedRef.current=false; }
            if (silent) toast.error(message);
        }
    }, [store,applySnapshot]);
    useEffect(() => {
        let active=true;
        load();
        const unsubscribe=store.subscribe(data=>{
            if(!active)return;
            if(lock.current||modalRef.current){if(data.revision>rev.current){pending.current=data;setStatus('O plano mudou no outro dispositivo');}return;}
            applySnapshot(data);
        },error=>{
            if(!active)return;
            setStatus(navigator.onLine?'Ligação interrompida; tenta atualizar':'Sem ligação · última cópia');
            if((error as {code?:string})?.code==='permission-denied'){store.clearCache();setLoaded(false);loadedRef.current=false;setLoadError(firebaseMessage(error));}
        });
        const online=()=>load();
        const off=()=>{setOffline(true);setStatus('Sem ligação · consulta da última cópia');};
        const onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event);};
        window.addEventListener('online',online);window.addEventListener('offline',off);window.addEventListener('beforeinstallprompt',onInstall);
        if('serviceWorker' in navigator && import.meta.env.PROD)navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL}).catch(()=>{});
        return()=>{active=false;unsubscribe();window.removeEventListener('online',online);window.removeEventListener('offline',off);window.removeEventListener('beforeinstallprompt',onInstall);};
    },[store,load,applySnapshot]);
    useEffect(()=>{if(!modal&&!saving&&pending.current){applySnapshot(pending.current);pending.current=null;}},[modal,saving,applySnapshot]);
    const commit:Commit=async(change,message)=>{
        if(lock.current||offline){toast.error(offline?'Volta a ligar-te para guardar alterações.':'A guardar a alteração anterior…');return false;}
        lock.current=true;setSaving(true);setStatus('A guardar…');
        try{
            const next=validateState(change(structuredClone(ref.current)));
            const result=await store.save(next,rev.current);
            applySnapshot(result);
            if(message)toast.success(message);return true;
        }catch(error){
            if(error instanceof ConflictError){lock.current=false;await load();}
            toast.error(firebaseMessage(error));setStatus('Alteração não guardada');return false;
        }finally{lock.current=false;setSaving(false);}
    };
    useEffect(() => { const context = (document as any).modelContext; if (!context?.registerTool)
        return; const lifecycle = new AbortController(); const tools = [{ name: 'read_meal_plan', description: 'Consultar o plano e os totais nutricionais do dia indicado, sem alterar dados.', inputSchema: { type: 'object', properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } }, required: ['date'], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async (input: any) => { if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)))
                throw new Error('Data inválida'); if (!loadedRef.current)
                throw new Error('Plano ainda indisponível'); return { meals: ref.current.meals.filter(m => m.date === input.date), goncalo: totals(ref.current, input.date, 'goncalo'), ines: totals(ref.current, input.date, 'ines') }; } }, { name: 'read_shopping_list', description: 'Consultar quantidades necessárias e em falta no intervalo indicado.', inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async (input: any) => { if (!input || ![input.from, input.to].every(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))) || input.from > input.to)
                throw new Error('Intervalo inválido'); if (!loadedRef.current)
                throw new Error('Plano ainda indisponível'); return shopping(ref.current, input.from, input.to).map(r => ({ name: r.food.name, unit: r.food.unit, required: r.required, missing: r.missing })); } }]; for (const tool of tools)
        try {
            Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => { });
        }
        catch { } return () => lifecycle.abort(); }, []);
    const navigate = (v: View) => { setView(v); setSearch(''); };
    const changeWeek = (w: string) => { setWeek(w); setDate(w); setFrom(w); setTo(plusDay(w, 6)); };
    const addMeal = (slot = 'Almoço', onDate = date, recipe?: Recipe) => { const r = recipe || state.recipes.find(r => r.category === slot) || state.recipes[0]; if (r)
        setModal({ type: 'meal', meal: newMeal(r, onDate, slot) });
    else
        toast.error('Cria primeiro uma receita.'); };
    const eraseMeal = (meal: Meal) => setConfirm({ title: 'Remover esta refeição?', description: 'As quantidades serão retiradas do plano e das compras. Uma preparação associada continua guardada.', run: () => { commit(s => ({ ...s, meals: s.meals.filter(m => m.id !== meal.id) }), 'Refeição removida').then(ok => { if (ok)
            toast('Refeição removida', { action: { label: 'Desfazer', onClick: () => { commit(s => ({ ...s, meals: [...s.meals, meal] }), 'Refeição reposta'); } } }); }); } });
    const duplicateWeek = () => { const target = plusDay(week, 7); setConfirm({ title: 'Copiar para a semana seguinte?', description: `Copiar refeições e preparações para ${dateLabel(target)}. Só é possível se a semana de destino estiver vazia.`, run: () => { commit(s => { if (s.meals.some(m => m.date >= target && m.date <= plusDay(target, 6)))
            throw new Error('A semana seguinte já tem refeições.'); const source = s.meals.filter(m => m.date >= week && m.date <= plusDay(week, 6)); const batchIds = new Set(source.map(m => m.batchId).filter(Boolean)); const batches = s.batches.filter(b => batchIds.has(b.id) || b.date >= week && b.date <= plusDay(week, 6)); const map = new Map(batches.map(b => [b.id, uid()])); return { ...s, batches: [...s.batches, ...batches.map(b => ({ ...b, id: map.get(b.id)!, date: plusDay(b.date, 7) }))], meals: [...s.meals, ...source.map(m => ({ ...m, id: uid(), date: plusDay(m.date, 7), batchId: m.batchId ? map.get(m.batchId) : undefined }))] }; }, 'Semana copiada').then(ok => { if (ok)
            changeWeek(target); }); } }); };
    const rows = shopping(state, from, to);
    const outstanding = rows.filter(r => r.missing > 0 && !r.checked).length + state.manual.filter(m => !m.checked).length;
    const dayMeals = state.meals.filter(m => m.date === date);
    const dayTotals = totals(state, date, person);
    const goals = state.profiles[person].goals;
    const suggestions = suggested(state, 'Almoço', PEOPLE, week, plusDay(week, 6));
    async function install() { if (installPrompt) {
        await installPrompt.prompt();
        setInstallPrompt(null);
    }
    else
        toast('No iPhone: Partilhar → Adicionar ao ecrã principal. No Android: menu do navegador → Instalar aplicação. Instalação disponível no endereço HTTPS do GitHub Pages.', { duration: 10000 }); }
    return <SidebarProvider><Sidebar className="app-sidebar"><SidebarHeader className="brand"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><div>Mesa a Dois<small>Gonçalo & Inês</small></div></SidebarHeader><SidebarContent className="nav-area"><p className="nav-caption">A VOSSA SEMANA</p><SidebarMenu>{nav.map(item => <SidebarMenuItem key={item.id}><SidebarMenuButton className="nav-item" isActive={view === item.id} onClick={() => navigate(item.id)}><item.icon /><span>{item.name}</span>{item.id === 'shopping' && outstanding > 0 && <span className="nav-count">{outstanding}</span>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="sidebar-bottom"><div className="household"><div className="avatar-pair"><span>G</span><span>I</span></div><div>À mesa, os dois<small>Porções à vossa medida</small></div></div><Button variant="outline" onClick={install}><Download size={16}/>Instalar aplicação</Button></SidebarFooter></Sidebar><div className="workspace"><header className="topbar"><div className="breadcrumb"><span>Mesa a Dois</span><ChevronRight size={14}/><strong>{nav.find(n => n.id === view)?.name}</strong></div><div className="sync-status" role="status">{offline ? <WifiOff size={16}/> : saving ? <RefreshCw className="spin" size={16}/> : <CloudCheck size={16}/>}<span>{status}</span><Button variant="ghost" size="icon" aria-label="Atualizar plano" onClick={() => load()} disabled={saving}><RefreshCw size={15}/></Button></div></header><main className="content">{local && <div className="notice demo-banner"><span><strong>Demonstração</strong> · Os dados ficam só neste dispositivo.</span><Button variant="outline" onClick={onExit}>Sair da demonstração</Button></div>}
 {!loaded ? <div className="welcome-loading"><Utensils size={36}/><h1>{loadError ? 'O plano ainda não está disponível' : 'A preparar a vossa mesa…'}</h1><p>{loadError || 'A abrir as receitas e o planeamento semanal.'}</p><Button onClick={() => load()}>Tentar novamente</Button><Button variant="ghost" onClick={onExit}>Terminar sessão</Button></div> : <>
 {offline && <div className="notice"><WifiOff size={18}/>Estás a consultar uma cópia guardada neste dispositivo. As alterações ficam disponíveis quando houver ligação.</div>}
 <div className="page-heading"><div><p className="eyebrow">{view === 'today' ? dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' }) : 'GONÇALO & INÊS'}</p><h1>{({ today: 'O que vamos comer?', week: 'Uma semana à vossa medida.', recipes: 'O vosso livro de receitas.', shopping: 'Tudo o que falta em casa.', profiles: 'Objetivos diferentes. A mesma mesa.' })[view]}</h1><p className="subtitle">{({ today: 'Refeições organizadas, quantidades certas.', week: 'Planeiem os dias. As compras ficam tratadas.', recipes: 'Receitas, lanches e os alimentos que usam todos os dias.', shopping: 'Quantidades calculadas a partir do vosso plano.', profiles: 'Ajustem as metas e as preferências de cada um.' })[view]}</p></div>{(view === 'today' || view === 'week') ? <Button className="primary" onClick={() => addMeal()} disabled={offline}><Plus size={18}/>Planear refeição</Button> : view === 'recipes' ? <Button className="primary" onClick={() => setModal({ type: recipeTab === 'foods' ? 'food' : 'recipe' })} disabled={offline}><Plus size={18}/>{recipeTab === 'foods' ? 'Novo alimento' : 'Nova receita'}</Button> : view === 'shopping' ? <Button className="primary" onClick={() => setModal({ type: 'manual' })} disabled={offline}><Plus size={18}/>Adicionar artigo</Button> : null}</div>
 {(view === 'today' || view === 'week') && <><div className="week-toolbar"><div className="week-select"><Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => changeWeek(plusDay(week, -7))}><ChevronLeft /></Button><strong>{dateLabel(week, { day: 'numeric', month: 'short' })} – {dateLabel(plusDay(week, 6), { day: 'numeric', month: 'short', year: 'numeric' })}</strong><Button variant="ghost" size="icon" aria-label="Semana seguinte" onClick={() => changeWeek(plusDay(week, 7))}><ChevronRight /></Button><Button variant="ghost" className="back-today" onClick={() => { changeWeek(monday(localDate())); setDate(localDate()); }}>Hoje</Button></div><Button variant="outline" onClick={duplicateWeek} disabled={offline}><Copy size={16}/>Duplicar semana</Button></div><div className="day-rail">{Array.from({ length: 7 }, (_, i) => plusDay(week, i)).map(d => <button key={d} className={`day-button ${d === date ? 'selected' : ''}`} onClick={() => setDate(d)} aria-pressed={d === date}><span>{dateLabel(d, { weekday: 'short' }).replace('.', '')}</span><strong>{dateLabel(d, { day: 'numeric' })}</strong><small>{state.meals.filter(m => m.date === d).length} refeições</small></button>)}</div></>}
 {(view === 'today' || view === 'week') && <><div className="nutrition-heading"><h2>Resumo nutricional <span>· {dateLabel(date, { day: 'numeric', month: 'short' })}</span></h2><Tabs value={person} onValueChange={v => setPerson(v as Person)}><TabsList className="person-tabs">{PEOPLE.map(p => <TabsTrigger key={p} value={p}><span className={`tiny-avatar ${p}`}>{NAMES[p][0]}</span>{NAMES[p]}</TabsTrigger>)}</TabsList></Tabs></div><div className="macro-cards">{(['kcal', 'protein', 'carbs', 'fat'] as const).map((key, i) => <div className={`macro-card macro-${key}`} key={key}><div className="macro-label"><span>{['Calorias', 'Proteína', 'Hidratos de carbono', 'Gordura'][i]}</span>{i === 0 ? <Flame size={18}/> : <span className="macro-symbol">{['', 'P', 'HC', 'G'][i]}</span>}</div><div className="macro-value">{fmt(dayTotals[key], i ? 1 : 0)}<small>{i ? 'g' : 'kcal'}</small></div><Progress value={goals[key] > 0 ? Math.min(100, dayTotals[key] / goals[key] * 100) : 0}/><small>{goals[key] > 0 ? `de ${fmt(goals[key])} ${i ? 'g' : 'kcal'} · ${fmt(Math.max(0, goals[key] - dayTotals[key]))} em falta` : <button className="text-link" onClick={() => navigate('profiles')}>Definir objetivo diário</button>}</small></div>)}</div><p className="nutrition-note">Totais planeados · alimentos de exemplo com valores estimados. {dayMeals.some(m => m.outside && m.portions[person]) ? 'Há refeições fora de casa sem valores nutricionais.' : ''}</p></>}
 {view === 'today' && <div className="today-grid"><section className="meal-list"><div className="section-heading"><h2>À mesa hoje</h2><span>{dayMeals.length} refeições planeadas</span></div>{!dayMeals.length && <div className="empty-plan"><CalendarDays /><h3>O dia está por planear.</h3><p>Escolhe uma receita ou começa com uma semana de exemplo editável.</p><div className="button-row"><Button className="primary" onClick={() => addMeal()} disabled={offline}>Escolher refeição</Button><Button variant="outline" disabled={offline} onClick={() => commit(s => exampleWeek(s, week), 'Semana de exemplo adicionada — ajusta as porções e as metas.')}>Usar semana de exemplo</Button></div><small>As porções de exemplo não são recomendações nutricionais.</small></div>}{SLOTS.map((slot, index) => { const meals = dayMeals.filter(m => m.slot === slot); return <div className="meal-slot" key={slot}><div className="slot-label"><span className="slot-number">{String(index + 1).padStart(2, '0')}</span>{slot}<span className="slot-time">{['07:30', '10:30', '13:00', '16:30', '20:00', 'Opcional'][index]}</span></div>{meals.map(m => <MealCard key={m.id} meal={m} state={state} person={person} edit={() => setModal({ type: 'meal', meal: m })} remove={() => eraseMeal(m)} copy={() => setModal({ type: 'meal', meal: { ...structuredClone(m), id: uid(), date: plusDay(m.date, 1), batchId: undefined } })}/>)}{!meals.length && <button className="add-slot" onClick={() => addMeal(slot)} disabled={offline}><Plus size={17}/>{slot === 'Ceia' ? 'Adicionar ceia, se fizer sentido' : 'Escolher refeição'}</button>}{meals.length > 0 && <button className="text-link slot-extra" onClick={() => addMeal(slot)} disabled={offline}>+ Outra refeição neste horário</button>}</div>; })}</section><aside className="right-column"><div className="inspiration"><img src={`${import.meta.env.BASE_URL}meal.jpg`} alt="Taça de arroz com frango e legumes, inspiração para refeições"/><div className="inspiration-caption"><span>PARA A VOSSA PRÓXIMA REFEIÇÃO</span><h3>Um prato cheio de boas ideias.</h3></div></div><div className="suggestions"><div className="section-heading"><h2>Sugestões para vocês</h2><ChefHat size={20}/></div><p className="note">Da vossa biblioteca, considerando preferências, despensa e variedade.</p>{suggestions.slice(0, 3).map(r => <button className="suggestion" key={r.id} onClick={() => addMeal(r.category, date, r)} disabled={offline}><div><strong>{r.name}</strong><small>{r.minutes} min · {fmt(nutrition(scale(r.ingredients, 1 / r.servings), state.foods).kcal)} kcal / porção</small></div><Plus size={18}/></button>)}</div><button className="shopping-summary" onClick={() => navigate('shopping')}><div className="shopping-icon"><ShoppingBasket /></div><div><h3>Lista de compras</h3><p>{outstanding ? `${outstanding} artigos por comprar` : 'Tudo pronto para começar'}</p></div><ArrowUpRight size={20}/></button></aside></div>}
 {view === 'week' && <><div className="section-heading"><h2>Plano da semana</h2><Button variant="outline" onClick={() => commit(s => exampleWeek(s, week), 'Espaços vazios preenchidos com exemplos editáveis.')} disabled={offline}>Preencher com exemplos</Button></div><div className="weekly-grid">{Array.from({ length: 7 }, (_, i) => plusDay(week, i)).map(d => <section className={`week-day ${d === date ? 'active' : ''}`} key={d}><button className="week-day-title" onClick={() => setDate(d)}><strong>{dateLabel(d, { weekday: 'long' })}</strong><span>{dateLabel(d, { day: 'numeric', month: 'short' })}</span></button>{SLOTS.map(slot => <div key={slot} className="weekly-slot"><small>{slot}</small>{state.meals.filter(m => m.date === d && m.slot === slot).map(m => <button key={m.id} onClick={() => setModal({ type: 'meal', meal: m })} className="weekly-meal"><strong>{m.outside ? 'Fora de casa' : m.name}</strong><span>{PEOPLE.filter(p => m.portions[p]).map(p => NAMES[p]).join(' + ')}</span>{!m.outside && <small>{fmt(nutrition(m.portions[person] || [], state.foods).kcal)} kcal · {NAMES[person]}</small>}</button>)}<button className="week-add" aria-label={`Adicionar ${slot} em ${d}`} onClick={() => addMeal(slot, d)} disabled={offline}><Plus size={16}/></button></div>)}<div className="week-total">{fmt(totals(state, d, person).kcal)} kcal<small>{NAMES[person]}</small></div></section>)}</div></>}
 {view === 'recipes' && <><div className="recipe-toolbar"><Tabs value={recipeTab} onValueChange={setRecipeTab}><TabsList><TabsTrigger value="recipes">Receitas</TabsTrigger><TabsTrigger value="foods">Alimentos e rótulos</TabsTrigger><TabsTrigger value="batches">Preparações</TabsTrigger></TabsList></Tabs><div className="search-box"><Search size={18}/><Input aria-label="Pesquisar receitas ou alimentos" placeholder="Pesquisar…" value={search} onChange={e => setSearch(e.target.value)}/></div></div>{recipeTab === 'recipes' && <><div className="filter-row"><Choice label="Mostrar" value={category} onChange={setCategory} options={[{ value: 'all', label: 'Todas as refeições' }, { value: 'favorites', label: 'Favoritas' }, ...SLOTS.map(s => ({ value: s, label: s }))]}/><p className="note">P = proteína · HC = hidratos · G = gordura<br />Valores por porção. Ajusta a porção ao planear.</p></div><div className="recipe-grid">{state.recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) && (category === 'all' || category === 'favorites' && r.favorite || r.category === category)).map(r => <article className="recipe-card" key={r.id}><div className="recipe-card-top"><span className="recipe-category">{r.category}</span><Button variant="ghost" size="icon" aria-label={`${r.favorite ? 'Retirar' : 'Adicionar'} ${r.name} das favoritas`} onClick={() => commit(s => ({ ...s, recipes: s.recipes.map(x => x.id === r.id ? { ...x, favorite: !x.favorite } : x) }))}><Heart size={18} fill={r.favorite ? '#087e70' : 'none'}/></Button></div><h3>{r.name}</h3><div className="recipe-meta"><span><Clock size={14}/>{r.minutes} min</span><span><Users size={14}/>{r.servings} {r.servings === 1 ? 'porção' : 'porções'}</span>{r.example && <span>Exemplo</span>}</div><MacroLine value={nutrition(scale(r.ingredients, 1 / r.servings), state.foods)}/><div className="recipe-tags">{r.tags.map((t, i) => <span key={i}>{t}</span>)}</div><details><summary>Ingredientes e preparação</summary><ul>{r.ingredients.map(i => { const f = state.foods.find(f => f.id === i.foodId)!; return <li key={i.foodId}>{amount(i.quantity, f.unit)} de {f.name.toLowerCase()} <small>({f.state})</small></li>; })}</ul><p>{r.steps || 'Sem passos de preparação.'}</p></details><div className="recipe-actions"><Button className="primary" onClick={() => addMeal(r.category, date, r)} disabled={offline}><Plus size={16}/>Planear</Button><Button variant="outline" onClick={() => setModal({ type: 'recipe', recipe: r })}>Editar</Button><Button variant="ghost" size="icon" aria-label={`Eliminar receita ${r.name}`} onClick={() => setConfirm({ title: 'Eliminar esta receita?', description: 'As refeições já planeadas mantêm as suas quantidades.', run: () => { commit(s => ({ ...s, recipes: s.recipes.filter(x => x.id !== r.id) }), 'Receita eliminada'); } })}><Trash2 size={16}/></Button></div></article>)}</div><div className="recipe-build"><ChefHat size={28}/><div><h3>Uma ideia com o que há em casa?</h3><p>Adiciona uma receita, escolhe os ingredientes e define a preparação. As calorias e os macros são calculados enquanto escreves.</p></div><Button variant="outline" onClick={() => setModal({ type: 'recipe' })}>Criar receita</Button></div></>}{recipeTab === 'foods' && <><p className="notice">Os valores iniciais são estimativas genéricas. Introduz os dados do rótulo para usar os teus produtos. Os pesos crus e cozinhados são alimentos distintos.</p><div className="food-list">{state.foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase())).map(f => <button className="food-row" key={f.id} onClick={() => setModal({ type: 'food', food: f })}><div><strong>{f.name}</strong><small>{f.state} · por {amount(f.basis, f.unit)}</small><small>{f.source}</small></div><MacroLine value={f.nutrition}/><SlidersHorizontal size={18}/></button>)}</div></>}{recipeTab === 'batches' && <><div className="section-heading"><p className="note">Compra uma vez. Distribui as porções pelo plano.</p><Button className="primary" onClick={() => setModal({ type: 'batch' })} disabled={offline || !state.recipes.length}><Plus size={17}/>Nova preparação</Button></div>{state.batches.length === 0 ? <div className="empty-plan"><Package /><h3>Ainda não há preparações.</h3><p>Prepara uma receita para vários dias e associa cada refeição em «Origem».</p></div> : state.batches.map(b => <article className="batch-card" key={b.id}><div className="section-heading"><div><h3>{b.name}</h3><p>{dateLabel(b.date)} · {state.meals.filter(m => m.batchId === b.id).length} refeições associadas</p></div><Button variant="ghost" size="icon" aria-label={`Eliminar preparação ${b.name}`} onClick={() => setConfirm({ title: 'Eliminar preparação?', description: 'Só é possível eliminar uma preparação sem refeições associadas.', run: () => { commit(s => { if (s.meals.some(m => m.batchId === b.id))
                throw new Error('Remove primeiro a associação nas refeições.'); return { ...s, batches: s.batches.filter(x => x.id !== b.id) }; }, 'Preparação eliminada'); } })}><Trash2 size={17}/></Button></div><p className="note">Por distribuir:</p><div className="recipe-tags">{batchRemaining(state, b).map(i => { const f = state.foods.find(f => f.id === i.foodId)!; return <span key={i.foodId}>{f.name}: {amount(i.quantity, f.unit)}</span>; })}</div><Button variant="outline" onClick={() => { const r = state.recipes.find(r => r.name === b.name); if (r)
            setModal({ type: 'meal', meal: { ...newMeal(r, b.date, r.category), batchId: b.id } });
        else
            toast.error('Cria uma refeição e seleciona esta preparação em Origem.'); }}>Distribuir no plano</Button></article>)}</>}</>}
 {view === 'shopping' && <><div className="shopping-toolbar"><div className="two-cols"><label className="field">De<Input type="date" value={from} max={to} onChange={e => { if (e.target.value)
            setFrom(e.target.value); }}/></label><label className="field">Até<Input type="date" value={to} min={from} onChange={e => { if (e.target.value)
            setTo(e.target.value); }}/></label></div><div className="shopping-count"><strong>{outstanding}</strong><span>artigos por comprar</span></div></div><p className="note">A despensa é descontada uma vez no intervalo. As preparações entram no dia de confeção. As compras marcadas não atualizam a despensa automaticamente.</p>{rows.length === 0 && <div className="empty-plan"><ShoppingBasket /><h3>A lista começa no vosso plano.</h3><p>Adiciona refeições para calcular os ingredientes necessários.</p><Button onClick={() => navigate('week')}>Abrir plano semanal</Button></div>}{[...new Set(rows.map(r => r.food.section))].map(section => <section className="shopping-section" key={section}><h2>{section}<span>{rows.filter(r => r.food.section === section).length} artigos</span></h2>{rows.filter(r => r.food.section === section).map(row => <ShoppingItem key={`${from}:${to}:${row.food.id}`} row={row} disabled={offline || saving} saveStock={value => commit(s => ({ ...s, pantry: { ...s.pantry, [row.food.id]: value } }), 'Despensa atualizada')} toggle={() => commit(s => { const purchased = { ...s.purchased }; const key = `${from}:${to}:${row.food.id}`; if (row.checked)
            delete purchased[key];
        else
            purchased[key] = row.missing; return { ...s, purchased }; })} edit={() => setModal({ type: 'food', food: row.food })}/>)}</section>)}{state.manual.length > 0 && <section className="shopping-section"><h2>Outros artigos</h2>{state.manual.map(m => <div className="manual-row" key={m.id}><Checkbox aria-label={`Comprado: ${m.name}`} checked={m.checked} onCheckedChange={() => commit(s => ({ ...s, manual: s.manual.map(x => x.id === m.id ? { ...x, checked: !x.checked } : x) }))}/><strong className={m.checked ? 'crossed' : ''}>{m.name}</strong><span>{m.quantity}</span><Button variant="ghost" size="icon" aria-label={`Remover artigo ${m.name}`} onClick={() => commit(s => ({ ...s, manual: s.manual.filter(x => x.id !== m.id) }))}><Trash2 size={16}/></Button></div>)}</section>}</>}
 {view === 'profiles' && <><div className="profiles-grid">{PEOPLE.map(p => <ProfileCard key={p} person={p} state={state} commit={commit}/>)}</div><div className="settings-card"><div><h2>No vosso telemóvel</h2><p>Instala a aplicação para abrir o plano e as compras mais depressa. A consulta sem ligação usa a última cópia guardada neste dispositivo.</p></div><Button variant="outline" onClick={install}><Download size={16}/>Como instalar</Button><Button variant="ghost" onClick={() => { store.clearCache(); toast.success('Cópia offline removida deste dispositivo.'); }}>Apagar cópia offline</Button></div><div className="settings-card"><div><h2>{local ? 'Demonstração' : 'Conta ligada'}</h2><p>{store.identity}</p></div><Button variant="outline" onClick={onExit}>{local ? 'Sair da demonstração' : 'Terminar sessão'}</Button></div><div className="notice">{local ? 'Demonstração: dados de exemplo guardados apenas neste dispositivo. Para partilhar o plano, sai da demonstração e inicia sessão numa conta autorizada.' : 'O plano é partilhado entre as contas autorizadas. Os dados sincronizam automaticamente enquanto há ligação.'}</div></>}
 </>}
 </main><footer className="app-footer">Mesa a Dois<span>Um plano, duas porções.</span></footer></div><nav className="mobile-nav" aria-label="Navegação principal">{nav.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => navigate(n.id)}><n.icon size={20}/><span>{n.id === 'week' ? 'Plano' : n.name}</span></button>)}</nav><Dialog open={!!modal} onOpenChange={open => { if (!open && !saving)
        setModal(null); }}><DialogContent className="editor-dialog">{modal?.type === 'meal' ? <MealEditor state={state} initial={modal.meal} commit={commit} close={() => setModal(null)}/> : modal?.type === 'recipe' ? <RecipeEditor state={state} initial={modal.recipe} commit={commit} close={() => setModal(null)}/> : modal?.type === 'food' ? <FoodEditor initial={modal.food} commit={commit} close={() => setModal(null)}/> : modal?.type === 'batch' ? <BatchEditor state={state} commit={commit} close={() => setModal(null)}/> : modal?.type === 'manual' ? <ManualEditor commit={commit} close={() => setModal(null)}/> : null}{saving && <p className="saving-label" role="status">A guardar…</p>}</DialogContent></Dialog><AlertDialog open={!!confirm} onOpenChange={open => { if (!open)
        setConfirm(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { confirm?.run(); setConfirm(null); }}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><Toaster position="top-center" richColors closeButton/></SidebarProvider>;
}
function MealCard({ meal, state, person, edit, copy, remove }: {
    meal: Meal;
    state: State;
    person: Person;
    edit: () => void;
    copy: () => void;
    remove: () => void;
}) { const items = meal.portions[person]; return <article className="meal-card"><div className="meal-card-main"><div className={`meal-marker ${meal.outside ? 'outside' : ''}`}><Utensils size={20}/></div><div className="meal-card-text"><button className="meal-title" onClick={edit}>{meal.outside ? 'Fora de casa' : meal.name}</button><div className="meal-people">{PEOPLE.filter(p => meal.portions[p]).map(p => <span key={p} className={p}>{NAMES[p]}</span>)}{meal.batchId && <span>Preparado em lote</span>}</div>{!meal.outside && (items ? <><p className="ingredient-summary">{items.map(i => { const f = state.foods.find(f => f.id === i.foodId)!; return `${amount(i.quantity, f.unit)} ${f.name.toLowerCase()}`; }).join(' · ')}</p><MacroLine value={nutrition(items, state.foods)}/></> : <p className="note">Não planeada para {NAMES[person]}.</p>)}</div></div><div className="meal-actions"><Button variant="ghost" size="icon" aria-label={`Editar ${meal.name}`} onClick={edit}><SlidersHorizontal size={16}/></Button><Button variant="ghost" size="icon" aria-label={`Copiar ${meal.name} para outro dia`} onClick={copy}><Copy size={16}/></Button><Button variant="ghost" size="icon" aria-label={`Remover ${meal.name}`} onClick={remove}><Trash2 size={16}/></Button></div></article>; }
function ShoppingItem({ row, disabled, saveStock, toggle, edit }: {
    row: ShoppingRow;
    disabled: boolean;
    saveStock: (n: number) => Promise<boolean>;
    toggle: () => void;
    edit: () => void;
}) { const [stock, setStock] = useState(row.stock); useEffect(() => setStock(row.stock), [row.stock]); return <div className={`shopping-row ${row.checked ? 'is-checked' : ''}`}><div className="shopping-main"><Checkbox aria-label={`Comprado: ${row.food.name}`} checked={row.checked} disabled={disabled || row.missing === 0} onCheckedChange={toggle}/><div className="shopping-name"><strong>{row.food.name}</strong><small>{row.food.state} · necessário: {amount(row.required, row.food.unit)}</small>{row.changed && <span className="warning">A quantidade mudou desde que marcaste como comprado.</span>}</div><div className="shopping-amount"><strong>{row.missing === 0 ? 'Em casa' : amount(row.missing, row.food.unit)}</strong><small>{row.missing > 0 ? 'em falta' : 'não é preciso comprar'}</small></div></div><details><summary>Despensa, embalagens e refeições</summary><div className="stock-controls"><NumberField label={`Já existe em casa (${row.food.unit})`} value={stock} onChange={setStock}/><Button variant="outline" disabled={disabled} onClick={() => saveStock(stock)}>Guardar</Button><Button variant="ghost" onClick={edit}>Editar embalagem</Button></div>{row.packages !== null && <p className="note">Comprar {row.packages} embalagem(ns) de {amount(row.food.pack!, row.food.unit)}. Sobra prevista: {amount(row.leftover, row.food.unit)}.</p>}<ul className="source-list">{row.sources.map(s => <li key={s}>{s}</li>)}</ul></details></div>; }
function ProfileCard({ person, state, commit }: {
    person: Person;
    state: State;
    commit: Commit;
}) { const [profile, setProfile] = useState(structuredClone(state.profiles[person])); return <form className="profile-card" onSubmit={async (e) => { e.preventDefault(); await commit(s => ({ ...s, profiles: { ...s.profiles, [person]: profile } }), `Objetivos de ${NAMES[person]} guardados`); }}><div className="profile-title"><span className={`profile-avatar ${person}`}>{NAMES[person][0]}</span><div><h2>{NAMES[person]}</h2><p>Objetivos diários</p></div></div><p className="note">Preenche as tuas metas. O valor 0 deixa o objetivo por definir.</p><div className="two-cols">{(['kcal', 'protein', 'carbs', 'fat'] as const).map((key, i) => <NumberField key={key} label={['Calorias (kcal)', 'Proteína (g)', 'Hidratos (g)', 'Gordura (g)'][i]} value={profile.goals[key]} onChange={v => setProfile({ ...profile, goals: { ...profile.goals, [key]: v } })}/>)}</div><label className="field">Alimentos a evitar<Textarea value={profile.avoid} placeholder="Ex.: atum, nozes · separados por vírgulas" onChange={e => setProfile({ ...profile, avoid: e.target.value })}/></label><label className="field">Preferências<Textarea value={profile.preferences} placeholder="Ex.: rápida, forno, frango" onChange={e => setProfile({ ...profile, preferences: e.target.value })}/></label><p className="note">As sugestões filtram nomes de ingredientes. Confirma sempre os rótulos em caso de alergia.</p><Button type="submit" className="primary">Guardar perfil</Button></form>; }
function ManualEditor({ commit, close }: {
    commit: Commit;
    close: () => void;
}) { const [name, setName] = useState(''); const [quantity, setQuantity] = useState('1 unidade'); return <form className="form-stack" onSubmit={async (e) => { e.preventDefault(); if (await commit(s => ({ ...s, manual: [...s.manual, { id: uid(), name, quantity, checked: false }] }), 'Artigo adicionado'))
    close(); }}><DialogTitle>Adicionar às compras</DialogTitle><DialogDescription>Para produtos que não vêm das receitas, como detergente ou papel higiénico.</DialogDescription><label className="field">Artigo<Input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Detergente da loiça"/></label><label className="field">Quantidade<Input required value={quantity} onChange={e => setQuantity(e.target.value)}/></label><Button type="submit" className="primary">Adicionar artigo</Button></form>; }
