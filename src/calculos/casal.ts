/** Acerto do mês: o que cada um pagou direto nas despesas do casal x a parte justa de cada um. */
import type { Mes } from './projecao';
import type { Dados } from './tipos';

export interface Acerto {
  by: { p1: number; p2: number; conjunta: number }; total: number; direct: number; fair1: number; fair2: number;
  dep1: number; dep2: number; from: 'p1' | 'p2'; to: 'p1' | 'p2'; amount: number;
}

export function settlement(D: Dados, row: Mes): Acerto {
  const s1 = D.share1, by = { p1: 0, p2: 0, conjunta: 0 };
  row.casalItems.forEach(it => { by[it.pago || 'conjunta'] += it.v; });
  const total = by.p1 + by.p2 + by.conjunta, direct = by.p1 + by.p2;
  const diff = by.p1 - s1 * direct;               // >0: pessoa 1 pagou mais do que a parte dela
  return { by, total, direct, fair1: s1 * total, fair2: (1 - s1) * total, dep1: s1 * by.conjunta, dep2: (1 - s1) * by.conjunta,
    from: diff > 0 ? 'p2' : 'p1', to: diff > 0 ? 'p1' : 'p2', amount: Math.abs(diff) };
}
