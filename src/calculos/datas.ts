/** Dias úteis e datas de pagamento: sem domingo, sem feriado nacional; sábado conforme Premissas. */
import { norm, parseNum } from './util';

/** Dias do mês de índice i. */
export const mlen = (i: number): number => new Date(Math.floor(i / 12), i % 12 + 1, 0).getDate();

const cache: Record<number, Set<string>> = {};
/** Feriados nacionais ("m-d"): fixos, 20/11 e Sexta-feira Santa (Páscoa pelo algoritmo de Meeus). */
export function feriados(y: number): Set<string> {
  if (cache[y]) return cache[y];
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, k = Math.floor(c / 4), l = c % 4,
    L = (32 + 2 * e + 2 * k - h - l) % 7, m = Math.floor((a + 11 * h + 22 * L) / 451),
    mes = Math.floor((h + L - 7 * m + 114) / 31), dia = ((h + L - 7 * m + 114) % 31) + 1;
  const sexta = new Date(y, mes - 1, dia - 2);
  return (cache[y] = new Set(['1-1', '4-21', '5-1', '9-7', '10-12', '11-2', '11-15', '11-20', '12-25', `${sexta.getMonth() + 1}-${sexta.getDate()}`]));
}

export function diaUtil(i: number, d: number, sabadoConta: boolean): boolean {
  const y = Math.floor(i / 12), mo = i % 12, wd = new Date(y, mo, d).getDay();
  if (wd === 0 || (wd === 6 && !sabadoConta)) return false;
  return !feriados(y).has(`${mo + 1}-${d}`);
}

/** Dia em que um pagamento cai no mês i: "5º dia útil", "último dia útil" ou dia fixo (fim de semana/feriado → antes). */
export function payDay(sabadoUtil: boolean, spec: unknown, i: number): number {
  const n = mlen(i), s = norm(spec);
  const m = s.match(/^(\d+)diautil$/);
  if (m) {   // o sábado conta no prazo (CLT), mas se o prazo cair num sábado o crédito vem no dia útil anterior
    let k = 0, d = 1;
    for (; d <= n; d++) if (diaUtil(i, d, sabadoUtil) && ++k === +m[1]) break;
    d = Math.min(d, n); while (d > 1 && !diaUtil(i, d, false)) d--;
    return d;
  }
  if (s.startsWith('ultimodiautil')) { for (let d = n; d >= 1; d--) if (diaUtil(i, d, false)) return d; return n; }
  const fixo = Math.round(parseNum(spec));
  if (fixo > 0) { let d = Math.min(fixo, n); while (d > 1 && !diaUtil(i, d, false)) d--; return d; }
  return 1;
}
