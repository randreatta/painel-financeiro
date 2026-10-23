/** Fluxo mensal, composição do mês, patrimônio nos três cenários, categorias e histórico real. */
import { categorias, historico } from '../../calculos/painel';
import type { Cenario } from '../../calculos/tipos';
import { fmt, fmtShort, miLabel, miLong, pctF } from '../../calculos/util';
import { BarChart, HBarChart, LineChart, TipLinha, TipSep, TipTitulo } from '../graficos';
import { SCEN, neg, type PropsSecao } from '../comum';

export function Fluxo({ d }: PropsSecao) {
  const { P } = d;
  return <section className="card span-8">
    <div className="card-head">
      <div><h2>Fluxo mensal projetado</h2><p className="desc">Entradas x saídas (despesas + parcelas) mês a mês. Passe o mouse para ver o detalhe.</p></div>
      <div className="legend"><span><i style={{ background: 'var(--s1)' }} />Receitas</span><span><i style={{ background: 'var(--s2)' }} />Saídas</span></div>
    </div>
    <BarChart labels={P.map(r => miLabel(r.i))}
      series={[{ name: 'Receitas', color: 'var(--s1)', values: P.map(r => r.rec) }, { name: 'Saídas', color: 'var(--s2)', values: P.map(r => r.saidas) }]}
      tip={i => { const r = P[i], extras = [...r.recItems, ...r.expItems];
        return <>
          <TipTitulo>{miLong(r.i)}</TipTitulo>
          <TipLinha cor="var(--s1)" rotulo="Receitas (líquidas)" valor={fmt(r.rec)} />
          {r.inss > 0 && <TipLinha recuo rotulo="INSS descontado" valor={fmt(r.inss)} />}
          {r.irrf > 0 && <TipLinha recuo rotulo="IRRF descontado" valor={fmt(r.irrf)} />}
          <TipLinha cor="var(--s2)" rotulo="Saídas" valor={fmt(r.saidas)} />
          <TipLinha recuo rotulo="fixas" valor={fmt(r.fixas)} />
          <TipLinha recuo rotulo="variáveis" valor={fmt(r.variaveis)} />
          <TipLinha recuo rotulo="parcelas" valor={fmt(r.parc)} />
          {r.cartao > 0 && <TipLinha recuo rotulo="(no cartão)" valor={fmt(r.cartao)} />}
          <TipLinha rotulo="Aportes" valor={fmt(r.aportes)} />
          <TipSep />
          <TipLinha rotulo="Sobra" valor={fmt(r.sobra)} classe={neg(r.sobra)} />
          <TipLinha rotulo="Saldo em conta" valor={fmt(r.conta)} classe={neg(r.conta)} />
          {extras.length > 0 && <><TipSep />{extras.map((it, k) => <TipLinha key={k} rotulo={it.desc} valor={fmt(it.v)} />)}</>}
        </>; }} />
  </section>;
}

export function Composicao({ d }: PropsSecao) {
  const { cur } = d;
  const parts: [string, number, string][] = [['Despesas fixas', cur.fixas, 'var(--s1)'], ['Despesas variáveis', cur.variaveis, 'var(--s2)'],
    ['Parcelas', cur.parc, 'var(--s3)'], ['Aportes', cur.aportes, 'var(--s4)'], ['Sobra', Math.max(0, cur.sobra), 'var(--s5)']];
  const tot = Math.max(cur.rec, parts.reduce((a, p) => a + p[1], 0)) || 1;
  return <section className="card span-4">
    <h2>Para onde vai a receita deste mês</h2>
    <p className="desc">Cada parte como fração da receita de {miLong(cur.i).toLowerCase()} ({fmt(cur.rec)}).</p>
    <div className="comp">{parts.filter(p => p[1] > 0).map(p => <div key={p[0]} title={`${p[0]}: ${fmt(p[1])}`} style={{ flex: p[1], background: p[2] }} />)}</div>
    <div className="comp-legend">
      {parts.map(p => <span key={p[0]} style={{ display: 'contents' }}>
        <span className="n"><i style={{ width: 10, height: 10, borderRadius: 3, background: p[2], display: 'inline-block' }} />{p[0]}</span>
        <span>{fmt(p[1])}</span><span className="p">{pctF.format(p[1] / tot)}</span>
      </span>)}
      {cur.sobra < 0 && <span className="n" style={{ gridColumn: '1/-1', color: 'var(--critical)' }}>Faltam {fmt(-cur.sobra)} para fechar o mês.</span>}
    </div>
  </section>;
}

export function Patrimonio({ D, scen, who, d }: PropsSecao) {
  const { P, PS, avgOut, meta } = d;
  const ordem: Cenario[] = ['otimista', 'base', 'pessimista'];
  return <section className="card span-7">
    <div className="card-head">
      <div><h2>Patrimônio projetado</h2><p className="desc">{who === 'casal'
        ? 'Conta + investimentos do casal ao fim de cada mês, nos três cenários.'
        : `Patrimônio de ${D.names[who]}: o que é dele(a) + a parte nos itens do casal (${pctF.format(who === 'p1' ? D.share1 : 1 - D.share1)}).`}</p></div>
      <div className="legend">{ordem.map(k => <span key={k}><i className="line" style={{ background: SCEN[k].color }} />{SCEN[k].name}</span>)}
        <span><i className="dash" />Meta da reserva</span></div>
    </div>
    <LineChart labels={P.map(r => miLabel(r.i))}
      series={ordem.map(k => ({ name: SCEN[k].name, color: SCEN[k].color, values: PS[k].map(r => r.pat), emph: k === scen }))}
      refLine={avgOut > 0 ? { value: meta * avgOut, label: `Meta: ${meta} meses de despesa (${fmtShort(meta * avgOut)})` } : null}
      tip={i => <>
        <TipTitulo>{miLong(P[i].i)}</TipTitulo>
        {ordem.map(k => <TipLinha key={k} cor={SCEN[k].color} rotulo={SCEN[k].name} valor={fmt(PS[k][i].pat)} />)}
        <TipSep />
        <TipLinha rotulo={`Conta (${SCEN[scen].name.toLowerCase()})`} valor={fmt(P[i].conta)} />
        <TipLinha rotulo="Investimentos" valor={fmt(P[i].invest)} />
      </>} />
  </section>;
}

export function Categorias({ d }: PropsSecao) {
  const itens = categorias(d.P12), total = itens.reduce((a, x) => a + x.value, 0);
  return <section className="card span-5">
    <h2>Gasto médio por categoria</h2>
    <p className="desc">Média mensal nos próximos 12 meses (anuais e únicos diluídos).</p>
    {itens.length ? <HBarChart items={itens} color="var(--s1)" total={total} /> : <div className="chart"><div className="empty">Sem despesas cadastradas.</div></div>}
  </section>;
}

export function Historico({ D, who }: PropsSecao) {
  const h = historico(D, who);
  if (!h.length) return null;
  return <section className="card span-7">
    <div className="card-head">
      <div><h2>Histórico real</h2><p className="desc">O que aconteceu de fato, pela aba Lançamentos.</p></div>
      <div className="legend"><span><i style={{ background: 'var(--s1)' }} />Receitas</span><span><i style={{ background: 'var(--s2)' }} />Despesas</span></div>
    </div>
    <BarChart labels={h.map(x => miLabel(x.i))} height={260}
      series={[{ name: 'Receitas', color: 'var(--s1)', values: h.map(x => x.rec) }, { name: 'Despesas', color: 'var(--s2)', values: h.map(x => x.desp) }]}
      tip={k => { const x = h[k], s = x.rec - x.desp;
        return <>
          <TipTitulo>{miLong(x.i)}{x.i === D.start ? ' (parcial)' : ''}</TipTitulo>
          <TipLinha cor="var(--s1)" rotulo="Receitas" valor={fmt(x.rec)} />
          <TipLinha cor="var(--s2)" rotulo="Despesas" valor={fmt(x.desp)} />
          <TipSep />
          <TipLinha rotulo="Resultado" valor={fmt(s)} classe={s < 0 ? 'delta-down' : 'delta-up'} />
        </>; }} />
  </section>;
}
