/** Lê as abas da planilha (já como objetos { cabeçalho: valor }) e monta os dados do motor.
 *  Cabeçalhos e chaves são comparados normalizados (sem acento, minúsculas): "Próxima" = "proxima". */
import { folhaOf, INSS_2026, IRRF_2026 } from '../calculos/folha';
import type { Cartao, Dados, Dono, FaixaInss, FaixaIrrf, Frequencia, Item, Lancamento, Linha, Parcela, Raw, TabelasFolha } from '../calculos/tipos';
import { mi, norm, parseDate, parseNum, pctVal } from '../calculos/util';

const rowsOf = (rows: unknown): Linha[] =>
  (Array.isArray(rows) ? rows : []).map(r => { const o: Linha = {}; for (const k in r as Linha) o[norm(k)] = (r as Linha)[k]; return o; });
function sheetRows(raw: Raw, name: string): Linha[] {
  const key = Object.keys(raw || {}).find(k => norm(k) === norm(name));
  return rowsOf(key ? raw[key] : []);
}
const pick = (r: Linha, ...ks: string[]): unknown => { for (const k of ks) if (r[k] !== undefined && r[k] !== '') return r[k]; return ''; };
const str = (v: unknown) => String(v ?? '');

const CASAL_WORDS = ['', 'casal', 'conjunto', 'conjuntas', 'conjuntos', 'conjunta', 'casa', 'nos'];

export function normalizeData(raw: Raw, hoje: Date = new Date()): Dados {
  const warnings: string[] = [];
  const start = mi(hoje);

  // ---- premissas (lidas primeiro: trazem os nomes do casal)
  const pr: Record<string, unknown> = {};
  sheetRows(raw, 'Premissas').forEach(r => { const k = norm(pick(r, 'chave')); if (k) pr[k] = pick(r, 'valor'); });
  const num = (k: string, d: number) => { const n = parseNum(pr[k]); return isNaN(n) ? d : n; };
  const pc = (k: string, d: number) => { const n = pctVal(pr[k]); return isNaN(n) ? d : n; };
  const prem = {
    saldoConta: num('saldoconta', 0),
    inflacao: pc('inflacao', 0.045),
    reajuste: pc('reajustesalarial', 0),
    mesReajuste: Math.round(num('mesreajuste', 0)),
    meses: Math.round(num('mesesprojecao', 24)),
    metaReserva: num('metareservameses', 6),
    otVar: pc('otimistavariaveis', -0.05), otInf: pc('otimistainflacao', -0.01),
    peVar: pc('pessimistavariaveis', 0.15), peInf: pc('pessimistainflacao', 0.02),
    divisao: norm(pr['divisaocasal'] || 'proporcional'),
    sabadoUtil: !norm(pr['sabadodiautil'] || 'sim').startsWith('n'),
    pct1: pc('percentualpessoa1', 0.5),
  };

  // ---- quem é quem: nomes da Premissas + sufixo das abas "Receitas X" / "Despesas X"
  const names = { p1: str(pr['pessoa1']).trim(), p2: str(pr['pessoa2']).trim(), casal: 'Casal' };
  type Aba = { key: string; kind: 'receitas' | 'despesas'; suffix: string; ns: string; own: Dono };
  const sheets: Aba[] = Object.keys(raw || {}).filter(k => !k.startsWith('_')).flatMap(k => {
    const m = norm(k).match(/^(receitas|despesas)(.*)$/);
    return m ? [{ key: k, kind: m[1] as Aba['kind'], suffix: k.replace(/^\s*(receitas|despesas)\s*[-–:]?\s*/i, '').trim(), ns: m[2], own: 'casal' as Dono }] : [];
  });
  // sufixos que não batem com os nomes da Premissas viram pessoa 1/2, na ordem das abas
  sheets.forEach(s => {
    if (CASAL_WORDS.includes(s.ns) || s.ns === norm(names.p1) || s.ns === norm(names.p2)) return;
    if (!names.p1) names.p1 = s.suffix; else if (!names.p2) names.p2 = s.suffix;
  });
  names.p1 = names.p1 || 'Pessoa 1'; names.p2 = names.p2 || 'Pessoa 2';
  const ownOf = (v: unknown): Dono => { const n = norm(v); return n === norm(names.p1) ? 'p1' : n === norm(names.p2) ? 'p2' : 'casal'; };
  sheets.forEach(s => {
    s.own = CASAL_WORDS.includes(s.ns) ? 'casal' : ownOf(s.suffix);
    if (!CASAL_WORDS.includes(s.ns) && s.own === 'casal') warnings.push(`A aba "${s.key}" não bate com os nomes da Premissas (${names.p1} / ${names.p2}); tratei como do casal.`);
  });

  // ---- cartões de crédito (aba Cartões) e a coluna "Cartão" das despesas/parcelas
  const cartoes: Cartao[] = sheetRows(raw, 'Cartões').map(r => ({
    nome: str(pick(r, 'cartao', 'nome')).trim(), own: ownOf(pick(r, 'dequem', 'titular')),
    fech: Math.round(parseNum(pick(r, 'fechamentodia', 'fechamento'))), venc: Math.round(parseNum(pick(r, 'vencimentodia', 'vencimento'))),
    limite: parseNum(pick(r, 'limite')),
  })).filter(c => c.nome);
  const cardOf = (v: unknown): string | null => {
    const s = str(v).trim(); if (!s) return null;
    const n = norm(s); if (['pix', 'debito', 'boleto', 'dinheiro', 'conta', 'avista'].includes(n)) return null;
    let c = cartoes.find(c => norm(c.nome) === n);
    if (!c) { c = { nome: s, own: 'casal', fech: NaN, venc: NaN, limite: NaN, implicito: true }; cartoes.push(c);
      warnings.push(`O cartão "${s}" é usado nas despesas mas não está na aba Cartões (sem vencimento e limite).`); }
    return c.nome;
  };
  const freqOf = (v: unknown): Frequencia => { const n = norm(v); return n.startsWith('anu') ? 'anual' : n.startsWith('uni') ? 'unica' : 'mensal'; };
  const flows = (kind: Aba['kind']): Item[] => sheets.filter(s => s.kind === kind).flatMap(s => rowsOf(raw[s.key]).flatMap((r, i) => {
    const isExp = kind === 'despesas';
    const o: Item = {
      desc: str(pick(r, 'descricao', 'item')).trim(),
      cat: str(pick(r, 'categoria') || 'Outros').trim() || 'Outros',
      valor: parseNum(pick(r, 'valor')),
      freq: freqOf(pick(r, 'frequencia')),
      ini: parseDate(pick(r, 'inicio')),
      fim: parseDate(pick(r, 'fim')),
      iniI: null, fimI: null,
      reaj: norm(pick(r, 'reajusta', 'reajuste', 'corrigeinflacao')).startsWith('s'),
      folha: !isExp && norm(pick(r, 'descontainss', 'descontairrf', 'clt')).startsWith('s'),
      pag: isExp ? null : str(pick(r, 'pagamentodia', 'diadopagamento', 'pagamento')).trim(),
      adPct: isExp ? 0 : (pctVal(pick(r, 'adiantamento', 'adiantamentopct')) || 0),
      adDia: isExp ? NaN : parseNum(pick(r, 'diadoadiantamento')),
      dia: isExp ? Math.round(parseNum(pick(r, 'diadopagamento', 'vencimentodia', 'vencimento'))) : NaN,
      tipo: isExp ? (norm(pick(r, 'tipo')).startsWith('v') ? 'variavel' : 'fixa') : null,
      own: s.own,
      cartao: cardOf(pick(r, 'cartao', 'pagamento', 'formadepagamento')),
    };
    if (isExp && s.own === 'casal') { const pg = ownOf(pick(r, 'pagopor', 'quempaga')); o.pago = pg === 'casal' ? 'conjunta' : pg; }
    if (!o.desc && isNaN(o.valor)) return [];
    if (isNaN(o.valor)) { warnings.push(`${s.key}, linha ${i + 2}: "${o.desc}" está sem valor.`); return []; }
    if (o.freq !== 'mensal' && !o.ini) { warnings.push(`${s.key}, linha ${i + 2}: "${o.desc}" é ${o.freq === 'anual' ? 'anual' : 'única'} mas não tem data de Início.`); return []; }
    o.iniI = o.ini ? mi(o.ini) : null; o.fimI = o.fim ? mi(o.fim) : null;
    return [o];
  }));

  const parcelas: Parcela[] = sheetRows(raw, 'Parcelas').flatMap((r, i) => {
    const o = {
      desc: str(pick(r, 'descricao')).trim(), cat: str(pick(r, 'categoria') || 'Parcelas'),
      valor: parseNum(pick(r, 'parcela', 'valordaparcela', 'valor')),
      rest: Math.round(parseNum(pick(r, 'restantes', 'parcelasrestantes'))),
      prox: parseDate(pick(r, 'proxima', 'proximaparcela')),
      own: ownOf(pick(r, 'dequem', 'titular')),
      cartao: cardOf(pick(r, 'cartao')),
      firstI: 0, lastI: 0,
    };
    if (!o.desc && isNaN(o.valor)) return [];
    if (isNaN(o.valor) || isNaN(o.rest)) { warnings.push(`Parcelas, linha ${i + 2}: "${o.desc}" precisa de Parcela e Restantes.`); return []; }
    let first = o.prox ? mi(o.prox) : start;
    if (first < start) { o.rest -= (start - first); first = start; }       // parcelas que já passaram
    o.firstI = first; o.lastI = first + o.rest - 1;
    return o.rest > 0 ? [o] : [];
  });

  const invest = sheetRows(raw, 'Investimentos').map(r => ({
    desc: str(pick(r, 'descricao')).trim(),
    saldo: parseNum(pick(r, 'saldoatual', 'saldo')) || 0,
    aporte: parseNum(pick(r, 'aportemensal', 'aporte')) || 0,
    taxa: pctVal(pick(r, 'rentabilidadeanual', 'rentabilidade')) || 0,
    own: ownOf(pick(r, 'dequem', 'titular')),
  })).filter(o => o.desc || o.saldo || o.aporte);

  const lanc = sheetRows(raw, 'Lançamentos').map(r => ({
    data: parseDate(pick(r, 'data')), cat: str(pick(r, 'categoria') || 'Outros'),
    tipo: (norm(pick(r, 'tipo')).startsWith('r') ? 'receita' : 'despesa') as Lancamento['tipo'],
    valor: Math.abs(parseNum(pick(r, 'valor'))),
    own: ownOf(pick(r, 'dequem', 'quem')),
  })).filter((o): o is Lancamento => !!o.data && !isNaN(o.valor) && o.valor > 0);

  const receitas = flows('receitas'), despesas = flows('despesas');
  const pagPadrao: Dados['pagPadrao'] = {};   // receita sem dia (13º, férias…) cai no dia do salário da mesma pessoa
  receitas.forEach(it => { if (it.pag && !pagPadrao[it.own]) pagPadrao[it.own] = it.pag; });

  // ---- IRRF (aba Tabela IRRF + chaves irrf_* da Premissas) e INSS (aba Tabela INSS); padrão = tabelas 2026
  let faixas: FaixaIrrf[] = sheetRows(raw, 'Tabela IRRF').map(r => ({
    de: parseNum(pick(r, 'debasedecalculo', 'de')), aliq: pctVal(pick(r, 'aliquota')), ded: parseNum(pick(r, 'parcelaadeduzir', 'deducao')) || 0,
  })).filter(f => !isNaN(f.de) && !isNaN(f.aliq)).sort((a, b) => a.de - b.de);
  if (!faixas.length) faixas = IRRF_2026;
  let inssF: FaixaInss[] = sheetRows(raw, 'Tabela INSS').map(r => ({ de: parseNum(pick(r, 'de')), ate: parseNum(pick(r, 'ate')), aliq: pctVal(pick(r, 'aliquota')) }))
    .filter(f => !isNaN(f.de) && !isNaN(f.ate) && !isNaN(f.aliq)).sort((a, b) => a.de - b.de);
  if (!inssF.length) inssF = INSS_2026;
  const irrf: TabelasFolha = { faixas, simplificado: num('irrfdescontosimplificado', 607.2), isento: num('irrfisencaoate', 5000),
    redAte: num('irrfreducaoate', 7350), redK: num('irrfreducaoconstante', 978.62), redF: num('irrfreducaofator', 0.133145), inss: inssF };
  const liq = (it: Item) => it.valor - (it.folha ? folhaOf(irrf, it.valor).total : 0);

  // ---- divisão das despesas do casal (parte da pessoa 1)
  const monthlyEq = (it: Item) => it.freq === 'mensal' ? ((it.iniI == null || it.iniI <= start) && (it.fimI == null || it.fimI >= start) ? liq(it) : 0)
    : it.freq === 'anual' ? liq(it) / 12 : 0;
  const inc = { p1: 0, p2: 0 };
  receitas.forEach(it => { if (it.own !== 'casal') inc[it.own] += monthlyEq(it); });
  let share1: number, shareLabel: string;
  if (prem.divisao.startsWith('igual') || prem.divisao.startsWith('5050')) { share1 = 0.5; shareLabel = 'por igual (50/50)'; }
  else if (prem.divisao.startsWith('percentual') || prem.divisao.startsWith('fixo')) { share1 = Math.min(1, Math.max(0, prem.pct1)); shareLabel = 'por percentual fixo'; }
  else { share1 = inc.p1 + inc.p2 > 0 ? inc.p1 / (inc.p1 + inc.p2) : 0.5; shareLabel = 'de forma proporcional à renda'; }

  return { receitas, despesas, parcelas, invest, prem, lanc, warnings, start, names, share1, shareLabel, inc, cartoes, irrf, pagPadrao };
}
