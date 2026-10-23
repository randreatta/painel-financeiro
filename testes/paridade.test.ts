/** Paridade com o painel antigo (index.html): as saídas do motor novo devem bater com o gabarito,
 *  gerado rodando o código antigo sobre as mesmas fixtures fictícias, com "hoje" = 23/10/2026 15:00. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calendarMonths } from '../src/calculos/calendario';
import { settlement } from '../src/calculos/casal';
import { feriados, payDay } from '../src/calculos/datas';
import { folhaOf, irrfOf } from '../src/calculos/folha';
import { project } from '../src/calculos/projecao';
import type { Cenario, Visao } from '../src/calculos/tipos';
import { normalizeData } from '../src/planilha/normalizar';

const HOJE = new Date(2026, 9, 23, 15, 0);
const ler = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const r2 = (x: unknown) => typeof x === 'number' ? Math.round(x * 100) / 100 : x;
const clean = (o: unknown) => JSON.parse(JSON.stringify(o, (_k, v) => typeof v === 'number' ? r2(v) : v));

/** Mesma extração do gerador do gabarito (scratchpad/gabarito.py → EXTRACT). */
function extrair(raw: Record<string, unknown>) {
  const D = normalizeData(raw, HOJE);
  const out: Record<string, unknown> = { normalizado: { names: D.names, share1: D.share1, shareLabel: D.shareLabel, inc: D.inc, warnings: D.warnings, start: D.start,
    pagPadrao: D.pagPadrao, cartoes: D.cartoes, receitas: D.receitas.length, despesas: D.despesas.length, parcelas: D.parcelas, invest: D.invest } };
  const projecao: Record<string, unknown> = {};
  for (const scen of ['base', 'otimista', 'pessimista'] as Cenario[]) for (const who of ['casal', 'p1', 'p2'] as Visao[])
    projecao[scen + '/' + who] = project(D, scen, 24, who).map(r => ({ i: r.i, rec: r.rec, recBruta: r.recBruta, inss: r.inss, irrf: r.irrf, desp: r.desp,
      fixas: r.fixas, variaveis: r.variaveis, despProprias: r.despProprias, despCasal: r.despCasal, parc: r.parc, cartao: r.cartao, aportes: r.aportes,
      saidas: r.saidas, sobra: r.sobra, conta: r.conta, invest: r.invest, pat: r.pat, cats: r.cats,
      faturas: Object.fromEntries(Object.entries(r.faturas).map(([k, f]) => [k, { total: f.total, items: f.items.map(x => [x.desc, x.v, x.tipo, x.n || 0]) }])),
      ev: r.ev.map(e => [e.dia, e.desc, e.own, e.v]), recItems: r.recItems.map(x => [x.desc, x.v]), expItems: r.expItems.map(x => [x.desc, x.v]) }));
  out.projecao = projecao;
  out.acerto = project(D, 'base', 12, 'casal').map(r => settlement(D, r));
  const cal: Record<string, unknown> = {};
  for (const who of ['casal', 'p1', 'p2'] as Visao[]) cal[who] = calendarMonths(D, 'base', who, 11, HOJE).map(c => ({ i: c.i, first: c.first, n: c.n, start: c.start, end: c.end,
    min: c.min, entradas: c.entradas, saidas: c.saidas, passados: c.passados, ev: c.ev.map(e => [e.dia, e.desc, e.v, e.semDia]), days: c.days.map(x => x.v) }));
  out.calendario = cal;
  return clean(out);
}

/** Igualdade profunda com tolerância de 1 centavo nos números; aponta o primeiro caminho diferente. */
function diff(a: unknown, b: unknown, path = ''): string | null {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 0.011 ? null : `${path}: ${a} ≠ ${b}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: tamanho ${a.length} ≠ ${b.length}`;
    for (let k = 0; k < a.length; k++) { const d = diff(a[k], b[k], `${path}[${k}]`); if (d) return d; }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) return `${path}: chaves ${ka.join()} ≠ ${kb.join()}`;
    for (const k of ka) { const d = diff((a as any)[k], (b as any)[k], `${path}.${k}`); if (d) return d; }
    return null;
  }
  return a === b ? null : `${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
}

describe('paridade com o painel antigo', () => {
  for (const nome of ['modelo', 'ficticia', 'ficticia_5050', 'ficticia_fixo']) {
    it(`fixture ${nome}`, () => {
      const novo = extrair(ler(`./fixtures/${nome}.json`));
      const velho = ler(`./gabarito/${nome}.json`);
      expect(diff(novo, velho)).toBeNull();
    });
  }

  it('folha, dias úteis e feriados', () => {
    const g = ler('./gabarito/funcoes.json');
    const D = normalizeData(ler('./fixtures/ficticia.json'), HOJE);
    const meses = Array.from({ length: 30 }, (_, k) => 2026 * 12 + k);
    const novo = {
      folha: g.folha.map(([s]: [number]) => { const f = folhaOf(D.irrf, s); return [s, r2(f.inss), r2(f.irrf)]; }),
      irrfSemInss: g.irrfSemInss.map(([s]: [number]) => [s, irrfOf(D.irrf, s)]),
      payDaySabadoSim: g.payDaySabadoSim.map(([sp]: [string]) => [sp, meses.map(i => payDay(true, sp, i))]),
      payDaySabadoNao: g.payDaySabadoNao.map(([sp]: [string]) => [sp, meses.map(i => payDay(false, sp, i))]),
      feriados: [2026, 2027, 2028, 2030].map(y => [y, [...feriados(y)]]),
    };
    expect(diff(novo, g)).toBeNull();
  });
});

describe('valores conferidos com o Rodrigo', () => {
  const T = normalizeData({}, HOJE).irrf;
  it('INSS de R$ 4.338 = R$ 409,16 e sem IRRF', () => { expect(folhaOf(T, 4338)).toEqual({ inss: 409.16, irrf: 0, total: 409.16 }); });
  it('IRRF de R$ 6.000 sem INSS = R$ 394,54 (exemplo oficial da Receita)', () => { expect(irrfOf(T, 6000)).toBe(394.54); });
  it('teto do INSS = R$ 988,09', () => { expect(folhaOf(T, 20000).inss).toBe(988.09); });
  it('5º dia útil de nov/2026 cai na sexta, dia 6', () => { expect(payDay(true, '5º dia útil', 2026 * 12 + 10)).toBe(6); });
});
