/** Mini biblioteca de gráficos em SVG (sem dependências): barras agrupadas, linhas e barras horizontais.
 *  Mesma geometria do painel v1. Cores sempre por variável CSS (--s1…), para o tema escuro funcionar. */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { fmt, fmtShort, pctF } from '../calculos/util';

/* ---------- utilidades ---------- */
export function niceTicks(min: number, max: number, n = 5): number[] {
  if (min === max) max = min + 1;
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => span / s <= n) || 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, t: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) t.push(Math.round(v * 1e6) / 1e6);
  return t;
}
/** Barra com cantos arredondados só na ponta e base reta. */
function roundedBar(x: number, y0: number, w: number, y1: number, r = 4): string {
  const up = y1 < y0, h = Math.abs(y1 - y0); r = Math.min(r, w / 2, h);
  if (up) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

/* ---------- tooltip ---------- */
export const Sw = ({ cor }: { cor: string }) =>
  <i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', background: cor }} />;
export const TipTitulo = ({ children }: { children: ReactNode }) => <b>{children}</b>;
export const TipSep = () => <div className="sep" />;
export function TipLinha({ rotulo, valor, cor, recuo, classe }: { rotulo: ReactNode; valor: ReactNode; cor?: string; recuo?: boolean; classe?: string }) {
  return <div className="row"><span>{cor && <Sw cor={cor} />}{recuo ? '  ' : ''}{rotulo}</span><span className={classe}>{valor}</span></div>;
}

interface Tip { conteudo: ReactNode; x: number; y: number }
function Tooltip({ tip, largura }: { tip: Tip | null; largura: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const tw = ref.current.offsetWidth, th = ref.current.offsetHeight;
    let left = tip.x + 14; if (left + tw > largura) left = tip.x - tw - 14; if (left < 0) left = 0;
    setPos({ left, top: Math.max(0, tip.y - th / 2) });
  }, [tip, largura]);
  return <div ref={ref} className="tip" style={{ opacity: tip ? 1 : 0, left: pos.left, top: pos.top }}>{tip?.conteudo}</div>;
}

/** Caixa que mede a própria largura (o SVG é desenhado em pixels reais, como no v1). */
function useLargura() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const medir = () => setW(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
const posRel = (el: HTMLElement | null, e: React.MouseEvent) => {
  const b = el!.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top, b };
};

function EixoY({ ticks, y, L, R, W }: { ticks: number[]; y: (v: number) => number; L: number; R: number; W: number }) {
  return <>{ticks.map(t => <g key={t}>
    <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth={1} />
    <text x={L - 8} y={y(t) + 4} textAnchor="end">{fmtShort(t)}</text>
  </g>)}</>;
}
function RotulosX({ labels, xc, bottom, minGap = 46 }: { labels: string[]; xc: (i: number) => number; bottom: number; minGap?: number }) {
  const every = Math.max(1, Math.ceil(minGap / Math.max(1, xc(1) - xc(0))));
  return <>{labels.map((l, i) => i % every === 0 && <text key={i} x={xc(i)} y={bottom + 16} textAnchor="middle">{l}</text>)}</>;
}

/* ---------- barras agrupadas ---------- */
export interface Serie { name: string; color: string; values: number[]; emph?: boolean }
export function BarChart({ labels, series, tip, height = 300 }: { labels: string[]; series: Serie[]; tip: (i: number) => ReactNode; height?: number }) {
  const [ref, largura] = useLargura();
  const [hover, setHover] = useState<{ i: number; t: Tip } | null>(null);
  const W = Math.max(280, largura), H = height, L = 64, R = 8, T = 10, B = 26;
  const all = series.flatMap(s => s.values), max = Math.max(0, ...all), min = Math.min(0, ...all);
  const ticks = niceTicks(min, max), lo = ticks[0], hi = ticks[ticks.length - 1];
  const y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - B);
  const n = labels.length, band = (W - L - R) / n, xc = (i: number) => L + band * i + band / 2;
  const gap = 2, inner = Math.min(band * 0.78, 44), bw = Math.max(2, (inner - gap * (series.length - 1)) / series.length);
  return <div className="chart" ref={ref}>
    {largura > 0 && <svg viewBox={`0 0 ${W} ${H}`} height={H}>
      <EixoY ticks={ticks} y={y} L={L} R={R} W={W} />
      <rect x={hover ? L + band * hover.i : 0} y={T} width={band} height={H - T - B} fill="var(--accent-wash)" opacity={hover ? 1 : 0} rx={6} />
      {series.map((s, si) => s.values.map((v, i) =>
        <path key={si + '-' + i} d={roundedBar(xc(i) - inner / 2 + si * (bw + gap), y(0), bw, y(v), Math.min(4, bw / 2))} fill={s.color} />))}
      <RotulosX labels={labels} xc={xc} bottom={H - B} />
      {labels.map((_, i) => <rect key={i} x={L + band * i} y={T} width={band} height={H - T - B} fill="transparent"
        onMouseMove={e => { const p = posRel(ref.current, e); setHover({ i, t: { conteudo: tip(i), x: p.x, y: p.y } }); }}
        onMouseLeave={() => setHover(null)} />)}
    </svg>}
    <Tooltip tip={hover?.t ?? null} largura={ref.current?.clientWidth ?? W} />
  </div>;
}

/* ---------- linhas ---------- */
export function LineChart({ labels, series, refLine, tip, height = 300 }:
  { labels: string[]; series: Serie[]; refLine?: { value: number; label: string } | null; tip: (i: number) => ReactNode; height?: number }) {
  const [ref, largura] = useLargura();
  const [hover, setHover] = useState<{ i: number; t: Tip } | null>(null);
  const W = Math.max(280, largura), H = height, L = 64, R = 96, T = 12, B = 26;
  const all = series.flatMap(s => s.values).concat(refLine ? [refLine.value] : []);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(...all)), lo = ticks[0], hi = ticks[ticks.length - 1];
  const y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - B);
  const n = labels.length, xc = (i: number) => L + (n === 1 ? 0 : i * (W - L - R) / (n - 1));
  // rótulos diretos no fim das linhas, sem sobreposição
  const ends = series.map(s => ({ s, y: y(s.values[n - 1]) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;
  const onMove = (e: React.MouseEvent) => {
    const p = posRel(ref.current, e), px = p.x * (W / p.b.width);
    const i = Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, n - 1)))));
    setHover({ i, t: { conteudo: tip(i), x: xc(i) * (p.b.width / W), y: p.y } });
  };
  return <div className="chart" ref={ref}>
    {largura > 0 && <svg viewBox={`0 0 ${W} ${H}`} height={H}>
      <EixoY ticks={ticks} y={y} L={L} R={R} W={W} />
      {refLine && <>
        <line x1={L} x2={W - R} y1={y(refLine.value)} y2={y(refLine.value)} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={W - R - 4} y={y(refLine.value) + 15} textAnchor="end">{refLine.label}</text>
      </>}
      {series.map(s => <path key={s.name} d={s.values.map((v, i) => (i ? 'L' : 'M') + xc(i).toFixed(1) + ',' + y(v).toFixed(1)).join('')}
        fill="none" stroke={s.color} strokeWidth={s.emph ? 2.5 : 2} strokeLinejoin="round" strokeLinecap="round" opacity={s.emph === false ? 0.55 : 1} />)}
      {ends.map(e => <g key={e.s.name}>
        <circle cx={xc(n - 1)} cy={y(e.s.values[n - 1])} r={4} fill={e.s.color} stroke="var(--surface)" strokeWidth={2} />
        <text x={xc(n - 1) + 10} y={e.y + 4} style={{ fill: 'var(--ink-2)' }}>{e.s.name}</text>
      </g>)}
      <RotulosX labels={labels} xc={xc} bottom={H - B} />
      {hover && <>
        <line x1={xc(hover.i)} x2={xc(hover.i)} y1={T} y2={H - B} stroke="var(--axis)" strokeWidth={1} />
        {series.map(s => <circle key={s.name} cx={xc(hover.i)} cy={y(s.values[hover.i])} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
      </>}
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
    </svg>}
    <Tooltip tip={hover?.t ?? null} largura={ref.current?.clientWidth ?? W} />
  </div>;
}

/* ---------- barras horizontais (uma série, magnitude) ---------- */
export function HBarChart({ items, color, total }: { items: { label: string; value: number }[]; color: string; total: number }) {
  const [ref, largura] = useLargura();
  const [tip, setTip] = useState<Tip | null>(null);
  const rowH = 30, W = Math.max(280, largura), H = Math.max(60, items.length * rowH + 8);
  const labW = Math.min(150, W * 0.34), valW = 92, max = Math.max(1, ...items.map(d => d.value));
  const x = (v: number) => labW + v / max * (W - labW - valW);
  return <div className="chart" ref={ref}>
    {largura > 0 && <svg viewBox={`0 0 ${W} ${H}`} height={H}>
      <line x1={labW} x2={labW} y1={0} y2={items.length * rowH} stroke="var(--axis)" />
      {items.map((d, k) => {
        const yy = k * rowH + 6, h = rowH - 12, w = Math.max(2, x(d.value) - labW), r = Math.min(4, h / 2, w);
        return <g key={d.label}>
          <text x={labW - 10} y={yy + h / 2 + 4} textAnchor="end" style={{ fill: 'var(--ink-2)', fontSize: 12 }}>{d.label}</text>
          <path d={`M${labW},${yy}H${labW + w - r}Q${labW + w},${yy} ${labW + w},${yy + r}V${yy + h - r}Q${labW + w},${yy + h} ${labW + w - r},${yy + h}H${labW}Z`} fill={color} />
          <text x={labW + w + 8} y={yy + h / 2 + 4} style={{ fill: 'var(--ink)', fontSize: 12 }}>{fmt(d.value)}</text>
          <rect x={0} y={k * rowH} width={W} height={rowH} fill="transparent" onMouseLeave={() => setTip(null)}
            onMouseMove={e => { const p = posRel(ref.current, e); setTip({ x: p.x, y: p.y, conteudo: <>
              <TipTitulo>{d.label}</TipTitulo>
              <TipLinha rotulo="Média mensal" valor={fmt(d.value)} />
              <TipLinha rotulo="Participação" valor={pctF.format(d.value / total)} />
            </> }); }} />
        </g>;
      })}
    </svg>}
    <Tooltip tip={tip} largura={ref.current?.clientWidth ?? W} />
  </div>;
}
