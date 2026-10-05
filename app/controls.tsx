'use client';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Food, Ingredient, Macros, fmt } from '@/lib/model';
export function Choice({ label, value, onChange, options }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: {
        value: string;
        label: string;
    }[];
}) { return <label className="field"><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger className="choice" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></label>; }
export function NumberField({ label, value, onChange, min = 0, step = 'any' }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    step?: string;
}) { return <label className="field"><span>{label}</span><Input type="number" min={min} step={step} required value={value || ''} placeholder="0" onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}/></label>; }
export function MacroLine({ value }: {
    value: Macros;
}) { return <div className="macro-line"><strong>{fmt(value.kcal)} <small>kcal</small></strong><span className="protein">P <b>{fmt(value.protein, 1)} g</b></span><span className="carbs">HC <b>{fmt(value.carbs, 1)} g</b></span><span className="fat">G <b>{fmt(value.fat, 1)} g</b></span></div>; }
export function Ingredients({ items, foods, onChange, allowAdd = true }: {
    items: Ingredient[];
    foods: Food[];
    onChange: (v: Ingredient[]) => void;
    allowAdd?: boolean;
}) { return <div className="ingredients">{items.map((item, index) => { const food = foods.find(f => f.id === item.foodId)!; return <div className="ingredient" key={item.foodId}><div><strong>{food.name}</strong><small>{food.state}</small></div><label><span className="sr-only">Quantidade de {food.name}</span><Input type="number" min="0" step="any" value={item.quantity || ''} placeholder="0" onChange={e => onChange(items.map((v, i) => i === index ? { ...v, quantity: Number(e.target.value) } : v))}/></label><span>{food.unit}</span>{allowAdd && <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${food.name}`} onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 size={16}/></Button>}</div>; })}{allowAdd && foods.some(f => !items.some(i => i.foodId === f.id)) && <Choice label="Adicionar ingrediente" value="add" onChange={id => onChange([...items, { foodId: id, quantity: foods.find(f => f.id === id)?.unit === 'un' ? 1 : 100 }])} options={[{ value: 'add', label: 'Escolher alimento…' }, ...foods.filter(f => !items.some(i => i.foodId === f.id)).map(f => ({ value: f.id, label: `${f.name} · ${f.state}` }))]}/>}</div>; }
