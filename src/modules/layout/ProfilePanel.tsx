import { ProfileCard } from '@/modules/layout/ProfileCard'

/** Coluna direita do dashboard, visível em telas largas. */
export function ProfilePanel() {
  return (
    <aside aria-label="Seu progresso" className="sticky top-0 hidden h-screen w-[300px] shrink-0 overflow-y-auto border-l border-white/5 p-4 xl:block">
      <ProfileCard />
    </aside>
  )
}
