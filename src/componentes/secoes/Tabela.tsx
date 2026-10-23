/** Tabela da projeção e as premissas em uso. */
import { MESES, fmt, miLabel, pctF } from '../../calculos/util';
import type { PropsSecao } from '../comum';

export function Tabela({ d }: PropsSecao) {
  const cel = (v: number) => <td className={v < 0 ? 'neg' : ''}>{fmt(v)}</td>;
  return <section className="card span-12"><details>
    <summary>Tabela da projeção</summary>
    <div className="table-wrap" style={{ marginTop: 12 }}><table>
      <thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Parcelas</th><th>Cartões</th><th>Aportes</th><th>Sobra</th><th>Conta</th><th>Investimentos</th><th>Patrimônio</th></tr></thead>
      <tbody>{d.P.map(r => <tr key={r.i}><td>{miLabel(r.i)}</td>{cel(r.rec)}{cel(r.desp)}{cel(r.parc)}{cel(r.cartao)}{cel(r.aportes)}{cel(r.sobra)}{cel(r.conta)}{cel(r.invest)}{cel(r.pat)}</tr>)}</tbody>
    </table></div>
  </details></section>;
}

export function Notas({ D }: { D: PropsSecao['D'] }) {
  const p = D.prem;
  return <div className="notes"><strong>Premissas em uso</strong><ul>
    <li>Inflação {pctF.format(p.inflacao)} a.a. (otimista {pctF.format(p.inflacao + p.otInf)}, pessimista {pctF.format(p.inflacao + p.peInf)}), aplicada às despesas com “Reajusta? = Sim”.</li>
    <li>Reajuste salarial de {pctF.format(p.reajuste)} {p.mesReajuste ? 'todo mês de ' + MESES[p.mesReajuste - 1] : '(sem mês definido)'}; despesas variáveis {pctF.format(p.otVar)} no otimista e +{pctF.format(p.peVar)} no pessimista.</li>
    <li>Os aportes saem da conta todo mês; a sobra que restar fica na conta, sem rendimento.</li>
    <li>Despesas, parcelas, investimentos e saldo do casal são divididos {D.shareLabel}: {D.names.p1} {pctF.format(D.share1)} · {D.names.p2} {pctF.format(1 - D.share1)}.</li>
  </ul></div>;
}
