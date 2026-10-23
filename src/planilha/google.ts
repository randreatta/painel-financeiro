/** Login com Google (OAuth na mesma aba, sem pop-up) e leitura da planilha pela API do Sheets.
 *  Provisório: na Etapa 3 o login passa para o Cloudflare Access e a leitura para o Worker. */
import type { Raw } from '../calculos/tipos';
import { norm } from '../calculos/util';

const CFG = window.CONFIG || {};
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly openid email';
export const configurado = !!(CFG.CLIENT_ID && CFG.SPREADSHEET_ID && !/COLE_/.test(CFG.CLIENT_ID + CFG.SPREADSHEET_ID));
export const linkPlanilha = configurado ? 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(CFG.SPREADSHEET_ID!) + '/edit' : '';

export interface Sessao { token: string; exp: number; email: string }
export class ErroApi extends Error { constructor(msg: string, public status: number) { super(msg); } }

const ss = {
  get<T>(k: string): T | null { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k: string, v: unknown) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } },
  del(k: string) { try { sessionStorage.removeItem(k); } catch { /* sem storage */ } },
};
const ls = {
  get(k: string) { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
};

/** Endereço para onde o Google devolve depois do login (precisa estar cadastrado no Google Cloud). */
const REDIRECT_URI = location.origin + location.pathname.replace(/index\.html$/, '');

export function entrar() {
  const st = Math.random().toString(36).slice(2) + Date.now().toString(36);
  ss.set('fin_state', st);
  const q = new URLSearchParams({ client_id: CFG.CLIENT_ID!, redirect_uri: REDIRECT_URI, response_type: 'token',
    scope: SCOPES, include_granted_scopes: 'true', state: st, prompt: 'select_account' });
  const hint = ls.get('fin_email'); if (hint) q.set('login_hint', hint);
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + q);
}

/** Lê o retorno do Google (#access_token=… ou #error=…) e limpa o endereço. */
export function lerRetorno(): { erro: string } | { token: string; exp: number } | null {
  if (!location.hash || location.hash.length < 2) return null;
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.has('access_token') && !h.has('error')) return null;
  history.replaceState(null, '', location.pathname + location.search);
  const esperado = ss.get<string>('fin_state'); ss.del('fin_state');
  if (h.get('error')) return { erro: h.get('error') === 'access_denied'
    ? 'Login cancelado ou conta não autorizada (ela está nos usuários de teste do Google Cloud?).' : 'Login não concluído: ' + h.get('error') };
  if (!esperado || h.get('state') !== esperado) return { erro: 'Retorno de login inválido. Tente entrar de novo.' };
  if (!(h.get('scope') || '').includes('spreadsheets')) return { erro: 'Faltou permitir a leitura das planilhas. Entre de novo e marque essa permissão.' };
  return { token: h.get('access_token')!, exp: Date.now() + (Number(h.get('expires_in') || 3600) - 60) * 1000 };
}

export async function concluirLogin(tok: { token: string; exp: number }): Promise<Sessao> {
  let email = '';
  try {
    const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + tok.token } });
    if (u.ok) email = (await u.json()).email || '';
  } catch { /* segue sem e-mail */ }
  const s = { ...tok, email };
  ss.set('fin_auth', s);
  if (email) ls.set('fin_email', email);
  return s;
}

export function sessaoSalva(): Sessao | null {
  const s = ss.get<Sessao>('fin_auth');
  return s && s.token && Date.now() < s.exp ? s : null;
}

export function sair(s: Sessao | null) {
  if (s?.token) fetch('https://oauth2.googleapis.com/revoke', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'token=' + encodeURIComponent(s.token) }).catch(() => {});
  ss.del('fin_auth');
}

async function api(url: string, token: string) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (r.ok) return r.json();
  let msg = ''; try { msg = (await r.json()).error.message; } catch { /* sem corpo */ }
  throw new ErroApi(msg || 'HTTP ' + r.status, r.status);
}

/** Todas as abas (menos "Como usar") como { aba: [ { cabeçalho: valor } ] }, datas como número de série. */
export async function lerPlanilha(token: string): Promise<Raw> {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(CFG.SPREADSHEET_ID!);
  const meta = await api(base + '?fields=properties.title,sheets.properties.title', token);
  const titulos: string[] = meta.sheets.map((s: { properties: { title: string } }) => s.properties.title).filter((t: string) => norm(t) !== 'comousar');
  const qs = titulos.map(t => 'ranges=' + encodeURIComponent("'" + t.replace(/'/g, "''") + "'")).join('&');
  const data = await api(`${base}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`, token);
  const raw: Raw = { _planilha: meta.properties.title };
  (data.valueRanges || []).forEach((vr: { values?: unknown[][] }, k: number) => {
    const rows = vr.values || [], hdr = (rows[0] || []).map(c => String(c).trim());
    raw[titulos[k]] = rows.slice(1).map(row => { const o: Record<string, unknown> = {}; hdr.forEach((h, i) => { if (h) o[h] = row[i] === undefined ? '' : row[i]; }); return o; })
      .filter(o => Object.values(o).some(v => v !== '' && v != null));
  });
  return raw;
}
