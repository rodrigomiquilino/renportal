import { useEffect, useState } from 'react';

type ToastItem = { id: number; message: string };

/** Escuta `toast()` e mostra avisos no canto da tela. */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (!message) return;
      const id = Date.now() + Math.random();
      setItems((current) => [...current, { id, message }]);
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, 3600);
    };
    window.addEventListener('renportal:toast', onToast);
    return () => window.removeEventListener('renportal:toast', onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(100%-2rem,22rem)] flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className="pointer-events-auto rounded-xl border border-white/10 bg-card px-4 py-3 text-sm text-zinc-100 shadow-2xl"
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
