function setupHomeWiseSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const ensureSheet = (name) => ss.getSheetByName(name) || ss.insertSheet(name);
  const clearAndHeader = (sh, headers) => {
    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  };

  const columnLetter_ = (col) => {
    let temp = "";
    while (col > 0) {
      const rem = (col - 1) % 26;
      temp = String.fromCharCode(65 + rem) + temp;
      col = Math.floor((col - 1) / 26);
    }
    return temp;
  };

  const shLanc = ensureSheet("Lançamentos");
  const shPessoas = ensureSheet("Pessoas");
  const shCats = ensureSheet("Categorias");
  const shRel = ensureSheet("Relatórios");
  const shCfg = ensureSheet("Config");

  clearAndHeader(shPessoas, ["nome"]);
  const pessoas = [["Luciano"], ["Sérgio"], ["Adriana"], ["Mariana"]];
  shPessoas.getRange(2, 1, pessoas.length, 1).setValues(pessoas);
  shPessoas.autoResizeColumn(1);

  clearAndHeader(shCats, ["nome"]);
  const categorias = [["Mercado"], ["Combustível"], ["Lazer"], ["Contas"], ["Saúde"], ["Outros"]];
  shCats.getRange(2, 1, categorias.length, 1).setValues(categorias);
  shCats.autoResizeColumn(1);

  const lancHeaders = ["id", "timestamp", "pessoa", "data", "valor", "categoria", "descricao", "origem"];
  clearAndHeader(shLanc, lancHeaders);

  shLanc.getRange("B:B").setNumberFormat("yyyy-mm-dd hh:mm:ss");
  shLanc.getRange("D:D").setNumberFormat("yyyy-mm-dd");
  shLanc.getRange("E:E").setNumberFormat('"R$" #,##0.00');

  shLanc.setColumnWidth(1, 170);
  shLanc.setColumnWidth(2, 160);
  shLanc.setColumnWidth(3, 140);
  shLanc.setColumnWidth(4, 110);
  shLanc.setColumnWidth(5, 110);
  shLanc.setColumnWidth(6, 140);
  shLanc.setColumnWidth(7, 360);
  shLanc.setColumnWidth(8, 90);

  const pessoaRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(shPessoas.getRange("A2:A"), true)
    .setAllowInvalid(false)
    .build();

  const catRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(shCats.getRange("A2:A"), true)
    .setAllowInvalid(false)
    .build();

  shLanc.getRange("C2:C").setDataValidation(pessoaRule);
  shLanc.getRange("F2:F").setDataValidation(catRule);

  // =========================
  // RELATÓRIOS (RESUMO)
  // =========================
  shRel.clear();

  shRel.getRange("A1").setValue("Mês (AAAA-MM)");
  shRel.getRange("B1").setValue(Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM"));
  shRel.getRange("A1:B1").setFontWeight("bold");
  shRel.setFrozenRows(2);

  shRel.getRange("A3").setValue("Pessoa");
  shRel.getRange("B3").setValue("Total");

  shRel.getRange(3, 3, 1, categorias.length).setValues([categorias.map((c) => c[0])]);

  const colTotalGeral = 3 + categorias.length;
  shRel.getRange(3, colTotalGeral).setValue("Total geral");

  shRel.getRange(3, 1, 1, colTotalGeral).setFontWeight("bold");
  shRel.getRange(4, 1, pessoas.length, 1).setValues(pessoas);

  const formulaTotalPessoa =
    '=SEERRO(SOMASES(Lançamentos!E:E;Lançamentos!C:C;$A4;Lançamentos!D:D;">="&DATA(ESQUERDA($B$1;4);DIREITA($B$1;2);1);Lançamentos!D:D;"<"&EDATE(DATA(ESQUERDA($B$1;4);DIREITA($B$1;2);1);1));0)';

  for (let i = 0; i < pessoas.length; i++) {
    const row = 4 + i;
    shRel.getRange(row, 2).setFormula(formulaTotalPessoa.replace("$A4", `$A${row}`));
  }

  const formulaPessoaCategoria =
    '=SEERRO(SOMASES(Lançamentos!E:E;Lançamentos!C:C;$A4;Lançamentos!F:F;C$3;Lançamentos!D:D;">="&DATA(ESQUERDA($B$1;4);DIREITA($B$1;2);1);Lançamentos!D:D;"<"&EDATE(DATA(ESQUERDA($B$1;4);DIREITA($B$1;2);1);1));0)';

  for (let r = 0; r < pessoas.length; r++) {
    const row = 4 + r;
    for (let c = 0; c < categorias.length; c++) {
      const col = 3 + c;
      const colLetter = columnLetter_(col);
      shRel
        .getRange(row, col)
        .setFormula(formulaPessoaCategoria.replace("$A4", `$A${row}`).replace("C$3", `${colLetter}$3`));
    }
  }

  for (let r = 0; r < pessoas.length; r++) {
    const row = 4 + r;
    const startCol = 3;
    const endCol = 2 + categorias.length;
    shRel
      .getRange(row, colTotalGeral)
      .setFormula(`=SOMA(${columnLetter_(startCol)}${row}:${columnLetter_(endCol)}${row})`);
  }

  shRel
    .getRange(4, 2, pessoas.length, 1 + categorias.length + 1)
    .setNumberFormat('"R$" #,##0.00');

  shRel.setColumnWidth(1, 140);
  shRel.setColumnWidth(2, 120);
  for (let i = 0; i < categorias.length; i++) shRel.setColumnWidth(3 + i, 120);
  shRel.setColumnWidth(colTotalGeral, 120);

  // =========================
  // CONFIG
  // =========================
  clearAndHeader(shCfg, ["chave", "valor"]);
  shCfg.getRange("A2").setValue("app_name");
  shCfg.getRange("B2").setValue("HomeWise");
  shCfg.getRange("A3").setValue("created_at");
  shCfg.getRange("B3").setValue(new Date());
  shCfg.getRange("B3").setNumberFormat("yyyy-mm-dd hh:mm:ss");

  SpreadsheetApp.flush();
}
