import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordMeter } from '@/components/PasswordMeter';

type PasswordFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  showMeter?: boolean;
  error?: string | null;
};

export function PasswordField({
  label = 'Senha',
  value,
  onChange,
  autoComplete,
  showMeter,
  error,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const meterId = `${id}-meter`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={showMeter ? 8 : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={showMeter ? meterId : undefined}
          className="pr-10"
        />
        <button
          type="button"
          className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showMeter ? <PasswordMeter id={meterId} password={value} /> : null}
      {error ? <p className="text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
