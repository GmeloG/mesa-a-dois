import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { type Food, type Ingredient, type Macros, type Nutrition, fmt, amount } from '@/lib/model';

export function Choice({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return <label className="field"><span>{label}</span>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="choice" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  </label>;
}

export function NumberField({ label, value, onChange, min = 0, step = 'any', required = true }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: string;
  required?: boolean;
}) {
  return <label className="field"><span>{label}</span>
    <Input type="number" inputMode="decimal" min={min} step={step} required={required} value={value || ''} placeholder="0"
      onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
  </label>;
}

/** Linha de calorias e macros. Assinala alimentos sem dados e valores estimados. */
export function MacroLine({ value, compact = false }: { value: Macros | Nutrition | null; compact?: boolean }) {
  if (!value) return <div className="macro-line unknown"><strong>Valores desconhecidos</strong></div>;
  const n = value as Partial<Nutrition>;
  const missing = n.missing || [];
  const onlyUnknown = missing.length > 0 && value.kcal === 0;
  return <div className={`macro-line ${missing.length ? 'has-missing' : ''}`}>
    {onlyUnknown ? <strong>? <small>kcal</small></strong> : <strong>{missing.length ? '≥ ' : n.estimated ? '≈ ' : ''}{fmt(value.kcal)} <small>kcal</small></strong>}
    {!compact && !onlyUnknown && <>
      <span className="protein">P <b>{fmt(value.protein, 1)} g</b></span>
      <span className="carbs">HC <b>{fmt(value.carbs, 1)} g</b></span>
      <span className="fat">G <b>{fmt(value.fat, 1)} g</b></span>
    </>}
    {missing.length > 0 && <span className="unknown-badge" title={`Sem dados: ${missing.join(', ')}`}>Sem dados: {missing.join(', ')}</span>}
    {!missing.length && n.estimated && !compact && <span className="estimate-badge" title="Inclui valores de exemplo estimados">estimado</span>}
  </div>;
}

export function Ingredients({ items, foods, onChange, allowAdd = true }: {
  items: Ingredient[];
  foods: Food[];
  onChange: (v: Ingredient[]) => void;
  allowAdd?: boolean;
}) {
  const available = foods.filter(f => !items.some(i => i.foodId === f.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  return <div className="ingredients">
    {items.map((item, index) => {
      const food = foods.find(f => f.id === item.foodId);
      if (!food) return <div className="ingredient" key={item.foodId}><div><strong>Alimento removido</strong></div></div>;
      return <div className="ingredient" key={item.foodId}>
        <div><strong>{food.name}</strong><small>{food.state}{!food.nutrition && ' · sem dados nutricionais'}</small></div>
        <label><span className="sr-only">Quantidade de {food.name}</span>
          <Input type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ''} placeholder="0"
            onChange={e => onChange(items.map((v, i) => i === index ? { ...v, quantity: Math.max(0, Number(e.target.value) || 0) } : v))} />
        </label>
        <span>{food.unit}</span>
        {allowAdd && <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${food.name}`} onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 size={16} /></Button>}
      </div>;
    })}
    {allowAdd && available.length > 0 && <Choice label="Adicionar ingrediente" value="add"
      onChange={id => onChange([...items, { foodId: id, quantity: foods.find(f => f.id === id)?.unit === 'un' ? 1 : 100 }])}
      options={[{ value: 'add', label: 'Escolher alimento…' }, ...available.map(f => ({ value: f.id, label: `${f.name} · ${f.state}` }))]} />}
  </div>;
}

/** Lista de ingredientes "quantidade nome", usada nos cartões. */
export function ingredientText(items: Ingredient[], foods: Food[]) {
  return items.filter(i => i.quantity > 0).map(i => {
    const f = foods.find(f => f.id === i.foodId);
    return f ? `${amount(i.quantity, f.unit)} ${f.name.toLowerCase()}` : 'alimento removido';
  }).join(' · ');
}
