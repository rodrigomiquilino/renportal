import { Gamepad2, Heart, Home, MessagesSquare, Shield, ShoppingBag, Trophy, type LucideIcon } from 'lucide-react';
import type { FeatureKey } from '@/lib/features';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  adminOnly?: boolean;
};

/** Rotas do menu. Itens de módulo somem quando a flag daquele módulo está off. */
export const navItems: NavItem[] = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/games/', label: 'Jogos', icon: Gamepad2, feature: 'games' },
  { href: '/shop/', label: 'Loja', icon: ShoppingBag, feature: 'shop' },
  { href: '/rankings/', label: 'Rankings', icon: Trophy, feature: 'progression' },
  { href: '/apoiar/', label: 'Apoiar', icon: Heart },
  { href: '/chat/', label: 'Chat', icon: MessagesSquare, feature: 'chat' },
  { href: '/admin/', label: 'Admin', icon: Shield, feature: 'admin', adminOnly: true },
];
