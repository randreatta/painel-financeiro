# Painel financeiro do casal

Painel financeiro de Rodrigo e Dhecika. Site estático publicado no GitHub Pages
(`https://randreatta.github.io/painel-financeiro/`) que lê os dados de uma planilha
do Google Sheets ("nosso financeiro") depois do login com Google.

## Arquitetura

- **Sem build, sem dependências.** Tudo está em `index.html`: HTML, CSS e JS num arquivo só,
  com os gráficos em SVG desenhados à mão (sem Chart.js nem outra biblioteca). O `index.html`
  é a fonte da verdade: edite-o direto.
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
| `Receitas <Nome>` (uma por pessoa) | Descrição, Categoria, Valor, Frequência (Mensal/Anual/Única), Início, Fim, Reajusta?, Desconta IRRF? (+ fórmulas IRRF, Líquido) |
| `Despesas <Nome>` (uma por pessoa) | as mesmas + Tipo (Fixa/Variável), Cartão |
| `Despesas Casal` | as mesmas + Pago por (Rodrigo/Dhecika/Conta conjunta), Cartão |
| `Parcelas` | Descrição, Categoria, De quem, Parcela, Restantes, Próxima, Cartão |
| `Investimentos` | Descrição, De quem, Saldo atual, Aporte mensal, Rentabilidade anual |
| `Cartões` | Cartão, De quem, Fechamento (dia), Vencimento (dia), Limite |
| `Tabela IRRF` | Faixa, De (base de cálculo), Alíquota, Parcela a deduzir (tabela progressiva mensal) |
| `Premissas` | Chave, Parâmetro, Valor. Chaves: `irrf_desconto_simplificado`, `irrf_isencao_ate`, `irrf_reducao_ate`, `irrf_reducao_constante`, `irrf_reducao_fator`, `pessoa_1`, `pessoa_2`, `divisao_casal`, `percentual_pessoa_1`, `saldo_conta`, `inflacao`, `reajuste_salarial`, `mes_reajuste`, `meses_projecao`, `meta_reserva_meses`, `otimista_*`, `pessimista_*` |
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

## IRRF (salário bruto → líquido)

- Receita com "Desconta IRRF? = Sim" tem **Valor bruto**. O painel desconta o IRRF **mês a mês sobre o bruto já
  reajustado** (`irrfOf()`): tabela progressiva sobre `bruto − irrf_desconto_simplificado`, arredondada a centavos;
  depois a redução de 2026 (Lei 15.270/2025): bruto ≤ `irrf_isencao_ate` → imposto zero; até `irrf_reducao_ate` →
  redução de `irrf_reducao_constante − irrf_reducao_fator × bruto`. Exemplo oficial: R$ 6.000 → R$ 394,54.
- O Rodrigo só tem IRRF como desconto (sem INSS), por isso o desconto simplificado. 13º e 1/3 de férias usam a
  mesma conta, item por item (aproximação: na folha real, férias são tributadas junto no mês de pagamento).
- A planilha tem a mesma conta em fórmulas (colunas IRRF e Líquido; "Mensal equiv." usa o líquido). Mantenha as duas
  iguais. Se faltar a aba `Tabela IRRF` ou as chaves `irrf_*`, o painel usa a tabela 2026 embutida.
- A divisão proporcional do casal usa a renda **líquida**.
- Fórmulas da planilha estão no padrão pt-BR (separador `;`). Ao escrever pela API, use `;` e nomes em inglês.

## Interface

- Paleta e ritmo visual seguem o método da skill de dataviz: cores por papel em variáveis CSS
  no `:root`, com tema escuro próprio (`prefers-color-scheme` + `[data-theme]`). Receitas = `--s1`
  (azul), saídas = `--s2` (laranja). Cenários: base = azul, otimista = `--s3`, pessimista = laranja.
- Sem gráfico de dois eixos. Toda série tem legenda e tooltip. Texto nunca na cor da série.
- Textos da interface em **português do Brasil**, valores em `R$` via `Intl.NumberFormat('pt-BR')`.
- Precisa funcionar em celular (~390px) sem rolagem horizontal.

## Como testar antes de publicar

Não há testes automatizados no repositório. O que funciona bem:
1. Servir a pasta: `python3 -m http.server 8000`.
2. Com Playwright, interceptar `config.js`, `accounts.google.com/o/oauth2/v2/auth` (responder
   com um redirect para `REDIRECT_URI#access_token=...&state=...&scope=...spreadsheets...`),
   `oauth2/v3/userinfo` e `sheets.googleapis.com` (devolver `valueRanges` montados da planilha
   modelo, com datas como número de série).
3. Conferir: nenhum `pageerror`; login → painel; 403 → mensagem "não tem acesso"; tirar
   screenshot claro, escuro e em 390px de largura e olhar.

## Publicação

- Commit na `main` → o GitHub Pages publica em 1–2 min (aba Actions, "pages build and deployment").
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
