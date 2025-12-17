const HOMEWISE = {
  SHEET_LANC: "Lançamentos",
  SHEET_PESSOAS: "Pessoas",
  SHEET_CATS: "Categorias",
  TZ: "America/Sao_Paulo",
};

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeText_(s) {
  return String(s ?? "").trim();
}

function normalizePin_(s) {
  return String(s ?? "").replace(/\D/g, "").slice(0, 6);
}

function normalizeMoneyToNumber_(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return NaN;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function isValidISODate_(yyyyMmDd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return false;
  const d = new Date(yyyyMmDd + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

function getAllowedSet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return new Set();
  const values = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
  return new Set(values.map((r) => String(r[0]).trim()).filter(Boolean));
}

function nextId_() {
  const stamp = Utilities.formatDate(new Date(), HOMEWISE.TZ, "yyyyMMdd-HHmmss");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `HW-${stamp}-${rand}`;
}

function getPins_() {
  const raw = PropertiesService.getScriptProperties().getProperty("HOMEWISE_PINS_JSON");
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

function validatePersonAndPin_(person, pin) {
  const p = normalizeText_(person);
  const cleanPin = normalizePin_(pin);

  if (!p) return { ok: false, message: "Pessoa é obrigatória." };
  if (!cleanPin || cleanPin.length !== 6) return { ok: false, message: "PIN inválido. Use 6 dígitos." };

  const allowedPeople = getAllowedSet_(HOMEWISE.SHEET_PESSOAS);
  if (!allowedPeople.size) return { ok: false, message: "Aba Pessoas não encontrada ou vazia." };
  if (!allowedPeople.has(p)) return { ok: false, message: "Pessoa não cadastrada." };

  const pins = getPins_();
  if (!pins) return { ok: false, message: "PINS não configurados. Verifique HOMEWISE_PINS_JSON." };

  const expected = String(pins[p] ?? "");
  if (!expected) return { ok: false, message: "PIN não configurado para esta pessoa." };
  if (expected !== cleanPin) return { ok: false, message: "PIN incorreto." };

  return { ok: true, person: p };
}

function doGet() {
  return json_({
    ok: true,
    name: "HomeWise API",
    routes: [
      "POST / { action: 'login', person, pin }",
      "POST / { action: 'create_expense', person, pin, date, amount, category, description, origin }",
    ],
    time: Utilities.formatDate(new Date(), HOMEWISE.TZ, "yyyy-MM-dd HH:mm:ss"),
  });
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? e.postData.contents : "";
    if (!body) return json_({ success: false, message: "Body vazio." });

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return json_({ success: false, message: "JSON inválido." });
    }

    const action = normalizeText_(data.action);
    if (!action) return json_({ success: false, message: "Ação ausente." });

    if (action === "login") return handleLogin_(data);
    if (action === "create_expense") return handleCreateExpense_(data);

    return json_({ success: false, message: "Ação desconhecida." });
  } catch (err) {
    return json_({ success: false, message: "Erro interno.", details: String(err?.message || err) });
  }
}

function handleLogin_(data) {
  const check = validatePersonAndPin_(data.person, data.pin);
  if (!check.ok) return json_({ success: false, message: check.message });

  return json_({
    success: true,
    message: "Login realizado.",
    person: check.person,
  });
}

function handleCreateExpense_(data) {
  const check = validatePersonAndPin_(data.person, data.pin);
  if (!check.ok) return json_({ success: false, message: check.message });

  const pessoa = check.person;
  const dataGasto = normalizeText_(data.date);
  const categoria = normalizeText_(data.category);
  const descricao = normalizeText_(data.description);
  const origem = normalizeText_(data.origin) || "site";
  const valorNum = normalizeMoneyToNumber_(data.amount);

  if (!dataGasto || !isValidISODate_(dataGasto)) return json_({ success: false, message: "Data inválida." });
  if (!Number.isFinite(valorNum) || valorNum <= 0) return json_({ success: false, message: "Valor inválido." });
  if (!categoria) return json_({ success: false, message: "Categoria é obrigatória." });

  const allowedCats = getAllowedSet_(HOMEWISE.SHEET_CATS);
  if (!allowedCats.size) return json_({ success: false, message: "Aba Categorias não encontrada ou vazia." });
  if (!allowedCats.has(categoria)) return json_({ success: false, message: "Categoria não cadastrada." });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(HOMEWISE.SHEET_LANC);
  if (!sh) return json_({ success: false, message: "Aba Lançamentos não encontrada." });

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(8000);
  if (!gotLock) return json_({ success: false, message: "Sistema ocupado. Tente novamente." });

  try {
    const id = nextId_();
    const now = new Date();

    sh.appendRow([id, now, pessoa, dataGasto, valorNum, categoria, descricao, origem]);

    return json_({
      success: true,
      message: "Gasto salvo com sucesso.",
      id,
      saved: { person: pessoa, date: dataGasto, amount: valorNum, category: categoria, description: descricao },
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
