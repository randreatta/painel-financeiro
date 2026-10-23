/** Painel financeiro do casal: login, leitura da planilha, seletores do topo e as seções. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { derivar } from './calculos/painel';
import type { Cenario, Raw, Visao } from './calculos/tipos';
import { normalizeData } from './planilha/normalizar';
import { configurado, concluirLogin, entrar, ErroApi, lerPlanilha, lerRetorno, linkPlanilha, sair, sessaoSalva, type Sessao } from './planilha/google';
import { Alertas, Kpis } from './componentes/secoes/Resumo';
import { Casal } from './componentes/secoes/Casal';
import { Categorias, Composicao, Fluxo, Historico, Patrimonio } from './componentes/secoes/Graficos';
import { Eventos } from './componentes/secoes/Eventos';
import { Calendario } from './componentes/secoes/Calendario';
import { Cartoes } from './componentes/secoes/Cartoes';
import { Notas, Tabela } from './componentes/secoes/Tabela';
import type { PropsSecao } from './componentes/comum';

type Estado =
  | { fase: 'nao-configurado' }
  | { fase: 'login'; msg?: string }
  | { fase: 'carregando' }
  | { fase: 'pronto'; raw: Raw; lidaEm: Date };

const LogoGoogle = () => <svg viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
  <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
  <path fill="#FBBC05" d="M10.6 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.2z" />
  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
</svg>;

export default function App() {
  const [estado, setEstado] = useState<Estado>(configurado ? { fase: 'carregando' } : { fase: 'nao-configurado' });
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [scen, setScen] = useState<Cenario>('base');
  const [who, setWho] = useState<Visao>('casal');
  const [N, setN] = useState<number | null>(null);   // null = usa "meses_projecao" da planilha

  const carregar = useCallback(async (s: Sessao | null) => {
    if (!s || Date.now() > s.exp) { setEstado({ fase: 'login', msg: s ? 'Sua sessão expirou, entre de novo.' : undefined }); return; }
    setEstado(e => e.fase === 'pronto' ? e : { fase: 'carregando' });
    try {
      setEstado({ fase: 'pronto', raw: await lerPlanilha(s.token), lidaEm: new Date() });
    } catch (e) {
      const st = e instanceof ErroApi ? e.status : 0;
      if (st === 401) { sair(null); setSessao(null); setEstado({ fase: 'login', msg: 'Sua sessão expirou, entre de novo.' }); }
      else if (st === 403) setEstado({ fase: 'login', msg: `A conta ${s.email || 'usada'} não tem acesso a esta planilha. Entre com a conta com quem ela foi compartilhada.` });
      else if (st === 404) setEstado({ fase: 'login', msg: 'Planilha não encontrada. Confira o SPREADSHEET_ID no config.js.' });
      else setEstado({ fase: 'login', msg: 'Não consegui ler a planilha: ' + (e as Error).message });
    }
  }, []);

  useEffect(() => {   // início: volta do login do Google, sessão salva ou tela de login
    if (!configurado) return;
    const volta = lerRetorno();
    if (volta && 'erro' in volta) { setEstado({ fase: 'login', msg: volta.erro }); return; }
    if (volta) { concluirLogin(volta).then(s => { setSessao(s); carregar(s); }); return; }
    const s = sessaoSalva(); setSessao(s); carregar(s);
  }, [carregar]);

  const hoje = useMemo(() => new Date(), [estado]);   // eslint-friendly: "hoje" é relido a cada leitura da planilha
  const D = useMemo(() => estado.fase === 'pronto' ? normalizeData(estado.raw, hoje) : null, [estado, hoje]);
  const meses = N ?? (D && D.prem.meses > 0 ? D.prem.meses : 24);
  const d = useMemo(() => D ? derivar(D, scen, who, meses) : null, [D, scen, who, meses]);
  const opcoesN = [...new Set([12, 24, 36, 60, D?.prem.meses ?? 24].filter(n => n > 0))].sort((a, b) => a - b);

  const fonte = estado.fase === 'pronto'
    ? `Planilha “${String(estado.raw._planilha ?? '')}” · lida às ${estado.lidaEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : estado.fase === 'nao-configurado' ? 'Site não configurado' : estado.fase === 'login' ? 'Entre para ver seus dados' : 'Lendo a planilha…';

  const props: PropsSecao | null = D && d ? { D, scen, who, N: meses, d } : null;
  return <div className="wrap">
    <header className="top">
      <div>
        <h1>Painel financeiro</h1>
        <div className="src"><span className={'dot' + (estado.fase === 'pronto' ? ' live' : '')} /><span>{fonte}</span></div>
      </div>
      {props && <div className="controls">
        <div className="seg" role="group" aria-label="Visão">
          {([['casal', 'Casal'], ['p1', props.D.names.p1], ['p2', props.D.names.p2]] as [Visao, string][]).map(([k, l]) =>
            <button key={k} aria-pressed={who === k} onClick={() => setWho(k)}>{l}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Cenário">
          {(['otimista', 'base', 'pessimista'] as Cenario[]).map(k =>
            <button key={k} aria-pressed={scen === k} onClick={() => setScen(k)}>{k[0].toUpperCase() + k.slice(1)}</button>)}
        </div>
        <select aria-label="Horizonte da projeção" value={meses} onChange={e => setN(+e.target.value)}>
          {opcoesN.map(n => <option key={n} value={n}>{n} meses</option>)}
        </select>
        <a className="btn" href={linkPlanilha} target="_blank" rel="noopener" title="Abrir a planilha no Google Sheets para lançar valores">Editar planilha ↗</a>
        <button className="btn" title="Ler a planilha de novo" onClick={() => carregar(sessao)}>↻ Atualizar</button>
        {sessao?.email && <span className="user">{sessao.email}</span>}
        <button className="btn" title="Sair da conta Google neste site" onClick={() => { sair(sessao); setSessao(null); setEstado({ fase: 'login', msg: 'Você saiu.' }); }}>Sair</button>
      </div>}
    </header>

    {props && <Alertas {...props} />}

    {estado.fase === 'login' && <section className="card login">
      <h2>Entrar</h2>
      <p>Use a conta Google que tem acesso à planilha.</p>
      <button className="gbtn" onClick={entrar}><LogoGoogle />Entrar com Google</button>
      <div className="err">{estado.msg}</div>
      <div className="small">Os dados ficam na sua planilha do Google; este site só os lê no seu navegador.</div>
    </section>}
    {estado.fase === 'carregando' && <div className="loading">Lendo seus dados…</div>}
    {estado.fase === 'nao-configurado' && <div className="loading">Preencha o CLIENT_ID e o SPREADSHEET_ID no config.js para ligar o painel à planilha.</div>}

    {props && <>
      <main className="grid">
        <Kpis {...props} />
        <Casal {...props} />
        <Fluxo {...props} />
        <Composicao {...props} />
        <Patrimonio {...props} />
        <Categorias {...props} />
        <Historico {...props} />
        <Eventos {...props} />
        <Calendario {...props} hoje={hoje} />
        <Cartoes {...props} hoje={hoje} />
        <Tabela {...props} />
      </main>
      <Notas D={props.D} />
    </>}
  </div>;
}
