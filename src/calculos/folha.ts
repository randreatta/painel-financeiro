/** Descontos de folha (CLT): INSS progressivo + IRRF com a redução de 2026 (Lei 15.270/2025). */
import type { FaixaInss, FaixaIrrf, TabelasFolha } from './tipos';

/** Tabela progressiva mensal do IRRF 2026 (base de cálculo). */
export const IRRF_2026: FaixaIrrf[] = [{ de: 0, aliq: 0, ded: 0 }, { de: 2428.81, aliq: 0.075, ded: 182.16 },
  { de: 2826.66, aliq: 0.15, ded: 394.16 }, { de: 3751.06, aliq: 0.225, ded: 675.49 }, { de: 4664.69, aliq: 0.275, ded: 908.73 }];
/** INSS do empregado 2026 (Portaria Interministerial MPS/MF nº 13/2026). */
export const INSS_2026: FaixaInss[] = [{ de: 0, ate: 1621, aliq: 0.075 }, { de: 1621, ate: 2902.84, aliq: 0.09 },
  { de: 2902.84, ate: 4354.27, aliq: 0.12 }, { de: 4354.27, ate: 8475.55, aliq: 0.14 }];

const centavos = (v: number) => Math.round(v * 100) / 100;

/** INSS: cada alíquota só sobre a parte do salário dentro da faixa; teto = último "Até". */
export function inssOf(T: TabelasFolha, bruto: number): number {
  if (!(bruto > 0)) return 0;
  return centavos(T.inss.reduce((a, f) => a + (bruto > f.de ? (Math.min(bruto, f.ate) - f.de) * f.aliq : 0), 0));
}

/** IRRF mensal: tabela sobre (bruto − maior entre INSS e desconto simplificado), depois a redução de 2026. */
export function irrfOf(T: TabelasFolha, bruto: number, inss = 0): number {
  if (!(bruto > 0) || bruto <= T.isento) return 0;
  const base = Math.max(0, bruto - Math.max(inss, T.simplificado));
  let f = T.faixas[0]; for (const x of T.faixas) if (base >= x.de) f = x;
  const tabela = centavos(base * f.aliq - f.ded);
  const reducao = bruto <= T.redAte ? Math.max(0, T.redK - T.redF * bruto) : 0;
  return Math.max(0, centavos(tabela - reducao));
}

export function folhaOf(T: TabelasFolha, bruto: number): { inss: number; irrf: number; total: number } {
  const inss = inssOf(T, bruto), ir = irrfOf(T, bruto, inss);
  return { inss, irrf: ir, total: inss + ir };
}
