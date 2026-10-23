/** Tipos do domínio. "p1"/"p2" são as duas pessoas (nomes na aba Premissas); "casal" é o que é dos dois. */
export type Dono = 'p1' | 'p2' | 'casal';
export type Visao = Dono;
export type Cenario = 'base' | 'otimista' | 'pessimista';
export type Frequencia = 'mensal' | 'anual' | 'unica';

/** Uma planilha lida: nome da aba → linhas com { cabeçalho: valor }. Chaves começando com "_" são metadados. */
export type Raw = Record<string, unknown>;
export type Linha = Record<string, unknown>;

export interface Item {
  desc: string; cat: string; valor: number; freq: Frequencia;
  ini: Date | null; fim: Date | null; iniI: number | null; fimI: number | null;
  reaj: boolean;
  /** Receita bruta CLT: desconta INSS e verifica IRRF. */
  folha: boolean;
  /** Receita: quando cai ("5º dia útil", "10"…). */
  pag: string | null;
  adPct: number; adDia: number;
  /** Despesa: dia do pagamento. */
  dia: number;
  tipo: 'fixa' | 'variavel' | null;
  own: Dono;
  cartao: string | null;
  /** Despesa do casal: quem paga de fato. */
  pago?: 'p1' | 'p2' | 'conjunta';
}

export interface Parcela {
  desc: string; cat: string; valor: number; rest: number; prox: Date | null; own: Dono; cartao: string | null;
  firstI: number; lastI: number;
}
export interface Investimento { desc: string; saldo: number; aporte: number; taxa: number; own: Dono }
export interface Lancamento { data: Date; cat: string; tipo: 'receita' | 'despesa'; valor: number; own: Dono }
export interface Cartao { nome: string; own: Dono; fech: number; venc: number; limite: number; implicito?: boolean }

export interface FaixaIrrf { de: number; aliq: number; ded: number }
export interface FaixaInss { de: number; ate: number; aliq: number }
export interface TabelasFolha {
  faixas: FaixaIrrf[]; simplificado: number; isento: number; redAte: number; redK: number; redF: number; inss: FaixaInss[];
}

export interface Premissas {
  saldoConta: number; inflacao: number; reajuste: number; mesReajuste: number; meses: number; metaReserva: number;
  otVar: number; otInf: number; peVar: number; peInf: number; divisao: string; sabadoUtil: boolean; pct1: number;
}

export interface Dados {
  receitas: Item[]; despesas: Item[]; parcelas: Parcela[]; invest: Investimento[]; prem: Premissas; lanc: Lancamento[];
  warnings: string[]; start: number; names: { p1: string; p2: string; casal: string };
  share1: number; shareLabel: string; inc: { p1: number; p2: number }; cartoes: Cartao[]; irrf: TabelasFolha;
  pagPadrao: Partial<Record<Dono, string>>;
}
