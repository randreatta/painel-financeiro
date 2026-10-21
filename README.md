# Painel financeiro do casal

Site estático (GitHub Pages) que lê os dados direto de uma planilha do Google Sheets.
Para ver os dados é preciso **entrar com uma conta Google que tenha acesso à planilha**.
O repositório não guarda nenhum dado financeiro, só o código.

- Editou a planilha → clique em **↻ Atualizar** no site. Não precisa mexer no GitHub.
- `modelo/planilha-modelo.xlsx` é a planilha modelo (estrutura das abas).

---

## Configuração (uma vez só, ~15 min)

### 1. Publicar o site no GitHub Pages

1. No GitHub: **New repository** → nome `painel-financeiro` → **Public** → **Create repository**.
   (GitHub Pages gratuito exige repositório público. Não tem problema: aqui só tem código, sem dados.)
2. Na página do repositório: **Add file → Upload files** → arraste **todo o conteúdo desta pasta**
   (`index.html`, `config.js`, `README.md` e a pasta `modelo`) → **Commit changes**.
3. **Settings → Pages** → em *Build and deployment*: Source **Deploy from a branch**, Branch **main** e pasta **/ (root)** → **Save**.
4. Em 1–2 minutos o site fica no ar em `https://SEU-USUARIO.github.io/painel-financeiro/`.
   Ao abrir, ele mostra "Site não configurado" até você preencher o `config.js`, o que é esperado nessa etapa.

### 2. Criar o login com Google (Google Cloud)

1. Acesse <https://console.cloud.google.com> com a **sua** conta (a dona da planilha).
2. Seletor de projetos (topo) → **Novo projeto** → nome `Painel financeiro` → **Criar**, e selecione o projeto.
3. Busque **Google Sheets API** na barra de pesquisa → **Ativar**.
4. Busque **OAuth** (ou vá em *APIs e serviços → Tela de consentimento OAuth*) → **Primeiros passos / Get started**:
   - Nome do app: `Painel financeiro`; e-mail de suporte: o seu.
   - Público: **Externo**.
   - Dados de contato: o seu e-mail → aceite a política → **Criar**.
5. Aba **Público-alvo (Audience)** → **Usuários de teste → Add users**: o **seu e-mail** e o **e-mail dela** → Salvar.
   Deixe o app em modo **Teste**: só essas contas conseguem entrar, e não é preciso pedir verificação ao Google.
6. Aba **Clientes (Clients)** → **Criar cliente**:
   - Tipo: **Aplicativo da Web**; nome: `Site GitHub`.
   - **Origens JavaScript autorizadas** → adicionar `https://SEU-USUARIO.github.io`
     (só o domínio: sem `/painel-financeiro` e sem barra no final).
   - Redirecionamentos: deixe vazio. → **Criar**.
7. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`). Não precisa da "chave secreta".

### 3. Ligar o site à planilha

1. Abra a planilha e copie o ID da URL: `https://docs.google.com/spreadsheets/d/`**`ESTE_TRECHO`**`/edit`.
2. No GitHub, abra `config.js` → ícone de lápis (Edit) → cole o `CLIENT_ID` e o `SPREADSHEET_ID` → **Commit changes**.
3. Espere 1–2 minutos e abra o site → **Entrar com Google**.
   Na primeira vez o Google avisa que o app não foi verificado: clique em **Continuar**. O app é seu, em modo de teste.
   Depois, permita a leitura das planilhas.

### 4. Ela também

Ela precisa de três coisas:
- a planilha compartilhada com ela (**Compartilhar** → e-mail dela);
- o e-mail dela na lista de usuários de teste (passo 2.5);
- abrir o mesmo endereço do site e entrar com a conta dela.

---

## Segurança, em resumo

- O site pede só **leitura** de planilhas (`spreadsheets.readonly`) e lê a planilha **com a conta de quem entrou**.
  Quem não tem acesso à planilha recebe "sem acesso", mesmo tendo o endereço do site.
- Com o app em modo Teste, só os e-mails da lista de usuários de teste conseguem fazer login.
- O login dura cerca de 1 hora por aba do navegador. Depois disso, é só clicar em **Entrar com Google** de novo. **Sair** encerra na hora.
- O `CLIENT_ID` e o `SPREADSHEET_ID` ficam visíveis no repositório, mas não são senhas: nenhum dos dois dá acesso aos dados.

## Problemas comuns

| Mensagem | O que fazer |
|---|---|
| `Error 400: origin_mismatch` | A origem do passo 2.6 está diferente do endereço do site. Use só `https://SEU-USUARIO.github.io`. |
| `Error 403: access_denied` | O e-mail não está nos usuários de teste (passo 2.5). |
| "não tem acesso a esta planilha" | Compartilhe a planilha com essa conta, ou entre com a conta certa. |
| "Planilha não encontrada" | Confira o `SPREADSHEET_ID` no `config.js`. |
| Aviso amarelo de linhas ignoradas | O painel diz a aba e a linha: falta valor ou data de Início. |

## Testar no computador (opcional)

Adicione `http://localhost:8000` nas origens autorizadas do passo 2.6. Depois, rode dentro desta pasta:

```bash
python3 -m http.server 8000
```

e abra <http://localhost:8000>.
# painel-financeiro
