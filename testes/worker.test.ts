/** Worker: confere o token do Access, a lista de e-mails, o token da conta de serviço e a leitura da planilha.
 *  Tudo simulado: chaves RSA geradas no teste, fetch interceptado. Nenhum dado real. */
import { createLocalJWKSet, exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT, importSPKI, exportSPKI, type JSONWebKeySet } from 'jose';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import worker, { jwks, tokenGoogle, type Env } from '../worker/index';

const TEAM = 'https://casal.cloudflareaccess.com', AUD = 'aud-teste';
let accessPriv: CryptoKey, jwksBody: unknown, saKey: string, saPubPem: string;

beforeAll(async () => {
  const a = await generateKeyPair('RS256', { extractable: true });
  accessPriv = a.privateKey as CryptoKey;
  jwksBody = { keys: [{ ...(await exportJWK(a.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] };
  // Fora do Cloudflare o jose busca as chaves por http do Node (escapa do fetch simulado): fornecemos direto.
  jwks[TEAM] = createLocalJWKSet(jwksBody as JSONWebKeySet);
  const s = await generateKeyPair('RS256', { extractable: true });
  saKey = JSON.stringify({ client_email: 'painel-leitura@teste.iam.gserviceaccount.com', private_key: await exportPKCS8(s.privateKey) });
  saPubPem = await exportSPKI(s.publicKey);
});
afterEach(() => vi.unstubAllGlobals());

const tokenAccess = (email: string, opts: { aud?: string; iss?: string; exp?: number } = {}) =>
  new SignJWT({ email }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(opts.iss ?? TEAM).setAudience(opts.aud ?? AUD)
    .setIssuedAt().setExpirationTime(opts.exp ?? Math.floor(Date.now() / 1000) + 600).sign(accessPriv);

const env = (extra: Partial<Env> = {}): Env => ({
  ASSETS: { fetch: async () => new Response('<html>site</html>', { headers: { 'content-type': 'text/html' } }) },
  TEAM_DOMAIN: TEAM, POLICY_AUD: AUD, ALLOWED_EMAILS: 'rodrigo@exemplo.com, dhecika@exemplo.com',
  SPREADSHEET_ID: 'PLANILHA', GOOGLE_SA_KEY: '', ...extra,
});

/** Simula Access (certs), Google (token) e Sheets (metadados + valores). Guarda o pedido de token para conferir a assinatura. */
function simularRede(opcoes: { sheetsStatus?: number } = {}) {
  const pedidos: { url: string; body?: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    pedidos.push({ url, body: init?.body ? String(init.body) : undefined });
    if (url === `${TEAM}/cdn-cgi/access/certs`) return Response.json(jwksBody);
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'tok-google', expires_in: 3600 });
    if (url.startsWith('https://sheets.googleapis.com/')) {
      if (opcoes.sheetsStatus) return new Response('{}', { status: opcoes.sheetsStatus });
      if (url.includes('batchGet')) return Response.json({ valueRanges: [
        { values: [['Descrição', 'Valor', 'Início'], ['Salário', 4338, ''], ['13º', 4338, 46357], ['', '', '']] },
        { values: [['Chave', 'Valor'], ['pessoa_1', 'Bruno']] }] });
      return Response.json({ properties: { title: 'Teste' }, sheets: [{ properties: { title: 'Como usar' } }, { properties: { title: 'Receitas Bruno' } }, { properties: { title: 'Premissas' } }] });
    }
    throw new Error('fetch inesperado: ' + url);
  }));
  return pedidos;
}
const pedir = async (path: string, e: Env, token?: string) =>
  worker.fetch(new Request('https://financas.exemplo.dev' + path, { headers: token ? { 'cf-access-jwt-assertion': token } : {} }), e);

describe('Worker /api', () => {
  it('fora de /api entrega os arquivos do site', async () => {
    const r = await pedir('/', env());
    expect(await r.text()).toContain('site');
  });

  it('sem token do Access → 401', async () => {
    simularRede();
    const r = await pedir('/api/dados', env());
    expect(r.status).toBe(401);
  });

  it('token de outra aplicação (AUD errado) ou de outra equipe → 401', async () => {
    simularRede();
    expect((await pedir('/api/eu', env(), await tokenAccess('rodrigo@exemplo.com', { aud: 'outra' }))).status).toBe(401);
    expect((await pedir('/api/eu', env(), await tokenAccess('rodrigo@exemplo.com', { iss: 'https://outra.cloudflareaccess.com' }))).status).toBe(401);
  });

  it('token expirado → 401', async () => {
    simularRede();
    const r = await pedir('/api/eu', env(), await tokenAccess('rodrigo@exemplo.com', { exp: Math.floor(Date.now() / 1000) - 60 }));
    expect(r.status).toBe(401);
  });

  it('e-mail fora da lista → 403, mesmo com token válido', async () => {
    simularRede();
    const r = await pedir('/api/eu', env(), await tokenAccess('intruso@exemplo.com'));
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toContain('intruso@exemplo.com');
  });

  it('e-mail da lista (sem diferenciar maiúsculas) → /api/eu devolve o e-mail', async () => {
    simularRede();
    const r = await pedir('/api/eu', env(), await tokenAccess('Rodrigo@Exemplo.com'));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ email: 'rodrigo@exemplo.com' });
  });

  it('/api/dados lê a planilha com a conta de serviço, no formato que o painel entende', async () => {
    const pedidos = simularRede();
    const r = await pedir('/api/dados', env({ GOOGLE_SA_KEY: saKey }), await tokenAccess('dhecika@exemplo.com'));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const body = await r.json();
    expect(body.email).toBe('dhecika@exemplo.com');
    expect(body.raw).toEqual({ _planilha: 'Teste',
      'Receitas Bruno': [{ Descrição: 'Salário', Valor: 4338, Início: '' }, { Descrição: '13º', Valor: 4338, Início: 46357 }],
      Premissas: [{ Chave: 'pessoa_1', Valor: 'Bruno' }] });
    // "Como usar" não é lida; o pedido de valores usa valores crus e datas como número de série
    const batch = pedidos.find(p => p.url.includes('batchGet'))!.url;
    expect(batch).not.toContain('Como%20usar');
    expect(batch).toContain('valueRenderOption=UNFORMATTED_VALUE');
    // a asserção enviada ao Google é assinada pela chave da conta de serviço, só com escopo de leitura
    const assertion = new URLSearchParams(pedidos.find(p => p.url.includes('oauth2'))!.body).get('assertion')!;
    const { payload } = await jwtVerify(assertion, await importSPKI(saPubPem, 'RS256'), { audience: 'https://oauth2.googleapis.com/token' });
    expect(payload.iss).toBe('painel-leitura@teste.iam.gserviceaccount.com');
    expect(payload.scope).toBe('https://www.googleapis.com/auth/spreadsheets.readonly');
  });

  it('planilha não compartilhada com a conta de serviço → mensagem clara', async () => {
    simularRede({ sheetsStatus: 403 });
    const r = await pedir('/api/dados', env({ GOOGLE_SA_KEY: saKey }), await tokenAccess('rodrigo@exemplo.com'));
    expect(r.status).toBe(502);
    expect((await r.json()).erro).toContain('Compartilhe a planilha');
  });

  it('sem configuração do Access → 500 dizendo o que falta (nunca libera os dados)', async () => {
    simularRede();
    const r = await pedir('/api/dados', env({ TEAM_DOMAIN: '', GOOGLE_SA_KEY: saKey }), await tokenAccess('rodrigo@exemplo.com'));
    expect(r.status).toBe(500);
    expect((await r.json()).erro).toContain('TEAM_DOMAIN');
  });

  it('TEAM_DOMAIN com texto de exemplo → 500 com o formato esperado', async () => {
    simularRede();
    const r = await pedir('/api/eu', env({ TEAM_DOMAIN: 'https://<sua-equipe>.cloudflareaccess.com' }), await tokenAccess('rodrigo@exemplo.com'));
    expect(r.status).toBe(500);
    expect((await r.json()).erro).toContain('cloudflareaccess.com');
  });

  it('reaproveita o token do Google até perto de expirar', async () => {
    const pedidos = simularRede();
    const e = env({ GOOGLE_SA_KEY: saKey }), t0 = Date.now() + 10 * 3600e3;   // instante novo: ignora o cache dos testes anteriores
    await tokenGoogle(e, t0); await tokenGoogle(e, t0 + 1000);
    expect(pedidos.filter(p => p.url.includes('oauth2')).length).toBe(1);
    await tokenGoogle(e, t0 + 3600e3);
    expect(pedidos.filter(p => p.url.includes('oauth2')).length).toBe(2);
  });
});
