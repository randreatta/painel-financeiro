/** Números que o painel mostra, derivados da projeção (sem nada de tela, para poder testar). */
import { project, weight, type Mes } from './projecao';
import type { Cenario, Dados, Dono, Visao } from './tipos';
import { mi, miLabel, fmt } from './util';

export interface Derivados {
  P: Mes[]; PS: Record<Cenario, Mes[]>; P12: Mes[]; cur: Mes; last: Mes;
  /** Média mensal de saídas nos próximos 12 meses (base da reserva de emergência). */
  avgOut: number; patHoje: number; meta: number; reservaHoje: number; atingeMeta: Mes | undefined; taxaPoupanca: number;
}

export function derivar(D: Dados, scen: Cenario, who: Visao, N: number): Derivados {
  const P = project(D, scen, N, who);
  const PS = { base: project(D, 'base', N, who), otimista: project(D, 'otimista', N, who), pessimista: project(D, 'pessimista', N, who) };
  const P12 = project(D, scen, 12, who), cur = P[0], last = P[N - 1];
  const avgOut = P12.reduce((a, r) => a + r.saidas, 0) / 12;
  const patHoje = D.prem.saldoConta * weight(D, 'casal', who) + D.invest.reduce((a, x) => a + x.saldo * weight(D, x.own, who), 0);
  const meta = D.prem.metaReserva;
  return { P, PS, P12, cur, last, avgOut, patHoje, meta,
    reservaHoje: avgOut > 0 ? patHoje / avgOut : 0,
    atingeMeta: P.find(r => r.pat / avgOut >= meta),
    taxaPoupanca: cur.rec > 0 ? (cur.rec - cur.saidas) / cur.rec : 0 };
}

/** Gasto médio mensal por categoria nos próximos 12 meses, do maior para o menor. */
export function categorias(P12: Mes[]): { label: string; value: number }[] {
  const cats: Record<string, number> = {};
  P12.forEach(r => { for (const k in r.cats) cats[k] = (cats[k] || 0) + r.cats[k] / 12; });
  return Object.entries(cats).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** Receitas e despesas reais por mês (aba Lançamentos), últimos 12 meses com dados. */
export function historico(D: Dados, who: Visao): { i: number; rec: number; desp: number }[] {
  const hist: Record<number, { rec: number; desp: number }> = {};
  D.lanc.forEach(l => {
    const w = weight(D, l.own, who); if (!w) return;
    const i = mi(l.data); hist[i] = hist[i] || { rec: 0, desp: 0 }; hist[i][l.tipo === 'receita' ? 'rec' : 'desp'] += l.valor * w;
  });
  return Object.keys(hist).map(Number).sort((a, b) => a - b).slice(-12).map(i => ({ i, ...hist[i] }));
}

export interface EventoFuturo { i: number; t: string; s: string; v: number; sign: 1 | -1 | 0 }
/** Receitas/despesas anuais e únicas, últimas parcelas e itens mensais que terminam, nos próximos 12 meses. */
export function proximosEventos(D: Dados, who: Visao, P12: Mes[]): EventoFuturo[] {
  const ev: EventoFuturo[] = [];
  P12.forEach(r => {
    r.recItems.forEach(it => ev.push({ i: r.i, t: it.desc, s: (it.freq === 'anual' ? 'Receita anual' : 'Receita única') + (who === 'casal' ? ' · ' + D.names[it.own] : ''), v: it.v, sign: 1 }));
    r.expItems.forEach(it => ev.push({ i: r.i, t: it.desc, s: (it.freq === 'anual' ? 'Despesa anual' : 'Despesa única') + ' · ' + it.cat + (who === 'casal' ? ' · ' + D.names[it.own] : it.own === 'casal' ? ' · parte no casal' : ''), v: it.v, sign: -1 }));
  });
  const tagOf = (own: Dono) => who === 'casal' ? ' · ' + D.names[own] : (own === 'casal' ? ' · parte no casal' : '');
  D.parcelas.forEach(p => { const w = weight(D, p.own, who); if (w && p.lastI < D.start + 12) ev.push({ i: p.lastI, t: `Última parcela: ${p.desc}`, s: `Libera ${fmt(p.valor * w)}/mês a partir de ${miLabel(p.lastI + 1)}${tagOf(p.own)}`, v: p.valor * w, sign: 0 }); });
  D.receitas.concat(D.despesas).forEach(it => { const w = weight(D, it.own, who); if (w && it.freq === 'mensal' && it.fimI != null && it.fimI >= D.start && it.fimI < D.start + 12)
    ev.push({ i: it.fimI, t: `Termina: ${it.desc}`, s: 'Último mês do item mensal' + tagOf(it.own), v: it.valor * w, sign: 0 }); });
  return ev.sort((a, b) => a.i - b.i || b.v - a.v);
}
