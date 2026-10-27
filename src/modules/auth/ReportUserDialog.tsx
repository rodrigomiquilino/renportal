import { useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormError } from '@/components/FormError';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import type { ReportReason } from '@/lib/database.types';

const reasons: Array<{ id: ReportReason; label: string }> = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Assédio' },
  { id: 'adult', label: 'Conteúdo adulto fora de lugar' },
  { id: 'other', label: 'Outro' },
];

export function ReportUserDialog({ userId, username }: { userId: string; username: string }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!session || session.user.id === userId) return null;

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setPending(true);
    setError(null);
    const { error: insertError } = await supabase.from('user_reports').insert({
      reporter_id: session.user.id,
      target_id: userId,
      reason,
      details: details.trim() || null,
    });
    setPending(false);
    if (insertError) {
      setError(authErrorMessage(insertError.message));
      return;
    }
    toast('Denúncia enviada. Um admin vê isso na lista de usuários.');
    setDetails('');
    setOpen(false);
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Denunciar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar @{username}</DialogTitle>
            <DialogDescription>O admin lê o motivo. A pessoa não é avisada de quem denunciou.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label htmlFor={`report-${userId}`}>Motivo</Label>
              <select
                id={`report-${userId}`}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#16161e] px-3 text-sm"
                value={reason}
                onChange={(event) => setReason(event.target.value as ReportReason)}
              >
                {reasons.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`report-details-${userId}`}>Detalhe, se quiser</Label>
              <Textarea
                id={`report-details-${userId}`}
                value={details}
                maxLength={500}
                onChange={(event) => setDetails(event.target.value)}
              />
            </div>
            <FormError message={error} />
            <Button type="submit" disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar denúncia'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
