# Painel financeiro do casal

Painel que lê os dados de uma planilha do Google Sheets e mostra projeções, divisão do casal,
faturas de cartão e o calendário do mês. Nenhum dado financeiro fica no repositório.

> **Branch `migracao-cloudflare`:** versão 2 em Vite + React + TypeScript, a caminho do Cloudflare.
> O site no ar ainda é o da `main` (versão 1, um `index.html` só no GitHub Pages).

## Desenvolvimento

```bash
npm ci            # instala os pacotes
npm test          # testes de paridade com a versão 1 (Vitest)
npm run dev       # servidor local em http://localhost:5173
npm run build     # gera dist/
```

- `src/calculos/`: regras de cálculo (folha INSS/IRRF, cartões, casal, dias úteis, calendário).
- `src/planilha/`: leitura e normalização das abas da planilha.
- `src/componentes/`: gráficos em SVG e as seções da tela.
- `testes/`: fixtures com dados fictícios e o gabarito gerado pela versão 1.
- `public/config.js`: `CLIENT_ID` e `SPREADSHEET_ID` (públicos, não são senhas).
- `modelo/planilha-modelo.xlsx`: estrutura das abas para recomeçar do zero.

O contexto completo do projeto (regras, decisões, problemas já resolvidos) está no `CLAUDE.md`.
