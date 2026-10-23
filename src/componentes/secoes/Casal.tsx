/** Divisão do casal: quanto cada um ganha, gasta e sobra, e o acerto do mês (quem transfere quanto). */
import { useState } from 'react';
import { settlement } from '../../calculos/casal';
import { project } from '../../calculos/projecao';
import type { Dono } from '../../calculos/tipos';
import { fmt, miLong, pctF } from '../../calculos/util';
import { neg, type PropsSecao } from '../comum';

export function Casal({ D, scen }: PropsSecao) {
  const [m, setM] = useState(0);
  const { names, share1: s1 } = D;
  const linha = (who: Dono) => project(D, scen, m + 1, who)[m];
  const st = settlement(D, linha('casal'));
  const pessoa = (k: 'p1' | 'p2') => { const r = linha(k);
    return <div className="person">
      <h3>{names[k]}<small>{pctF.format(k === 'p1' ? s1 : 1 - s1)} do casal</small></h3>
      <div className="kv"><span>Renda</span><span>{fmt(r.rec)}</span></div>
      <div className="kv"><span>Gastos pessoais</span><span>{fmt(r.despProprias)}</span></div>
      <div className="kv"><span>Parte nas despesas do casal</span><span>{fmt(r.despCasal)}</span></div>
      <div className="kv"><span>Parcelas</span><span>{fmt(r.parc)}</span></div>
      <div className="kv"><span>Aportes</span><span>{fmt(r.aportes)}</span></div>
      <div className="kv total"><span>Sobra</span><span className={neg(r.sobra)}>{fmt(r.sobra)}</span></div>
    </div>; };
  return <section className="card span-12">
    <h2>Divisão do casal</h2>
    <p className="desc">Despesas do casal divididas {D.shareLabel}: <b>{names.p1} {pctF.format(s1)}</b> · <b>{names.p2} {pctF.format(1 - s1)}</b>
      {D.shareLabel.includes('proporcional') ? ` (renda mensal ${fmt(D.inc.p1)} x ${fmt(D.inc.p2)})` : ''}. Mude a regra na aba Premissas.</p>
    <div className="couple">
      {pessoa('p1')}{pessoa('p2')}
      <div className="settle">
        <h3>Acerto do mês <select aria-label="Mês do acerto" value={m} onChange={e => setM(+e.target.value)}>
          {Array.from({ length: 12 }, (_, k) => <option key={k} value={k}>{miLong(D.start + k)}</option>)}
        </select></h3>
        <div className="big">{st.amount < 1 ? 'Ninguém precisa transferir nada' : `${names[st.from]} transfere ${fmt(st.amount)} para ${names[st.to]}`}</div>
        <div className="kv"><span>Despesas do casal no mês</span><span>{fmt(st.total)}</span></div>
        <div className="kv"><span>Pagas por {names.p1}</span><span>{fmt(st.by.p1)}</span></div>
        <div className="kv"><span>Pagas por {names.p2}</span><span>{fmt(st.by.p2)}</span></div>
        <div className="kv"><span>Pagas pela conta conjunta</span><span>{fmt(st.by.conjunta)}</span></div>
        {st.by.conjunta > 0 && <div className="kv total"><span>Depósito na conta conjunta</span><span>{names.p1} {fmt(st.dep1)} · {names.p2} {fmt(st.dep2)}</span></div>}
        <div className="hint">O acerto compara o que cada um pagou direto (coluna “Pago por”) com a parte justa de cada um. Parcelas e aportes do casal não entram aqui.</div>
      </div>
    </div>
  </section>;
}
