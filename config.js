// Configuração do painel. Os dois valores abaixo não são senhas: sozinhos não dão acesso a nada.
// Só quem fizer login com uma conta Google que tem acesso à planilha consegue ver os dados.
window.CONFIG = {
  // ID do cliente OAuth criado no Google Cloud (termina em .apps.googleusercontent.com)
  CLIENT_ID: '1fK79JnUBF0FnWHPxlDlTJ971DEzUqQa4-Cng11u6kvM',

  // ID da planilha: o trecho entre /d/ e /edit na URL do Google Sheets
  // ex.: https://docs.google.com/spreadsheets/d/ESTE_TRECHO_AQUI/edit
  SPREADSHEET_ID: 'COLE_AQUI_O_ID_DA_PLANILHA',
};
