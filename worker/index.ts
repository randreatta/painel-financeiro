/** Worker do painel: serve o site (arquivos de dist/) e a API /api/*.
 *  - Quem chega aqui já passou pelo Cloudflare Access; mesmo assim cada pedido à API confere o token do
 *    Access (cabeçalho Cf-Access-Jwt-Assertion) e a lista de e-mails permitidos.
 *  - A planilha é lida com a conta de serviço do Google (segredo GOOGLE_SA_KEY), só com permissão de leitura. */
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTVerifyGetKey } from 'jose';
import { Erro } from './erro';
import { lerAbas } from './sheets';

export { Erro };

export interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  /** https://<equipe>.cloudflareaccess.com */
  TEAM_DOMAIN: string;
  /** "Application Audience (AUD) Tag" da aplicação do Access. */
  POLICY_AUD: string;
  /** E-mails que podem ver os dados, separados por vírgula (segredo; defesa extra além da regra do Access). */
  ALLOWED_EMAILS: string;
  SPREADSHEET_ID: string;
  /** JSON da chave da conta de serviço (segredo). */
  GOOGLE_SA_KEY: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/* ---------- Access ---------- */
/** Chaves públicas do Access por equipe (exportado só para os testes poderem fornecer as chaves). */
export const jwks: Record<string, JWTVerifyGetKey> = {};
export async function usuarioDoAccess(req: Request, env: Env): Promise<string> {
  const faltando = (['TEAM_DOMAIN', 'POLICY_AUD', 'ALLOWED_EMAILS', 'GOOGLE_SA_KEY'] as const).filter(k => !env[k]);
  if (!env.TEAM_DOMAIN || !env.POLICY_AUD) throw new Erro(500, `O Worker não está vendo estas variáveis: ${faltando.join(', ')}. `
    + 'Cadastre em Configurações → Variáveis e segredos (no topo da página, não na seção de Compilação) e implante de novo.');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com\/?$/.test(env.TEAM_DOMAIN.trim()))
    throw new Erro(500, 'TEAM_DOMAIN deve ser no formato https://<equipe>.cloudflareaccess.com (o "Full domain" do Zero Trust, com https://).');
  const token = req.headers.get('cf-access-jwt-assertion');
  if (!token) throw new Erro(401, 'Sem login do Cloudflare Access.');
  const team = env.TEAM_DOMAIN.trim().replace(/\/$/, '');
  jwks[team] ??= createRemoteJWKSet(new URL(`${team}/cdn-cgi/access/certs`));
  let email = '';
  try {
    const { payload } = await jwtVerify(token, jwks[team], { issuer: team, audience: env.POLICY_AUD.trim() });
    email = String(payload.email || '').toLowerCase();
  } catch { throw new Erro(401, 'Login do Cloudflare Access inválido ou expirado.'); }
  const permitidos = (env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!email || (permitidos.length && !permitidos.includes(email))) throw new Erro(403, `A conta ${email || '(sem e-mail)'} não tem acesso a este painel.`);
  return email;
}

/* ---------- Google: token da conta de serviço (guardado até perto de expirar) ---------- */
let cacheToken: { token: string; exp: number; chave: string } | null = null;
export async function tokenGoogle(env: Env, agora = Date.now()): Promise<string> {
  if (!env.GOOGLE_SA_KEY) throw new Erro(500, 'Worker sem o segredo GOOGLE_SA_KEY.');
  if (cacheToken && cacheToken.chave === env.GOOGLE_SA_KEY && agora < cacheToken.exp) return cacheToken.token;
  let sa: { client_email: string; private_key: string; token_uri?: string };
  try { sa = JSON.parse(env.GOOGLE_SA_KEY); } catch { throw new Erro(500, 'GOOGLE_SA_KEY não é um JSON válido.'); }
  const uri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const chave = await importPKCS8(sa.private_key, 'RS256');
  const iat = Math.floor(agora / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets.readonly' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(sa.client_email).setAudience(uri)
    .setIssuedAt(iat).setExpirationTime(iat + 3600).sign(chave);
  const r = await fetch(uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!r.ok) throw new Erro(502, `O Google recusou a conta de serviço (${r.status}).`);
  const t = await r.json() as { access_token: string; expires_in: number };
  cacheToken = { token: t.access_token, exp: agora + (t.expires_in - 120) * 1000, chave: env.GOOGLE_SA_KEY };
  return t.access_token;
}

/* ---------- rotas ---------- */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      const email = await usuarioDoAccess(req, env);
      if (url.pathname === '/api/eu') return json({ email });
      if (url.pathname === '/api/dados' && req.method === 'GET') {
        const raw = await lerAbas(env.SPREADSHEET_ID, await tokenGoogle(env));
        return json({ email, raw });
      }
      return json({ erro: 'Rota não encontrada.' }, 404);
    } catch (e) {
      const st = e instanceof Erro ? e.status : 500;
      return json({ erro: e instanceof Error ? e.message : 'Erro inesperado.' }, st);
    }
  },
};
