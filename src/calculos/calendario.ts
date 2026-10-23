/** Saldo em conta dia a dia. Parte do saldo de hoje (Premissas) e, no mês atual, só conta o que ainda vai acontecer. */
import { mlen } from './datas';
import { project, weight, type Evento } from './projecao';
import type { Cenario, Dados, Visao } from './tipos';

export type EventoCal = Omit<Evento, 'dia'> & { dia: number; semDia: boolean };
export interface MesCalendario {
  i: number; first: number; n: number; start: number; end: number; min: { v: number; dia: number };
  ev: EventoCal[]; days: { d: number; v: number }[]; entradas: number; saidas: number; passados: number;
}

export function calendarMonths(D: Dados, scen: Cenario, who: Visao, upto: number, hoje: Date = new Date()): MesCalendario[] {
  const P = project(D, scen, upto + 1, who), dHoje = hoje.getDate();
  let bal = D.prem.saldoConta * weight(D, 'casal', who);
  const out: MesCalendario[] = [];
  for (let m = 0; m <= upto; m++) {
    const i = P[m].i, n = mlen(i), first = m === 0 ? Math.min(dHoje + 1, n) : 1;
    const ev: EventoCal[] = P[m].ev.map(e => ({ ...e, semDia: e.dia == null, dia: e.dia == null ? first : e.dia }))
      .filter(e => m > 0 || (!e.semDia && e.dia > dHoje))
      .sort((a, b) => a.dia - b.dia || b.v - a.v);
    const start = bal, days: { d: number; v: number }[] = [];
    let min = { v: Infinity, dia: first };
    for (let d = first; d <= n; d++) {
      ev.filter(e => e.dia === d).forEach(e => { bal += e.v; });
      days.push({ d, v: bal });
      if (bal < min.v) min = { v: bal, dia: d };
    }
    out.push({ i, first, n, start, end: bal, min, ev, days, entradas: ev.filter(e => e.v > 0).reduce((a, e) => a + e.v, 0),
      saidas: -ev.filter(e => e.v < 0).reduce((a, e) => a + e.v, 0), passados: m === 0 ? P[0].ev.length - ev.length : 0 });
  }
  return out;
}
