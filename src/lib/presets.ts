import { assetUrl } from '@/lib/paths';

export const avatarPresets = [
  { id: 'fox', label: 'Raposa' },
  { id: 'moon', label: 'Lua' },
  { id: 'book', label: 'Livro' },
  { id: 'star', label: 'Estrela' },
  { id: 'cat', label: 'Gato' },
  { id: 'train', label: 'Trem' },
] as const;

export type AvatarPresetId = (typeof avatarPresets)[number]['id'];

export function presetValue(id: string): string {
  return `preset:${id}`;
}

export function resolveMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('preset:')) {
    const id = value.slice('preset:'.length);
    if (!/^[a-z0-9-]{1,32}$/.test(id)) return null;
    return assetUrl(`avatars/${id}.svg`);
  }
  return value;
}
