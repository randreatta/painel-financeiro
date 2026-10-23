# Painel financeiro do casal

Painel financeiro de Rodrigo e Dhecika. Site estático publicado no GitHub Pages
(`https://randreatta.github.io/painel-financeiro/`) que lê os dados de uma planilha
do Google Sheets ("nosso financeiro") depois do login com Google.

## Migração em andamento (branch `migracao-cloudflare`)

O projeto está migrando para Cloudflare (Workers + Access) em etapas; o plano está no doc
"Plano de migração: painel financeiro para Cloudflare". **A `main` ainda é o painel v1** (um
`index.html` só, publicado pelo GitHub Pages). O branch `migracao-cloudflare` já tem a Etapa 1:

- **Vite + React + TypeScript**, sem bibliotecas de gráfico (SVG à mão, em `src/componentes/graficos.tsx`).
- `src/calculos/`: regras puras (`folha.ts`, `datas.ts`, `projecao.ts`, `casal.ts`, `calendario.ts`,
  `painel.ts`, `util.ts`, `tipos.ts`). `src/planilha/normalizar.ts` lê as abas; `src/planilha/google.ts`
  faz login e leitura (provisório até as Etapas 2 e 3). `src/componentes/secoes/` = uma seção por arquivo.
- "Hoje" é **parâmetro** (`normalizeData(raw, hoje)`, `calendarMonths(..., hoje)`): nunca chame
  `new Date()` dentro dos cálculos.
- `public/config.js` (copiado para o build). `legado-index.html` = o v1, só como referência.
- **Testes:** `npm test` (Vitest, `TZ=America/Sao_Paulo`). `testes/paridade.test.ts` compara o motor
  novo com `testes/gabarito/*.json`, gerado rodando o v1 sobre `testes/fixtures/*.json` (dados
  **fictícios**: Bruno e Ana) com hoje = 23/10/2026 15:00. Mudou uma regra de cálculo de propósito?
  Atualize o gabarito junto e explique no commit. Nunca coloque dados reais do casal nas fixtures.
- **Sem npm no ambiente do Claude:** o registro do npm é bloqueado na sessão de nuvem. A automação
  `.github/workflows/deps.yml` instala os pacotes no GitHub e publica `node_modules.tgz` +
  `package-lock.json` no branch `ci-deps`; para trabalhar: `git fetch origin ci-deps:refs/remotes/origin/ci-deps`,
  `git show origin/ci-deps:node_modules.tgz | tar xz`. Mexeu no `package.json`? Faça push, espere o
  workflow "Dependências" e traga o lock e os pacotes de novo. `.github/workflows/ci.yml` roda testes
  e build a cada push no branch (resultados como anotações: `gh run view <id>`; o log completo não baixa).

## Arquitetura do v1 (main)

- **Sem build, sem dependências.** Tudo está em `index.html`: HTML, CSS e JS num arquivo só,
  com os gráficos em SVG desenhados à mão (sem Chart.js nem outra biblioteca).
- **`config.js`** define `window.CONFIG = { CLIENT_ID, SPREADSHEET_ID }`. Os dois são públicos
  por natureza (não são senhas). Não mude o arquivo sem o usuário pedir.
- **`modelo/planilha-modelo.xlsx`** é a planilha modelo, com dados de exemplo, para recomeçar do zero.
- **Nenhum dado financeiro vai para o repositório**, que é público. Os dados ficam só na planilha.

## Login e leitura dos dados

- OAuth 2.0 **implicit flow por redirecionamento na mesma aba**
  (`accounts.google.com/o/oauth2/v2/auth`, `response_type=token`), com `state` guardado em
  `sessionStorage` e validado na volta. O token fica em `sessionStorage` (`fin_auth`) e dura
  cerca de 1h. O último e-mail fica em `localStorage` (`fin_email`) como `login_hint`.
- Escopos: `spreadsheets.readonly openid email`.
- **Não volte para o login por pop-up** (Google Identity Services `initTokenClient`). O
  Cross-Origin-Opener-Policy do Google faz o pop-up parecer "fechado" e o login falha, e o
  GitHub Pages não deixa mudar cabeçalhos.
- O `REDIRECT_URI` é `location.origin + pathname` (sem `index.html`). Ele precisa estar
  cadastrado no Google Cloud (cliente OAuth "Site GitHub"), junto com a origem
  `https://randreatta.github.io`. O app está em **modo Teste**, com os e-mails do casal como
  usuários de teste.
- Leitura: `GET spreadsheets/{id}` (títulos das abas) seguido de `values:batchGet` com
  `UNFORMATTED_VALUE` e `dateTimeRenderOption=SERIAL_NUMBER`. As datas chegam como número de
  série, e `parseDate` trata isso. A aba "Como usar" é ignorada.
- Erros tratados na tela de login: 401 (sessão expirou), 403 (conta sem acesso à planilha),
  404 (`SPREADSHEET_ID` errado), `access_denied` e `state` inválido.

## Estrutura da planilha (o painel lê pelos nomes)

Cabeçalhos e chaves são comparados **normalizados** (minúsculas, sem acento, sem espaço):
"Próxima" = "proxima". Não dependa da posição das colunas.

| Aba | Colunas principais |
|---|---|
| `Receitas <Nome>` (uma por pessoa) | Descrição, Categoria, Valor, Frequência (Mensal/Anual/Única), Início, Fim, Reajusta?, Desconta INSS? (+ fórmulas INSS, IRRF, Líquido), Pagamento (dia), Adiantamento (%), Dia do adiantamento |
| `Despesas <Nome>` (uma por pessoa) | as mesmas + Tipo (Fixa/Variável), Cartão, Dia do pagamento |
| `Despesas Casal` | as mesmas + Pago por (Rodrigo/Dhecika/Conta conjunta), Cartão, Dia do pagamento |
| `Parcelas` | Descrição, Categoria, De quem, Parcela, Restantes, Próxima, Cartão |
| `Investimentos` | Descrição, De quem, Saldo atual, Aporte mensal, Rentabilidade anual |
| `Cartões` | Cartão, De quem, Fechamento (dia), Vencimento (dia), Limite |
| `Tabela INSS` | Faixa, De, Até, Alíquota (contribuição progressiva do empregado) |
| `Tabela IRRF` | Faixa, De (base de cálculo), Alíquota, Parcela a deduzir (tabela progressiva mensal) |
| `Premissas` | Chave, Parâmetro, Valor. Chaves: `irrf_desconto_simplificado`, `irrf_isencao_ate`, `irrf_reducao_ate`, `irrf_reducao_constante`, `irrf_reducao_fator`, `sabado_dia_util`, `pessoa_1`, `pessoa_2`, `divisao_casal`, `percentual_pessoa_1`, `saldo_conta`, `inflacao`, `reajuste_salarial`, `mes_reajuste`, `meses_projecao`, `meta_reserva_meses`, `otimista_*`, `pessimista_*` |
| `Lançamentos` (opcional) | Data, Descrição, Categoria, De quem, Tipo (Receita/Despesa), Valor |

- **Pessoas:** os nomes vêm de `pessoa_1` (Rodrigo) e `pessoa_2` (Dhecika) na Premissas e
  precisam bater com o sufixo das abas `Receitas X` e `Despesas X`. "De quem" vazio = Casal.
- Colunas "Mensal equiv.", "Total restante" e "Última parcela" são fórmulas da planilha.
  O painel não usa nenhuma delas.
- Percentuais são guardados como fração (0,045 = 4,5%). `pctVal` também aceita 4,5.
- Linha sem valor ou item anual/único sem Início → ignorada, com aviso amarelo no painel.

## Regras de cálculo (motor `project()`)

- **Ocorrência:** Mensal = todo mês entre Início e Fim (vazio = sempre); Anual = todo ano no
  mês do Início; Única = só no mês do Início.
- Despesas com "Reajusta? = Sim" sobem pela inflação composta mês a mês. Receitas com "Sim"
  sobem pelo reajuste salarial no `mes_reajuste`.
- **Cartão de crédito:** despesa com Cartão sai do caixa no **mês seguinte** (`occurs(it, i - 1)`)
  e entra na fatura desse mês. Parcelas **não** são deslocadas: entram na fatura do mês da
  parcela. "Limite comprometido" = fatura do mês + parcelas futuras daquele cartão.
- **Cenários:** otimista/pessimista mexem na inflação (p.p.) e só nas despesas **variáveis**.
- Aportes saem da conta e rendem pela taxa mensal equivalente. A sobra fica na conta, sem rendimento.
- **Visão por pessoa** (`weight()`): item da pessoa = 1; item do casal = parte dela
  (`share1` ou `1 - share1`); item do outro = 0.
- **Divisão do casal** (`divisao_casal`): proporcional à renda mensal equivalente (padrão),
  50/50 ou percentual fixo.
- **Acerto** (`settlement()`): compara o que cada um pagou direto ("Pago por") com a parte
  justa. O que sai da "Conta conjunta" vira depósito proporcional de cada um.

## Descontos de folha: INSS + IRRF (salário bruto → líquido)

- Receita com "Desconta INSS? = Sim" tem **Valor bruto** (CLT). O painel calcula, **mês a mês sobre o bruto já
  reajustado**, `folhaOf()` = `inssOf()` + `irrfOf()`:
  - **INSS** progressivo pela aba `Tabela INSS` (De, Até, Alíquota): cada alíquota só sobre a parte do salário na
    faixa; teto = último "Até". 2026 (Portaria MPS/MF nº 13/2026): 7,5% até 1.621; 9% até 2.902,84; 12% até
    4.354,27; 14% até 8.475,55 (máx. R$ 988,09). Ex.: 4.338 → 409,16; 5.000 → 501,51.
  - **IRRF**: tabela progressiva (aba `Tabela IRRF`) sobre `bruto − max(INSS, irrf_desconto_simplificado)`,
    arredondada a centavos; depois a redução de 2026 (Lei 15.270/2025): bruto ≤ `irrf_isencao_ate` → zero; até
    `irrf_reducao_ate` → redução de `irrf_reducao_constante − irrf_reducao_fator × bruto`.
- O salário do Rodrigo (R$ 4.338) só tem INSS na prática: o IRRF é zero até R$ 5.000 de bruto.
- 13º e 1/3 de férias usam a mesma conta, item por item (aproximação: na folha real, férias + 1/3 somam no mês).
- A planilha tem a mesma conta em fórmulas (colunas INSS, IRRF, Líquido; "Mensal equiv." usa o líquido).
  Mantenha as duas iguais. Sem as abas de tabela, o painel usa as tabelas 2026 embutidas.
- A coluna antiga "Desconta IRRF?" ainda é aceita como sinônimo.
- A divisão proporcional do casal usa a renda **líquida**.
- Fórmulas da planilha estão no padrão pt-BR (separador `;`). Ao escrever pela API, use `;` e nomes em inglês.

## Datas de pagamento e Calendário do mês

- Salários quinzenais: Rodrigo recebe 40% do **bruto** no dia 20 (adiantamento) e o saldo (já sem INSS/IRRF)
  no 5º dia útil; Dhecika, 40% no dia 15 e o saldo no 1º dia útil. Na planilha: "Pagamento (dia)",
  "Adiantamento (%)", "Dia do adiantamento". Receita sem "Pagamento (dia)" (13º, férias) cai no dia do salário
  da mesma pessoa (`pagPadrao`).
- `payDay()`: "Nº dia útil" conta sábado se `sabado_dia_util = Sim` (regra da CLT), sem domingo e sem feriado
  nacional (`feriados()`: fixos + 20/11 + Sexta-feira Santa); se o prazo cair num sábado, o crédito vem no dia
  útil anterior. Dia fixo em fim de semana/feriado também é antecipado. "Último dia útil" é aceito.
- `project()` gera `r.ev` (eventos datados): entradas, despesas sem cartão no "Dia do pagamento", parcelas sem
  cartão no dia da "Próxima", uma "Fatura X" por cartão no vencimento, e os aportes no dia da maior entrada.
  Despesa sem dia é contada no 1º dia do período (conservador) e listada à parte.
- `calendarMonths()` encadeia o saldo dia a dia a partir do `saldo_conta` de **hoje**: no mês atual só entram
  eventos depois de hoje. (A projeção mensal de `project()` ainda conta o mês atual inteiro.)

## Interface

- Paleta e ritmo visual seguem o método da skill de dataviz: cores por papel em variáveis CSS
  no `:root`, com tema escuro próprio (`prefers-color-scheme` + `[data-theme]`). Receitas = `--s1`
  (azul), saídas = `--s2` (laranja). Cenários: base = azul, otimista = `--s3`, pessimista = laranja.
- Sem gráfico de dois eixos. Toda série tem legenda e tooltip. Texto nunca na cor da série.
- Textos da interface em **português do Brasil**, valores em `R$` via `Intl.NumberFormat('pt-BR')`.
- Precisa funcionar em celular (~390px) sem rolagem horizontal.

## Como testar antes de publicar

No branch da migração: `npm test` e `npm run build`. Para a tela (vale para v1 e v2):
1. Servir a pasta (v1) ou o `dist/` (v2): `python3 -m http.server 8000`.
2. Com Playwright, interceptar `config.js`, `accounts.google.com/o/oauth2/v2/auth` (responder
   com um redirect para `REDIRECT_URI#access_token=...&state=...&scope=...spreadsheets...`),
   `oauth2/v3/userinfo` e `sheets.googleapis.com` (devolver `valueRanges` montados da planilha
   modelo, com datas como número de série).
3. Conferir: nenhum `pageerror`; login → painel; 403 → mensagem "não tem acesso"; tirar
   screenshot claro, escuro e em 390px de largura e olhar.

## Publicação

- Commit na `main` → o GitHub Pages publica em 1–2 min (aba Actions, "pages build and deployment").
  **Não junte `migracao-cloudflare` na `main` antes da virada (Etapa 4):** o Pages serviria o
  `index.html` do Vite sem build e o site quebraria.
- Mensagens de commit em português, curtas, no imperativo ("Adiciona…", "Corrige…").
- Antes de publicar: `git pull --ff-only` (o usuário às vezes edita pelo site do GitHub).
- Nunca crie um segundo `index.html` (ex.: `index (1).html`). O Pages só serve `index.html` na raiz.

## Problemas já vistos

| Sintoma | Causa |
|---|---|
| "A janela de login foi fechada" + aviso de COOP no console | Login por pop-up. Use o redirect. |
| `Erro 401: invalid_client` | `CLIENT_ID` errado ou cliente recém-criado (leva alguns minutos para valer). |
| `redirect_uri_mismatch` | O endereço de retorno não está cadastrado no cliente OAuth. Cadastre exatamente `https://randreatta.github.io/painel-financeiro/` (com a barra final). |
| Site antigo depois de publicar | Cache do navegador (Ctrl+Shift+R ou janela anônima) ou Pages ainda publicando. |
