import type { Cenario, Dados, Visao } from '../calculos/tipos';
import type { Derivados } from '../calculos/painel';

export const SCEN: Record<Cenario, { name: string; color: string }> = {
  base: { name: 'Base', color: 'var(--s1)' }, otimista: { name: 'Otimista', color: 'var(--s3)' }, pessimista: { name: 'Pessimista', color: 'var(--s2)' },
};
export const CORES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
/** O que toda seção recebe: dados lidos, escolhas do topo e números derivados. */
export interface PropsSecao { D: Dados; scen: Cenario; who: Visao; N: number; d: Derivados }
/** Classe de valor negativo. */
export const neg = (v: number) => v < 0 ? 'delta-down' : '';
