/** Utilidades de texto, número, data e formatação (pt-BR). */

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Normaliza nomes de abas, colunas e chaves: minúsculas, sem acento, só letras e números. */
export const norm = (s: unknown): string =>
  String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Número a partir de célula: aceita número, "R$ 1.234,56", "4,5%". NaN se vazio/ inválido. */
export function parseNum(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  if (v == null) return NaN;
  let s = String(v).trim();
  if (!s) return NaN;
  const pct = s.endsWith('%');
  s = s.replace(/R\$|%|\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return pct ? n / 100 : n;
}

/** Data a partir de célula: número de série do Sheets, ISO, dd/mm/aaaa ou mm/aaaa. Sem hora. */
export function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +(m[3] || 1));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[2], +m[1] - 1, 1);
  return null;
}

/** Percentual como fração: aceita 0,045 e também 4,5 (vira 0,045). */
export const pctVal = (v: unknown): number => { const n = parseNum(v); return isNaN(n) ? NaN : (Math.abs(n) > 1 ? n / 100 : n); };

/** Índice de mês (ano × 12 + mês) — a unidade de tempo do motor. */
export const mi = (d: Date): number => d.getFullYear() * 12 + d.getMonth();
export const miLabel = (i: number): string => MESES[i % 12] + '/' + String(Math.floor(i / 12)).slice(2);
export const miLong = (i: number): string => { const m = MESES[i % 12]; return m[0].toUpperCase() + m.slice(1) + ' de ' + Math.floor(i / 12); };

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const pctF = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
export const fmt = (v: number): string => brl.format(Math.round(v));
export function fmtShort(v: number): string {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return s + 'R$ ' + (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (a >= 1e3) return s + 'R$ ' + (a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: a >= 1e4 ? 0 : 1 }) + ' mil';
  return s + 'R$ ' + Math.round(a);
}
