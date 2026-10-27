import { useEffect, useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import type { ShopItem, ShopItemType } from '@/lib/database.types'

export function ShopAdmin() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [type, setType] = useState<ShopItemType>('border')
  const [name, setName] = useState('')
  const [assetKey, setAssetKey] = useState('')
  const [cost, setCost] = useState('40')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: loadError } = await supabase.from('shop_items').select('*').order('cost_xp')
    if (loadError) {
      setError('Não foi possível ler a loja.')
      return
    }
    setItems(data ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const { error: insertError } = await supabase.from('shop_items').insert({
      type,
      name: name.trim(),
      asset_key: assetKey.trim(),
      cost_xp: Number(cost),
      description: description.trim() || null,
      active: true,
    })
    if (insertError) {
      setError('Não foi possível criar o item. A chave precisa ser única naquele tipo.')
      return
    }
    toast('Item criado.')
    setName('')
    setAssetKey('')
    setDescription('')
    await load()
  }

  async function toggle(item: ShopItem) {
    await supabase.from('shop_items').update({ active: !item.active }).eq('id', item.id)
    await load()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-white/5 bg-card p-4">
        <h2 className="font-semibold">Novo item</h2>
        <select value={type} onChange={(event) => setType(event.target.value as ShopItemType)} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm">
          <option value="border">Borda</option>
          <option value="effect">Efeito</option>
          <option value="title">Título</option>
        </select>
        <Input placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input placeholder="asset_key" value={assetKey} onChange={(event) => setAssetKey(event.target.value)} required />
        <Input placeholder="Custo em XP" value={cost} onChange={(event) => setCost(event.target.value)} required />
        <Input placeholder="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} />
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
        <Button type="submit">Criar</Button>
      </form>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-card px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-zinc-500">{item.type} · {item.asset_key} · {item.cost_xp} XP · {item.active ? 'ativo' : 'inativo'}</p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => toggle(item)}>
              {item.active ? 'Desativar' : 'Ativar'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
