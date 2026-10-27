import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';

type Progress = (ratio: number) => void;

function sendForm(
  url: string,
  method: 'POST' | 'PUT',
  file: Blob,
  headers: Record<string, string>,
  onProgress?: Progress,
) {
  return new Promise<void>((resolve, reject) => {
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      reject(new Error(xhr.responseText || `Upload falhou (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Falha de rede no upload.'));
    xhr.send(body);
  });
}

/** Upload direto no bucket. O RLS decide se a conta pode gravar aquele caminho. */
export async function uploadToBucket(bucket: string, path: string, file: Blob, onProgress?: Progress): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Entre de novo para enviar o arquivo.');
  const safePath = path.split('/').map(encodeURIComponent).join('/');
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${safePath}`;
  await sendForm(
    url,
    'POST',
    file,
    {
      authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      'x-upsert': 'true',
    },
    onProgress,
  );
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Upload com a URL assinada que a Edge Function devolve para o bucket de builds. */
export async function uploadSigned(
  bucket: string,
  path: string,
  token: string,
  file: Blob,
  onProgress?: Progress,
): Promise<void> {
  const safePath = `${bucket}/${path}`.split('/').map(encodeURIComponent).join('/');
  const url = `${supabaseUrl}/storage/v1/object/upload/sign/${safePath}?token=${encodeURIComponent(token)}`;
  await sendForm(url, 'PUT', file, { apikey: supabaseAnonKey, 'x-upsert': 'true' }, onProgress);
}

export function explainUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (
    lower.includes('bucket') ||
    lower.includes('not found') ||
    lower.includes('403') ||
    lower.includes('row-level') ||
    lower.includes('unauthorized')
  ) {
    return 'O armazenamento recusou o arquivo. Aplique a migration 009_media.sql e entre de novo.';
  }
  if (lower.includes('falha de rede')) return message;
  if (lower.includes('entity too large') || lower.includes('payload'))
    return 'O arquivo é grande demais para o bucket.';
  return 'Não foi possível enviar o arquivo.';
}
