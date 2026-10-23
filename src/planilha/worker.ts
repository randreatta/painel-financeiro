/** Leitura dos dados pelo Worker do Cloudflare (/api/dados). O login é feito antes, pelo Cloudflare Access. */
import type { Raw } from '../calculos/tipos';

export class ErroWorker extends Error { constructor(msg: string, public status: number) { super(msg); } }

/** null = este site não tem o Worker (ex.: ainda no GitHub Pages). */
export async function lerViaWorker(): Promise<{ raw: Raw; email: string } | null> {
  let r: Response;
  try { r = await fetch('/api/dados', { headers: { accept: 'application/json' }, credentials: 'same-origin' }); }
  catch { return null; }
  if (!(r.headers.get('content-type') || '').includes('application/json')) return null;   // sem Worker: veio HTML ou 404 do Pages
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroWorker(body.erro || `Erro ${r.status} ao ler os dados.`, r.status);
  return { raw: body.raw, email: body.email || '' };
}

/** Sai do Cloudflare Access (encerra a sessão neste navegador). */
export const sairDoAccess = () => { location.href = '/cdn-cgi/access/logout'; };
