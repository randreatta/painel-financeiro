/** Próximos eventos: o que foge do mês comum nos próximos 12 meses. */
import { historico, proximosEventos } from '../../calculos/painel';
import { fmt, miLabel } from '../../calculos/util';
import type { PropsSecao } from '../comum';

export function Eventos({ D, who, d }: PropsSecao) {
  const ev = proximosEventos(D, who, d.P12), largo = historico(D, who).length === 0;
  return <section className={'card ' + (largo ? 'span-12' : 'span-5')}>
    <h2>Próximos eventos</h2>
    <p className="desc">Gastos e receitas fora do comum e parcelas que terminam, nos próximos 12 meses.</p>
    <ul className="events">{ev.length ? ev.map((e, k) => <li key={k}>
      <span className="when">{miLabel(e.i)}</span>
      <span className="what">{e.t}<small>{e.s}</small></span>
      <span className={'amt ' + (e.sign > 0 ? 'delta-up' : '')}>{e.sign > 0 ? '+' : e.sign < 0 ? '−' : ''}{fmt(e.v)}</span>
    </li>) : <li className="empty" style={{ display: 'block' }}>Nada fora do comum nos próximos 12 meses.</li>}</ul>
  </section>;
}
