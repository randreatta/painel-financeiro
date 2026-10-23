/** Cartões de crédito: fatura de cada cartão, limite comprometido e as próximas 12 faturas. */
import { useState } from 'react';
import { project } from '../../calculos/projecao';
import { fmt, miLabel, miLong, pctF } from '../../calculos/util';
import { BarChart, TipLinha, TipSep, TipTitulo } from '../graficos';
import { CORES, type PropsSecao } from '../comum';

export function Cartoes({ D, scen, hoje }: PropsSecao & { hoje: Date }) {
  const P = project(D, scen, 13, 'casal');
  const usados = new Set(P.flatMap(r => Object.keys(r.faturas)));
  const cards = D.cartoes.filter(c => !c.implicito || usados.has(c.nome));
  // mês padrão: a próxima fatura que ainda não venceu
  const [m, setM] = useState(() => { const vencs = cards.map(c => c.venc).filter(v => v > 0);
    return vencs.length && vencs.every(v => v < hoje.getDate()) ? 1 : 0; });
  if (!cards.length) return null;
  const row = P[Math.min(m, 11)], P12 = P.slice(0, 12);
  return <section className="card span-12">
    <div className="card-head">
      <div><h2>Cartões de crédito</h2><p className="desc">Fatura de cada cartão: o que foi gasto no mês anterior + as parcelas do mês. Passe o mouse no gráfico para ver cada mês.</p></div>
      <select aria-label="Mês da fatura" value={m} onChange={e => setM(+e.target.value)}>
        {P12.map((r, k) => <option key={k} value={k}>Faturas de {miLong(r.i).toLowerCase()}</option>)}
      </select>
    </div>
    <div className="cards-grid">{cards.map((c, k) => {
      const f = row.faturas[c.nome] || { total: 0, items: [] };
      const futuras = D.parcelas.filter(p => p.cartao === c.nome).reduce((a, p) => a + p.valor * Math.max(0, p.lastI - Math.max(p.firstI - 1, row.i)), 0);
      const comp = f.total + futuras, pct = c.limite > 0 ? comp / c.limite : null;
      const nivel = pct == null ? '' : pct >= 0.9 ? 'crit' : pct >= 0.7 ? 'warn' : '';
      const itens = f.items.slice().sort((a, b) => b.v - a.v);
      return <div key={c.nome} className="ccard">
        <h3>{c.nome}<small>{D.names[c.own] || ''}</small></h3>
        <div className="due">{c.venc > 0 ? `Vence ${String(c.venc).padStart(2, '0')}/${String(row.i % 12 + 1).padStart(2, '0')}` : 'Sem dia de vencimento'}{c.fech > 0 ? ` · fecha dia ${c.fech}` : ''}</div>
        <div className="tot">{fmt(f.total)}</div>
        {pct != null && <>
          <div className="meter" role="img" aria-label={`Limite comprometido ${pctF.format(pct)}`}><div style={{ width: `${Math.min(100, pct * 100)}%`, background: CORES[k % CORES.length] }} /></div>
          <div className="meter-l"><span>{fmt(comp)} de {fmt(c.limite)} de limite</span><span className={nivel}>{nivel ? (nivel === 'crit' ? '⚠ ' : '! ') : ''}{pctF.format(pct)}</span></div>
          <div className="meter-n">{futuras > 0 ? `Inclui ${fmt(futuras)} de parcelas que ainda vão vencer` : 'Limite comprometido com esta fatura'}</div>
        </>}
        <ul>{itens.length ? <>
          {itens.slice(0, 7).map((it, j) => <li key={j}><span>{it.desc}{it.tipo === 'parcela' ? ` (${it.n}/${it.de})` : ''}</span><span>{fmt(it.v)}</span></li>)}
          {itens.length > 7 && <li><span>+ {itens.length - 7} itens</span><span>{fmt(itens.slice(7).reduce((a, x) => a + x.v, 0))}</span></li>}
        </> : <li><span>Nada nesta fatura</span><span /></li>}</ul>
      </div>; })}
    </div>
    <h3 className="sub-h">Próximas faturas</h3>
    <div className="legend">{cards.map((c, k) => <span key={c.nome}><i style={{ background: CORES[k % CORES.length] }} />{c.nome}</span>)}</div>
    <BarChart labels={P12.map(r => miLabel(r.i))} height={220}
      series={cards.slice(0, 5).map((c, k) => ({ name: c.nome, color: CORES[k], values: P12.map(r => r.faturas[c.nome]?.total || 0) }))}
      tip={i => <>
        <TipTitulo>Faturas de {miLong(P12[i].i).toLowerCase()}</TipTitulo>
        {cards.slice(0, 5).map((c, k) => <TipLinha key={c.nome} cor={CORES[k]} rotulo={c.nome} valor={fmt(P12[i].faturas[c.nome]?.total || 0)} />)}
        <TipSep />
        <TipLinha rotulo="Total" valor={fmt(Object.values(P12[i].faturas).reduce((a, f) => a + f.total, 0))} />
      </>} />
  </section>;
}
