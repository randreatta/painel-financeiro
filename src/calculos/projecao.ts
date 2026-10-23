/** Motor de projeção mês a mês: receitas (com folha), despesas (com cartão no mês seguinte), parcelas, investimentos. */
import { mlen, payDay } from './datas';
import { folhaOf } from './folha';
import type { Cenario, Dados, Dono, Item, Visao } from './tipos';

/** Peso de um item na visão: tudo (casal), só o da pessoa, + a parte dela no que é do casal. */
export function weight(D: Dados, own: Dono, who: Visao): number {
  if (who === 'casal' || own === who) return 1;
  if (own === 'casal') return who === 'p1' ? D.share1 : 1 - D.share1;
  return 0;
}

export function occurs(it: Item, i: number): boolean {
  if (it.freq === 'mensal') return (it.iniI == null || i >= it.iniI) && (it.fimI == null || i <= it.fimI);
  if (it.freq === 'anual') return i >= (it.iniI as number) && (i - (it.iniI as number)) % 12 === 0 && (it.fimI == null || i <= it.fimI);
  return i === it.iniI;
}

/** Algo com data dentro do mês: entrada (+) ou saída (−). dia = null quando a planilha não diz o dia. */
export interface Evento { dia: number | null; desc: string; own: Dono; v: number; pago?: Item['pago'] | null; fatura?: boolean; aporte?: boolean }
export interface ItemFatura { desc: string; v: number; own: Dono; tipo: 'compra' | 'parcela'; n?: number; de?: number }
export type ItemValor = Item & { v: number };

export interface Mes {
  i: number; rec: number; recBruta: number; inss: number; irrf: number;
  desp: number; fixas: number; variaveis: number; despProprias: number; despCasal: number; parc: number; aportes: number; cartao: number;
  saidas: number; sobra: number; conta: number; invest: number; pat: number;
  cats: Record<string, number>; recItems: ItemValor[]; expItems: ItemValor[]; casalItems: ItemValor[];
  faturas: Record<string, { total: number; items: ItemFatura[] }>; ev: Evento[]; fatW: Record<string, number>;
}

export function project(D: Dados, scen: Cenario, N: number, who: Visao = 'casal'): Mes[] {
  const p = D.prem;
  const infl = p.inflacao + (scen === 'otimista' ? p.otInf : scen === 'pessimista' ? p.peInf : 0);
  const varAdj = scen === 'otimista' ? p.otVar : scen === 'pessimista' ? p.peVar : 0;
  const W = (own: Dono) => weight(D, own, who);
  let conta = p.saldoConta * W('casal'), reajN = 0;
  const inv = D.invest.filter(x => W(x.own) > 0).map(x => ({ ...x, saldo: x.saldo * W(x.own), aporte: x.aporte * W(x.own), rm: Math.pow(1 + x.taxa, 1 / 12) - 1 }));
  const out: Mes[] = [];
  for (let m = 0; m < N; m++) {
    const i = D.start + m;
    if (m > 0 && p.mesReajuste >= 1 && (i % 12) + 1 === p.mesReajuste) reajN++;
    const fInc = Math.pow(1 + p.reajuste, reajN), fExp = Math.pow(1 + infl, m / 12);
    const r: Mes = { i, rec: 0, desp: 0, fixas: 0, variaveis: 0, despProprias: 0, despCasal: 0, parc: 0, aportes: 0, cartao: 0, inss: 0, irrf: 0, recBruta: 0,
      saidas: 0, sobra: 0, conta: 0, invest: 0, pat: 0, cats: {}, recItems: [], expItems: [], casalItems: [], faturas: {}, ev: [], fatW: {} };
    const fat = (nome: string, item: ItemFatura) => { const f = r.faturas[nome] = r.faturas[nome] || { total: 0, items: [] }; f.total += item.v; f.items.push(item); };
    for (const it of D.receitas) { const w = W(it.own); if (w && occurs(it, i)) {
      const bruto = it.valor * (it.reaj ? fInc : 1), fo = it.folha ? folhaOf(D.irrf, bruto) : { inss: 0, irrf: 0, total: 0 };
      const v = (bruto - fo.total) * w; r.rec += v; r.recBruta += bruto * w; r.inss += fo.inss * w; r.irrf += fo.irrf * w;
      if (it.freq !== 'mensal') r.recItems.push({ ...it, v });
      const pag = it.pag || D.pagPadrao[it.own] || '';
      if (it.adPct > 0 && it.adDia > 0) {          // adiantamento = % do bruto; o saldo já vem sem INSS/IRRF
        const adv = Math.min(v, bruto * it.adPct * w);
        r.ev.push({ dia: payDay(p.sabadoUtil, it.adDia, i), desc: `${it.desc} (adiantamento)`, own: it.own, v: adv });
        r.ev.push({ dia: payDay(p.sabadoUtil, pag, i), desc: `${it.desc} (saldo)`, own: it.own, v: v - adv });
      } else r.ev.push({ dia: payDay(p.sabadoUtil, pag, i), desc: it.desc, own: it.own, v });
    } }
    for (const it of D.despesas) { if (!occurs(it, it.cartao ? i - 1 : i)) continue;   // cartão: paga na fatura do mês seguinte
      const full = it.valor * (it.reaj ? fExp : 1) * (it.tipo === 'variavel' ? 1 + varAdj : 1);
      if (it.cartao) fat(it.cartao, { desc: it.desc, v: full, own: it.own, tipo: 'compra' });
      if (it.own === 'casal') r.casalItems.push({ ...it, v: full });
      const w = W(it.own); if (!w) continue;
      const v = full * w;
      if (it.cartao) { r.cartao += v; r.fatW[it.cartao] = (r.fatW[it.cartao] || 0) + v; }
      else r.ev.push({ dia: it.dia > 0 ? Math.min(it.dia, mlen(i)) : null, desc: it.desc, own: it.own, v: -v, pago: it.own === 'casal' ? it.pago : null });
      r.desp += v; r[it.tipo === 'variavel' ? 'variaveis' : 'fixas'] += v;
      r[it.own === 'casal' && who !== 'casal' ? 'despCasal' : 'despProprias'] += v;
      r.cats[it.cat] = (r.cats[it.cat] || 0) + v;
      if (it.freq !== 'mensal') r.expItems.push({ ...it, v });
    }
    for (const pa of D.parcelas) { if (i < pa.firstI || i > pa.lastI) continue;
      if (pa.cartao) fat(pa.cartao, { desc: pa.desc, v: pa.valor, own: pa.own, tipo: 'parcela', n: i - pa.firstI + 1, de: pa.rest });
      const w = W(pa.own); if (!w) continue;
      r.parc += pa.valor * w; r.cats['Parcelas'] = (r.cats['Parcelas'] || 0) + pa.valor * w;
      if (pa.cartao) { r.cartao += pa.valor * w; r.fatW[pa.cartao] = (r.fatW[pa.cartao] || 0) + pa.valor * w; }
      else r.ev.push({ dia: pa.prox ? Math.min(pa.prox.getDate(), mlen(i)) : null, desc: `${pa.desc} (parcela)`, own: pa.own, v: -pa.valor * w });
    }
    let invTotal = 0;
    for (const x of inv) { x.saldo = x.saldo * (1 + x.rm) + x.aporte; r.aportes += x.aporte; invTotal += x.saldo; }
    for (const nome in r.fatW) {
      const c = D.cartoes.find(c => c.nome === nome);
      r.ev.push({ dia: c && c.venc > 0 ? Math.min(c.venc, mlen(i)) : null, desc: `Fatura ${nome}`, own: c ? c.own : 'casal', v: -r.fatW[nome], fatura: true });
    }
    if (r.aportes > 0) {   // aportes: no dia da maior entrada do mês (quando o salário cai)
      const top = r.ev.filter(e => e.v > 0).sort((a, b) => b.v - a.v)[0];
      r.ev.push({ dia: top ? top.dia : 1, desc: 'Aportes nos investimentos', own: 'casal', v: -r.aportes, aporte: true });
    }
    r.saidas = r.desp + r.parc;
    r.sobra = r.rec - r.saidas - r.aportes;
    conta += r.sobra;
    r.conta = conta; r.invest = invTotal; r.pat = conta + invTotal;
    out.push(r);
  }
  return out;
}
