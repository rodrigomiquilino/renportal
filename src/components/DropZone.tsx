import { useId, useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';

type DropZoneProps = {
  accept: string;
  label: string;
  hint: string;
  fileName?: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
};

export function DropZone({ accept, label, hint, fileName, disabled, onFile }: DropZoneProps) {
  const id = useId();
  const [over, setOver] = useState(false);

  function take(file: File | undefined) {
    if (!file || disabled) return;
    onFile(file);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files[0]);
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-start gap-1 rounded-2xl border border-dashed px-4 py-4 text-sm transition-colors',
        over ? 'border-accent bg-accent/10' : 'border-white/15 bg-white/5',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="font-medium text-zinc-100">{label}</span>
      <span className="text-zinc-400">{fileName || hint}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </label>
  );
}
