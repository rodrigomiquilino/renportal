import { featureEnv, type FeatureKey } from '@/lib/features';

/** Estado vazio quando o build desligou o módulo. */
export function ModuleOff({ name, feature }: { name: string; feature: Exclude<FeatureKey, 'auth'> }) {
  return (
    <section className="rounded-2xl border border-white/5 bg-card px-6 py-10 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Módulo desativado</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{name}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
        Esta parte do RenPortal não entrou neste build. Defina{' '}
        <code className="text-zinc-200">{featureEnv[feature]}=true</code> e gere o site de novo.
      </p>
    </section>
  );
}
