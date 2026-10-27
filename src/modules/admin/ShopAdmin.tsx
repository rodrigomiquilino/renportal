import { useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/FormError';
import { fitImage } from '@/lib/image';
import { cosmeticKey } from '@/lib/slug';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { explainUploadError, uploadToBucket } from '@/lib/upload';
import type { ShopItem, ShopItemType } from '@/lib/database.types';

const selectClass = 'h-10 w-full rounded-xl border border-white/10 bg-[#16161e] px-3 text-sm';

export function ShopAdmin() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [type, setType] = useState<ShopItemType>('border');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('40');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const assetKey = useMemo(() => (name.trim() ? cosmeticKey(type, name) : ''), [name, type]);

  async function load() {
    const { data, error: loadError } = await supabase.from('shop_items').select('*').order('cost_xp');
    if (loadError) {
      setError('Não foi possível ler a loja.');
      return;
    }
    setItems(data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  function reset() {
    setEditing(null);
    setName('');
    setDescription('');
    setCost('40');
    setType('border');
    setImageFile(null);
    setImagePreview(null);
  }

  async function pickImage(file: File) {
    try {
      const blob = await fitImage(file, 800, 8 * 1024 * 1024);
      setImageFile(new File([blob], 'item.webp', { type: blob.type }));
      setImagePreview(URL.createObjectURL(blob));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível ler a imagem.');
    }
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    const nextCost = Number(cost);
    if (!assetKey) {
      setError('Dê um nome para gerar o identificador.');
      return;
    }
    if (!Number.isInteger(nextCost) || nextCost < 1) {
      setError('O custo precisa ser um número inteiro maior que zero.');
      return;
    }
    if (!editing && type !== 'title' && !imageFile) {
      setError('Envie uma imagem. Ela aparece no card da loja.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      let imageUrl = items.find((item) => item.id === editing)?.image_url ?? null;
      if (imageFile) {
        const path = `${type}/${assetKey}.webp`;
        imageUrl = await uploadToBucket('shop-assets', path, imageFile);
      }
      const row = {
        type,
        name: nextName,
        asset_key: assetKey,
        cost_xp: nextCost,
        description: description.trim() || null,
        image_url: imageUrl,
        active: true,
      };
      const query = editing
        ? supabase.from('shop_items').update(row).eq('id', editing)
        : supabase.from('shop_items').insert(row);
      const { error: saveError } = await query;
      if (saveError) {
        setError('Não foi possível salvar. Se o nome repetir um item do mesmo tipo, escolha outro.');
        return;
      }
      toast(editing ? 'Item atualizado.' : 'Item criado.');
      reset();
      await load();
    } catch (caught) {
      setError(explainUploadError(caught));
    } finally {
      setPending(false);
    }
  }

  async function toggle(item: ShopItem) {
    const { error: updateError } = await supabase.from('shop_items').update({ active: !item.active }).eq('id', item.id);
    if (updateError) {
      setError('Não foi possível mudar o status do item.');
      return;
    }
    await load();
  }

  function edit(item: ShopItem) {
    setEditing(item.id);
    setType(item.type);
    setName(item.name);
    setCost(String(item.cost_xp));
    setDescription(item.description ?? '');
    setImageFile(null);
    setImagePreview(item.image_url);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-white/5 bg-card p-4">
        <h2 className="font-semibold">{editing ? 'Editar item' : 'Novo item'}</h2>
        <div className="space-y-1">
          <Label htmlFor="item-type">Tipo</Label>
          <select
            id="item-type"
            value={type}
            onChange={(event) => setType(event.target.value as ShopItemType)}
            className={selectClass}
          >
            <option value="border">Borda</option>
            <option value="effect">Efeito</option>
            <option value="title">Título</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-name">Nome</Label>
          <Input
            id="item-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
          />
        </div>
        <p className="text-xs text-zinc-400">Identificador gerado: {assetKey || '—'}</p>
        <div className="space-y-1">
          <Label htmlFor="item-cost">Custo em XP</Label>
          <Input
            id="item-cost"
            inputMode="numeric"
            min={1}
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-description">Descrição</Label>
          <Input
            id="item-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-image">Imagem</Label>
          <Input
            id="item-image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void pickImage(file);
            }}
          />
        </div>
        {imagePreview ? <img src={imagePreview} alt="" className="h-24 w-full rounded-xl object-cover" /> : null}
        <FormError message={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Salvando…' : editing ? 'Salvar' : 'Criar'}
          </Button>
          {editing ? (
            <Button type="button" variant="secondary" onClick={reset}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="rounded-xl border border-white/5 bg-card px-4 py-6 text-sm text-zinc-400">
            Nenhum item ainda.
          </li>
        ) : null}
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-card px-4 py-3 text-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : null}
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="truncate text-xs text-zinc-500">
                  {item.type} · {item.asset_key} · {item.cost_xp} XP · {item.active ? 'ativo' : 'inativo'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => edit(item)}>
                Editar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => void toggle(item)}>
                {item.active ? 'Desativar' : 'Ativar'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
