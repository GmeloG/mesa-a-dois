import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Sun, BookOpen, ShoppingBasket, Settings2, Plus, ChevronRight, Utensils, CloudCheck, WifiOff, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Toaster, toast } from 'sonner';
import { type State, type Recipe, type Meal, type Food, type Person, initialState, localDate, monday, plusDay, shopping, newMeal, validateState } from '@/lib/model';
import { MealEditor, RecipeEditor, FoodEditor, BatchEditor, ManualEditor, ProposalEditor, type Commit } from './editors';
import { TodayView, WeekView, WeekToolbar, NutritionPanel, RecipesView, ShoppingView, ProfilesView, dateLabel, type Ctx } from './views';
import { ConflictError, type PlanStore, type Snapshot } from '@/lib/store';
import { firebaseMessage } from '@/lib/firebase-store';

export type View = 'today' | 'week' | 'recipes' | 'shopping' | 'profiles';
export type Modal =
  | { type: 'meal'; meal: Meal }
  | { type: 'recipe'; recipe?: Recipe; isNew?: boolean }
  | { type: 'food'; food?: Food }
  | { type: 'batch' }
  | { type: 'manual' }
  | { type: 'proposal' }
  | null;

const nav = [
  { id: 'today', name: 'Hoje', short: 'Hoje', icon: Sun },
  { id: 'week', name: 'Plano semanal', short: 'Plano', icon: CalendarDays },
  { id: 'recipes', name: 'Receitas', short: 'Receitas', icon: BookOpen },
  { id: 'shopping', name: 'Compras', short: 'Compras', icon: ShoppingBasket },
  { id: 'profiles', name: 'Perfis e definições', short: 'Perfis', icon: Settings2 },
] as const;
const HEADINGS: Record<View, [string, string]> = {
  today: ['O que vamos comer?', 'Refeições organizadas, quantidades certas.'],
  week: ['Uma semana à vossa medida.', 'Planeiem os dias. As compras ficam tratadas.'],
  recipes: ['O vosso livro de receitas.', 'Receitas, lanches e os alimentos que usam todos os dias.'],
  shopping: ['Tudo o que falta em casa.', 'Quantidades calculadas a partir do vosso plano.'],
  profiles: ['Objetivos diferentes. A mesma mesa.', 'Ajustem as metas e as preferências de cada um.'],
};
const isNetworkError = (error: unknown) => { const code = (error as { code?: string })?.code || ''; return !navigator.onLine || /unavailable|network|deadline|failed-precondition/.test(code); };

export default function MealApp({ store, onExit }: { store: PlanStore; onExit: () => Promise<void> }) {
  const [state, setState] = useState<State>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('A abrir o plano…');
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const local = store.mode === 'demo';
  const [view, setView] = useState<View>('today');
  const [date, setDate] = useState(localDate);
  const [week, setWeek] = useState(() => monday(localDate()));
  const [modal, setModal] = useState<Modal>(null);
  const [person, setPerson] = useState<Person>('goncalo');
  const [confirm, setConfirm] = useState<{ title: string; description: string; run: () => void } | null>(null);
  const [from, setFrom] = useState(week);
  const [to, setTo] = useState(plusDay(week, 6));
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const ref = useRef(state);
  const rev = useRef(0);
  const lock = useRef(false);
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const pending = useRef<Snapshot | null>(null);

  const applySnapshot = useCallback((data: Snapshot) => {
    if (data.revision < rev.current) return;
    ref.current = data.state; rev.current = data.revision; setRevision(data.revision); setState(data.state);
    setLoaded(true); setOffline(!!data.cached || !navigator.onLine); setLoadError('');
    const when = new Date(data.updatedAt);
    setStatus(data.cached ? `Cópia offline · sincronizada a ${when.toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : `${local ? 'Demonstração guardada' : 'Sincronizado'} às ${when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`);
  }, [local]);

  const load = useCallback(async (silent = false) => {
    if (lock.current) return;
    setStatus(s => s.startsWith('Cópia offline') ? s : 'A sincronizar…');
    try {
      const data = await store.load();
      if (!lock.current) applySnapshot(data);
    } catch (error) {
      const message = firebaseMessage(error);
      const denied = (error as { code?: string })?.code === 'permission-denied' || /não está associada/.test(message);
      if (!denied && isNetworkError(error)) {
        const cached = store.cached();
        if (cached) { applySnapshot({ ...cached, cached: true }); if (silent) toast.error(message); return; }
      }
      setLoadError(message); setStatus('Não foi possível sincronizar');
      if (denied) { store.clearCache(); setLoaded(false); }
      if (silent) toast.error(message);
    }
  }, [store, applySnapshot]);

  useEffect(() => {
    let active = true;
    load();
    const unsubscribe = store.subscribe(data => {
      if (!active) return;
      if (lock.current || modalRef.current) {
        if (data.revision > rev.current) { pending.current = data; setStatus('O plano mudou no outro dispositivo · será atualizado ao fechar'); }
        return;
      }
      applySnapshot(data);
    }, error => {
      if (!active) return;
      setStatus(navigator.onLine ? 'Ligação interrompida · toca em atualizar' : 'Sem ligação · última cópia');
      if ((error as { code?: string })?.code === 'permission-denied') { store.clearCache(); setLoaded(false); setLoadError(firebaseMessage(error)); }
    });
    const online = () => load(true);
    const off = () => { setOffline(true); setStatus('Sem ligação · consulta da última cópia'); };
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as unknown as { prompt: () => Promise<void> }); };
    window.addEventListener('online', online); window.addEventListener('offline', off); window.addEventListener('beforeinstallprompt', onInstall);
    return () => { active = false; unsubscribe(); window.removeEventListener('online', online); window.removeEventListener('offline', off); window.removeEventListener('beforeinstallprompt', onInstall); };
  }, [store, load, applySnapshot]);

  useEffect(() => { if (!modal && !saving && pending.current) { applySnapshot(pending.current); pending.current = null; } }, [modal, saving, applySnapshot]);

  const commit: Commit = async (change, message) => {
    if (lock.current || offline) { toast.error(offline ? 'Sem ligação: volta a ligar-te para guardar alterações.' : 'A guardar a alteração anterior…'); return false; }
    lock.current = true; setSaving(true); setStatus('A guardar…');
    try {
      const next = validateState(change(structuredClone(ref.current)));
      const result = await store.save(next, rev.current);
      applySnapshot(result);
      if (message) toast.success(message);
      return true;
    } catch (error) {
      if (error instanceof ConflictError) { lock.current = false; pending.current = null; await load(); toast.error(error.message, { duration: 8000 }); }
      else toast.error(firebaseMessage(error));
      setStatus('Alteração não guardada');
      return false;
    } finally { lock.current = false; setSaving(false); }
  };

  /** Remove algo e oferece "Desfazer" (repõe o elemento se ainda não existir). */
  function removeWithUndo<T extends { id: string }>(title: string, description: string, key: 'meals' | 'recipes' | 'manual' | 'batches', item: T, guard?: (s: State) => void) {
    setConfirm({ title, description, run: () => {
      commit(s => { guard?.(s); return { ...s, [key]: (s[key] as unknown as T[]).filter(x => x.id !== item.id) }; }).then(ok => {
        if (ok) toast('Eliminado', { action: { label: 'Desfazer', onClick: () => { commit(s => (s[key] as unknown as T[]).some(x => x.id === item.id) ? s : { ...s, [key]: [...(s[key] as unknown as T[]), item] }, 'Reposto'); } } });
      });
    } });
  }

  const changeWeek = (w: string) => { setWeek(w); setDate(w); setFrom(w); setTo(plusDay(w, 6)); };
  const addMeal = (slot = 'Almoço', onDate = date, recipe?: Recipe) => {
    const r = recipe || state.recipes.find(r => r.category === slot) || state.recipes[0];
    if (r) setModal({ type: 'meal', meal: newMeal(r, onDate, slot) }); else toast.error('Cria primeiro uma receita.');
  };
  async function install() {
    if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); return; }
    toast('No iPhone: Safari → Partilhar → Adicionar ao ecrã principal. No Android: menu do Chrome → Instalar aplicação. Usa o endereço HTTPS do GitHub Pages.', { duration: 10000 });
  }

  const rows = shopping(state, from, to);
  const outstanding = rows.filter(r => r.missing > 0 && !r.checked).length + state.manual.filter(m => !m.checked).length;
  const ctx: Ctx = { person, setPerson, state, revision, date, setDate, week, changeWeek, offline, saving, commit, setModal, setConfirm, removeWithUndo, addMeal, navigate: (v: View) => setView(v), rows, outstanding, from, to, setFrom, setTo, store, onExit, install, local };

  const [title, subtitle] = HEADINGS[view];
  const action = view === 'today' || view === 'week' ? <Button className="primary" onClick={() => addMeal()} disabled={offline}><Plus size={18} />Planear refeição</Button>
    : view === 'recipes' ? <Button className="primary" onClick={() => setModal({ type: 'recipe' })} disabled={offline}><Plus size={18} />Nova receita</Button>
    : view === 'shopping' ? <Button className="primary" onClick={() => setModal({ type: 'manual' })} disabled={offline}><Plus size={18} />Adicionar artigo</Button> : null;

  return <SidebarProvider>
    <Sidebar className="app-sidebar">
      <SidebarHeader className="brand"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /><div>Mesa a Dois<small>Gonçalo & Inês</small></div></SidebarHeader>
      <SidebarContent className="nav-area"><p className="nav-caption">A VOSSA SEMANA</p>
        <SidebarMenu>{nav.map(item => <SidebarMenuItem key={item.id}><SidebarMenuButton className="nav-item" isActive={view === item.id} onClick={() => setView(item.id)}><item.icon /><span>{item.name}</span>{item.id === 'shopping' && outstanding > 0 && <span className="nav-count">{outstanding}</span>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="sidebar-bottom"><div className="household"><div className="avatar-pair"><span>G</span><span>I</span></div><div>À mesa, os dois<small>Porções à vossa medida</small></div></div><Button variant="outline" onClick={install}><Download size={16} />Instalar aplicação</Button></SidebarFooter>
    </Sidebar>
    <div className="workspace">
      <header className="topbar">
        <div className="breadcrumb"><span>Mesa a Dois</span><ChevronRight size={14} /><strong>{nav.find(n => n.id === view)?.name}</strong></div>
        <div className={`sync-status ${offline ? 'is-offline' : ''}`} role="status">{offline ? <WifiOff size={16} /> : saving ? <RefreshCw className="spin" size={16} /> : <CloudCheck size={16} />}<span>{status}</span><Button variant="ghost" size="icon" aria-label="Atualizar plano" onClick={() => load(true)} disabled={saving}><RefreshCw size={15} /></Button></div>
      </header>
      <main className="content">
        {local && <div className="notice demo-banner"><span><strong>Demonstração</strong> · Dados de exemplo guardados só neste dispositivo, separados do plano real.</span><Button variant="outline" onClick={onExit}>Sair da demonstração</Button></div>}
        {!loaded ? <div className="welcome-loading" role={loadError ? 'alert' : 'status'}><Utensils size={36} /><h1>{loadError ? 'O plano ainda não está disponível' : 'A preparar a vossa mesa…'}</h1><p>{loadError || 'A abrir as receitas e o planeamento semanal.'}</p><div className="button-row"><Button onClick={() => load(true)}>Tentar novamente</Button><Button variant="ghost" onClick={onExit}>Terminar sessão</Button></div></div> : <>
          {offline && <div className="notice"><WifiOff size={18} />Estás a consultar uma cópia guardada neste dispositivo. Para guardar alterações é preciso ligação.</div>}
          <div className="page-heading"><div><p className="eyebrow">{view === 'today' ? dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' }) : 'GONÇALO & INÊS'}</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>{action}</div>
          {(view === 'today' || view === 'week') && <><WeekToolbar ctx={ctx} /><NutritionPanel ctx={ctx} /></>}
          {view === 'today' && <TodayView ctx={ctx} />}
          {view === 'week' && <WeekView ctx={ctx} />}
          {view === 'recipes' && <RecipesView ctx={ctx} />}
          {view === 'shopping' && <ShoppingView ctx={ctx} />}
          {view === 'profiles' && <ProfilesView ctx={ctx} />}
        </>}
      </main>
      <footer className="app-footer">Mesa a Dois<span>Um plano, duas porções.</span></footer>
    </div>
    <nav className="mobile-nav" aria-label="Navegação principal">{nav.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} aria-current={view === n.id ? 'page' : undefined} onClick={() => setView(n.id)}><n.icon size={20} /><span>{n.short}</span>{n.id === 'shopping' && outstanding > 0 && <span className="nav-badge">{outstanding}</span>}</button>)}</nav>
    <Dialog open={!!modal} onOpenChange={open => { if (!open && !saving) setModal(null); }}>
      <DialogContent className="editor-dialog">
        {modal?.type === 'meal' ? <MealEditor key={modal.meal.id + modal.meal.recipeId} state={state} initial={modal.meal} commit={commit} close={() => setModal(null)} />
          : modal?.type === 'recipe' ? <RecipeEditor key={modal.recipe?.id || 'new'} state={state} initial={modal.recipe} isNew={modal.isNew} commit={commit} close={() => setModal(null)} onPlan={r => addMeal(r.category, date, r)} />
          : modal?.type === 'food' ? <FoodEditor initial={modal.food} commit={commit} close={() => setModal(null)} />
          : modal?.type === 'batch' ? <BatchEditor state={state} commit={commit} close={() => setModal(null)} />
          : modal?.type === 'manual' ? <ManualEditor commit={commit} close={() => setModal(null)} />
          : modal?.type === 'proposal' ? <ProposalEditor state={state} onPropose={recipe => setModal({ type: 'recipe', recipe, isNew: true })} />
          : null}
        {saving && <p className="saving-label" role="status">A guardar…</p>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!confirm} onOpenChange={open => { if (!open) setConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { confirm?.run(); setConfirm(null); }}>Confirmar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Toaster position="top-center" richColors closeButton />
  </SidebarProvider>;
}
