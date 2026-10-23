/** Lê todas as abas da planilha (menos "Como usar") como { aba: [ { cabeçalho: valor } ] },
 *  com valores sem formatação e datas como número de série — o mesmo formato que o painel já entende. */
import { Erro } from './erro';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function api(url: string, token: string) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (r.ok) return r.json() as Promise<any>;
  if (r.status === 403) throw new Erro(502, 'A conta de serviço não tem acesso à planilha. Compartilhe a planilha com o e-mail dela (Leitor).');
  if (r.status === 404) throw new Erro(502, 'Planilha não encontrada. Confira o SPREADSHEET_ID do Worker.');
  throw new Erro(502, `O Google Sheets respondeu ${r.status}.`);
}

export async function lerAbas(spreadsheetId: string, token: string): Promise<Record<string, unknown>> {
  if (!spreadsheetId) throw new Erro(500, 'Worker sem SPREADSHEET_ID.');
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId);
  const meta = await api(base + '?fields=properties.title,sheets.properties.title', token);
  const titulos: string[] = meta.sheets.map((s: { properties: { title: string } }) => s.properties.title).filter((t: string) => norm(t) !== 'comousar');
  const qs = titulos.map(t => 'ranges=' + encodeURIComponent("'" + t.replace(/'/g, "''") + "'")).join('&');
  const data = await api(`${base}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`, token);
  const raw: Record<string, unknown> = { _planilha: meta.properties.title };
  (data.valueRanges || []).forEach((vr: { values?: unknown[][] }, k: number) => {
    const rows = vr.values || [], hdr = (rows[0] || []).map(c => String(c).trim());
    raw[titulos[k]] = rows.slice(1).map(row => { const o: Record<string, unknown> = {}; hdr.forEach((h, i) => { if (h) o[h] = row[i] === undefined ? '' : row[i]; }); return o; })
      .filter(o => Object.values(o).some(v => v !== '' && v != null));
  });
  return raw;
}
