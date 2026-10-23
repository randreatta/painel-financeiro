/** Calendário do mês: saldo em conta dia a dia, entradas e saídas em ordem de data e o menor saldo. */
import { Fragment, useState } from 'react';
import { calendarMonths } from '../../calculos/calendario';
import type { Dono } from '../../calculos/tipos';
import { MESES, fmt, miLong } from '../../calculos/util';
import { LineChart, TipLinha, TipSep, TipTitulo } from '../graficos';
import type { PropsSecao } from '../comum';

export function Calendario({ D, scen, who, hoje }: PropsSecao & { hoje: Date }) {
  // mês atual sem nada pela frente → abre no próximo
  const [m, setM] = useState(() => calendarMonths(D, scen, who, 0, hoje)[0].ev.length ? 0 : 1);
  const C = calendarMonths(D, scen, who, m, hoje)[m], i = C.i;
  const dd = (d: number) => `${String(d).padStart(2, '0')}/${String(i % 12 + 1).padStart(2, '0')}`;
  const wd = (d: number) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(Math.floor(i / 12), i % 12, d).getDay()];
  const negativo = C.min.v < 0;
  const quem = (own: Dono) => who === 'casal' && D.names[own] ? <small> · {D.names[own]}</small> : null;
  const valor = (v: number) => (v > 0 ? '+' : '−') + fmt(Math.abs(v));
  const comDia = C.ev.filter(e => !e.semDia), semDia = C.ev.filter(e => e.semDia);
  const dias = [...new Set(comDia.map(e => e.dia))];
  return <section className="card span-12">
    <div className="card-head">
      <div><h2>Calendário do mês</h2><p className="desc">{m === 0
        ? `De amanhã até o fim de ${MESES[i % 12]}, partindo do saldo em conta de hoje (aba Premissas)${who === 'casal' ? '' : ', na parte de ' + D.names[who]}.`
        : `Saldo em conta dia a dia em ${miLong(i).toLowerCase()}, continuando a projeção dos meses anteriores.`}</p></div>
      <select aria-label="Mês do calendário" value={m} onChange={e => setM(+e.target.value)}>
        {Array.from({ length: 12 }, (_, k) => <option key={k} value={k}>{miLong(D.start + k)}</option>)}
      </select>
    </div>
    <div className="cal-sum">
      <div><span>Saldo no início</span><b>{fmt(C.start)}</b></div>
      <div><span>Entradas</span><b>{fmt(C.entradas)}</b></div>
      <div><span>Saídas</span><b>{fmt(C.saidas)}</b></div>
      <div><span>Menor saldo ({dd(C.min.dia)})</span><b><span className={negativo ? 'delta-down' : ''}>{negativo ? '⚠ ' : ''}{fmt(C.min.v)}</span></b></div>
      <div><span>Saldo no fim do mês</span><b>{fmt(C.end)}</b></div>
    </div>
    <div className="cal-grid">
      <LineChart labels={C.days.map(x => String(x.d).padStart(2, '0'))} height={260}
        series={[{ name: 'Saldo', color: 'var(--s1)', values: C.days.map(x => x.v), emph: true }]}
        refLine={negativo ? { value: 0, label: 'R$ 0' } : null}
        tip={k => { const dia = C.days[k].d;
          return <>
            <TipTitulo>{dd(dia)} · {wd(dia)}</TipTitulo>
            {C.ev.filter(e => e.dia === dia).map((e, j) => <TipLinha key={j} rotulo={e.desc} valor={valor(e.v)} classe={e.v > 0 ? 'delta-up' : ''} />)}
            <TipSep />
            <TipLinha rotulo="Saldo no fim do dia" valor={fmt(C.days[k].v)} classe={C.days[k].v < 0 ? 'delta-down' : ''} />
          </>; }} />
      <ul className="cal-list">
        {dias.map(dia => { const depois = C.days.find(x => x.d === dia);
          return <Fragment key={dia}>
            <li className="day">{dd(dia)} · {wd(dia)} <small style={{ fontWeight: 400, color: 'var(--muted)' }}>→ saldo {fmt(depois ? depois.v : 0)}</small></li>
            {comDia.filter(e => e.dia === dia).map((e, j) =>
              <li key={j} className="it"><span>{e.desc}{quem(e.own)}</span><span className={e.v > 0 ? 'delta-up' : ''}>{valor(e.v)}</span></li>)}
          </Fragment>; })}
        {semDia.length > 0 && <>
          <li className="day">Sem dia definido <small style={{ fontWeight: 400, color: 'var(--muted)' }}>(contado no dia {C.first}; preencha "Dia do pagamento" nas Despesas)</small></li>
          {semDia.map((e, j) => <li key={'s' + j} className="it"><span>{e.desc}{quem(e.own)}</span><span>{valor(e.v)}</span></li>)}
        </>}
        {m === 0 && C.passados > 0 && <li className="day" style={{ fontWeight: 400, color: 'var(--muted)' }}>{C.passados} lançamento(s) deste mês já passaram (ou não têm dia) e não entram aqui.</li>}
        {C.ev.length === 0 && <li className="it"><span>Nada previsto para o resto do mês.</span></li>}
      </ul>
    </div>
  </section>;
}
