/**
 * Feature flags de build. Cada módulo, fora a autenticação, pode ser
 * desligado com PUBLIC_FEATURE_<NOME>=false. Valor ausente ou vazio liga o módulo.
 * Auth é dependência de base e permanece sempre ativo.
 */
function enabled(value: string | undefined): boolean {
  if (value === undefined || value === '') return true;
  return value === 'true' || value === '1';
}

export const features = {
  auth: true,
  games: enabled(import.meta.env.PUBLIC_FEATURE_GAMES),
  progression: enabled(import.meta.env.PUBLIC_FEATURE_PROGRESSION),
  shop: enabled(import.meta.env.PUBLIC_FEATURE_SHOP),
  feedback: enabled(import.meta.env.PUBLIC_FEATURE_FEEDBACK),
  chat: enabled(import.meta.env.PUBLIC_FEATURE_CHAT),
  admin: enabled(import.meta.env.PUBLIC_FEATURE_ADMIN),
  donations: enabled(import.meta.env.PUBLIC_FEATURE_DONATIONS),
} as const;

export type FeatureKey = keyof typeof features;

export const featureEnv: Record<Exclude<FeatureKey, 'auth'>, string> = {
  games: 'PUBLIC_FEATURE_GAMES',
  progression: 'PUBLIC_FEATURE_PROGRESSION',
  shop: 'PUBLIC_FEATURE_SHOP',
  feedback: 'PUBLIC_FEATURE_FEEDBACK',
  chat: 'PUBLIC_FEATURE_CHAT',
  admin: 'PUBLIC_FEATURE_ADMIN',
  donations: 'PUBLIC_FEATURE_DONATIONS',
};
