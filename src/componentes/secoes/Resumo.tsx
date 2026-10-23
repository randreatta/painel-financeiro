/** Alertas (conta negativa, linhas ignoradas) e os cinco indicadores do topo. */
import { miLong, fmt, pctF } from '../../calculos/util';
import { SCEN, neg, type PropsSecao } from '../comum';

export function Alertas({ D, scen, who, d }: PropsSecao) {
  const negativo = d.P.find(r => r.conta < 0), nome = D.names[who];
  return <>
    {negativo && <div className="alert critical"><span className="ico" aria-hidden="true">!</span><div>
      <strong>No cenário {SCEN[scen].name.toLowerCase()}, a conta{who === 'casal' ? ' corrente' : ' de ' + nome} fica negativa em {miLong(negativo.i).toLowerCase()}</strong>
      <span>Saldo projetado de {fmt(negativo.conta)}. Os aportes continuam saindo da conta; reveja gastos ou aportes nesse período.</span>
    </div></div>}
    {D.warnings.length > 0 && <div className="alert warn"><span className="ico" aria-hidden="true">?</span><div>
      <strong>{D.warnings.length} linha(s) da planilha foram ignoradas</strong>
      <span>{D.warnings.slice(0, 4).map((w, k) => <span key={k}>{k > 0 && <br />}{w}</span>)}{D.warnings.length > 4 ? <><br />…</> : ''}</span>
    </div></div>}
  </>;
}

export function Kpis({ D, who, N, d }: PropsSecao) {
  const { cur, last, patHoje, meta, reservaHoje, atingeMeta } = d;
  const deDe = who === 'casal' ? '' : ` (${D.names[who]})`, delta = last.pat - patHoje;
  const kp: [string, React.ReactNode, React.ReactNode][] = [
    ['Receita líquida deste mês' + deDe, fmt(cur.rec), D.receitas.some(it => it.folha)
      ? `${fmt(cur.recBruta)} bruto − ${fmt(cur.inss)} de INSS` + (cur.irrf > 0 ? ` − ${fmt(cur.irrf)} de IRRF` : '') : miLong(cur.i)],
    ['Saídas deste mês' + deDe, fmt(cur.saidas), (cur.cartao > 0 ? `${fmt(cur.cartao)} em faturas de cartão · ` : '') + (who === 'casal'
      ? `${fmt(cur.desp)} despesas + ${fmt(cur.parc)} parcelas` : `${fmt(cur.despProprias)} pessoais + ${fmt(cur.despCasal)} da parte no casal + ${fmt(cur.parc)} parcelas`)],
    ['Sobra após aportes', <span className={neg(cur.sobra)}>{fmt(cur.sobra)}</span>, `Taxa de poupança ${pctF.format(d.taxaPoupanca)} (com aportes)`],
    [`Patrimônio em ${N} meses`, fmt(last.pat), <><span className={delta >= 0 ? 'delta-up' : 'delta-down'}>{delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta))}</span> desde hoje ({fmt(patHoje)})</>],
    ['Reserva de emergência', reservaHoje.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' meses',
      reservaHoje >= meta ? `Meta de ${meta} meses já atingida` : atingeMeta ? `Meta de ${meta} meses em ${miLong(atingeMeta.i).toLowerCase()}` : `Meta de ${meta} meses não atingida no horizonte`],
  ];
  return <section className="kpis">{kp.map(([l, v, s]) =>
    <div key={l} className="card kpi"><div className="label">{l}</div><div className="value">{v}</div><div className="sub">{s}</div></div>)}</section>;
}
