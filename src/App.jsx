import { useEffect, useMemo, useState } from "react";
import {
  FiLogIn,
  FiLogOut,
  FiUser,
  FiCalendar,
  FiDollarSign,
  FiSave,
  FiShield,
  FiWifi,
  FiInfo,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiEye,
  FiEyeOff,
  FiChevronDown,
} from "react-icons/fi";

import logoHomeWise from "./assets/HomeWise.svg";

const PEOPLE = ["Luciano", "Sérgio", "Adriana", "Mariana"];
const CATEGORIES = ["Mercado", "Combustível", "Lazer", "Contas", "Saúde", "Outros"];
const LOGIN_TTL_HOURS = 8;

function formatMoneyBRL(value) {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeAmountToNumber(amount) {
  const raw = String(amount).trim();
  if (!raw) return NaN;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function normalizePin(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 6);
}

function getFriendlyApiErrorMessage(serverMessage) {
  const msg = String(serverMessage || "").trim();
  if (!msg) return "Não foi possível concluir. Tente novamente.";
  if (msg.includes("JSON inválido")) return "Erro de comunicação. Tente novamente.";
  if (msg.includes("PIN incorreto")) return "Acesso inválido. Tente novamente.";
  if (msg.includes("Pessoa não cadastrada")) return "Pessoa não cadastrada na planilha.";
  if (msg.includes("Categoria não cadastrada")) return "Categoria não cadastrada na planilha.";
  if (msg.includes("Aba Lançamentos")) return "A planilha está sem a aba Lançamentos.";
  if (msg.includes("Aba Pessoas")) return "A planilha está sem a aba Pessoas ou ela está vazia.";
  if (msg.includes("PINS não configurados")) return "A autenticação não foi configurada no script.";
  return msg;
}

function StatusBox({ status }) {
  if (!status || status.type === "idle" || status.type === "loading") return null;

  const Icon = status.type === "success" ? FiCheckCircle : FiAlertCircle;

  const cls =
    status.type === "success"
      ? "border-emerald-900/60 bg-emerald-900/20 text-emerald-200"
      : "border-red-900/60 bg-red-900/20 text-red-200";

  return (
    <div className={["rounded-2xl border px-3 py-3 text-sm leading-relaxed flex items-start gap-2", cls].join(" ")}>
      <span className="mt-0.5 shrink-0">
        <Icon />
      </span>
      <div>{status.message}</div>
    </div>
  );
}

function nowMs() {
  return Date.now();
}

function calcExpiresAtMs() {
  return nowMs() + LOGIN_TTL_HOURS * 60 * 60 * 1000;
}

function Card({ title, icon: Icon, subtitle, rightSlot, children, className = "" }) {
  return (
    <div
      className={[
        "rounded-3xl border border-emerald-900/35 bg-slate-900/25 p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.05)] sm:p-6 lg:p-8",
        className,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-200">
              <Icon />
            </span>
          ) : null}

          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl lg:text-2xl">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm leading-relaxed text-slate-400 lg:text-base">{subtitle}</p> : null}
          </div>
        </div>

        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>

      <div className="mt-5 sm:mt-6 lg:mt-7">{children}</div>
    </div>
  );
}

function Field({ label, icon: Icon, hint, rightAddon, children }) {
  return (
    <div className="grid gap-2">
      <div className="flex min-h-[1.25rem] items-center justify-between gap-3">
        <label className="text-xs font-medium text-slate-200">{label}</label>
        {rightAddon ? (
          <div className="text-xs text-slate-500 text-right">{rightAddon}</div>
        ) : (
          <div className="text-xs text-transparent select-none">.</div>
        )}
      </div>

      <div className="relative">
        {Icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon />
          </span>
        ) : null}
        {children}
      </div>

      {hint ? <div className="text-xs leading-relaxed text-slate-500">{hint}</div> : null}
    </div>
  );
}

function SelectControl({ value, onChange, options, className, disabled = false }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange} disabled={disabled} className={className}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
        <FiChevronDown />
      </span>
    </div>
  );
}

function MobileAccent() {
  return (
    <div className="sm:hidden">
      <div className="rounded-3xl border border-emerald-900/30 bg-slate-950/45 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-200">
            <FiInfo />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">HomeWise</div>
            <div className="text-xs text-slate-400">Registrar gastos ajuda a manter o controle no dia a dia</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const apiUrl = import.meta.env.VITE_HOMEWISE_API_URL;

  const [loggedPerson, setLoggedPerson] = useState(() => localStorage.getItem("homewise_person") || "");
  const [expiresAtMs, setExpiresAtMs] = useState(() => Number(localStorage.getItem("homewise_expiresAtMs") || "0"));
  const [storedPin, setStoredPin] = useState(() => localStorage.getItem("homewise_pin") || "");

  const isLoggedIn = Boolean(loggedPerson) && Boolean(storedPin) && expiresAtMs > nowMs();

  const [loginPerson, setLoginPerson] = useState(PEOPLE[0]);
  const [pin, setPin] = useState("");
  const [loginStatus, setLoginStatus] = useState({ type: "idle", message: "" });
  const [showPin, setShowPin] = useState(false);

  const date = today;
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });

  const amountNumber = useMemo(() => normalizeAmountToNumber(amount), [amount]);
  const amountPreview = Number.isFinite(amountNumber) && amountNumber > 0 ? formatMoneyBRL(amountNumber) : "—";

  useEffect(() => {
    if (loggedPerson) localStorage.setItem("homewise_person", loggedPerson);
    else localStorage.removeItem("homewise_person");
  }, [loggedPerson]);

  useEffect(() => {
    if (expiresAtMs) localStorage.setItem("homewise_expiresAtMs", String(expiresAtMs));
    else localStorage.removeItem("homewise_expiresAtMs");
  }, [expiresAtMs]);

  useEffect(() => {
    if (storedPin) localStorage.setItem("homewise_pin", storedPin);
    else localStorage.removeItem("homewise_pin");
  }, [storedPin]);

  async function safeFetchJson(payload) {
    if (!apiUrl) return { success: false, message: "API_URL não configurada no .env." };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await res.text();

      try {
        return JSON.parse(text);
      } catch {
        return { success: false, message: "Resposta da API não é JSON. Verifique o deploy do Apps Script." };
      }
    } catch (err) {
      if (String(err?.name) === "AbortError") {
        return { success: false, message: "Tempo limite de conexão. Verifique sua internet e tente novamente." };
      }
      return { success: false, message: "Falha de conexão com a API. Tente novamente." };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    if (!apiUrl) return setLoginStatus({ type: "error", message: "API_URL não configurada no .env." });
    if (!loginPerson) return setLoginStatus({ type: "error", message: "Selecione a pessoa." });

    const pinClean = normalizePin(pin);
    if (!pinClean) return setLoginStatus({ type: "error", message: "Informe o acesso." });
    if (pinClean.length < 4) return setLoginStatus({ type: "error", message: "Acesso inválido. Tente novamente." });

    setLoginStatus({ type: "loading", message: "Entrando..." });
    setStatus({ type: "idle", message: "" });

    const data = await safeFetchJson({ action: "login", person: loginPerson, pin: pinClean });

    if (!data.success) {
      setLoginStatus({ type: "error", message: getFriendlyApiErrorMessage(data.message) });
      return;
    }

    setLoggedPerson(data.person || loginPerson);
    setStoredPin(pinClean);
    setExpiresAtMs(calcExpiresAtMs());

    setPin("");
    setShowPin(false);
    setLoginStatus({ type: "success", message: "Acesso liberado." });
  }

  function handleLogout() {
    setLoggedPerson("");
    setStoredPin("");
    setExpiresAtMs(0);
    setPin("");
    setShowPin(false);
    setLoginStatus({ type: "idle", message: "" });
    setStatus({ type: "idle", message: "" });
  }

  async function handleSubmitExpense(e) {
    e.preventDefault();

    if (!apiUrl) return setStatus({ type: "error", message: "API_URL não configurada no .env." });

    if (!isLoggedIn) {
      handleLogout();
      return setStatus({ type: "error", message: "Acesso expirou. Faça login novamente." });
    }

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return setStatus({ type: "error", message: "Informe um valor válido." });
    if (!category) return setStatus({ type: "error", message: "Selecione a categoria." });

    setStatus({ type: "loading", message: "Salvando..." });

    const payload = {
      action: "create_expense",
      person: loggedPerson,
      pin: storedPin,
      date,
      amount,
      category,
      description,
      origin: "site",
    };

    const data = await safeFetchJson(payload);

    if (!data.success) {
      setStatus({ type: "error", message: getFriendlyApiErrorMessage(data.message) });
      return;
    }

    setStatus({ type: "success", message: `Gasto salvo: ${formatMoneyBRL(amountNumber)} em ${category}.` });
    setAmount("");
    setDescription("");
  }

  const remainingMs = Math.max(0, expiresAtMs - nowMs());
  const remainingMin = Math.floor(remainingMs / 60000);

  const controlWithIcon =
    "w-full h-12 lg:h-14 rounded-2xl border border-emerald-900/35 bg-slate-950/65 text-slate-100 pl-10 pr-3 text-sm lg:text-base outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20";
  const selectWithIcon =
    "w-full h-12 lg:h-14 rounded-2xl border border-emerald-900/35 bg-slate-950/65 text-slate-100 pl-10 pr-12 text-sm lg:text-base outline-none appearance-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20";
  const controlWithRightButton =
    "w-full h-12 lg:h-14 rounded-2xl border border-emerald-900/35 bg-slate-950/65 text-slate-100 pl-10 pr-12 text-sm lg:text-base outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20";
  const controlDisabled =
    "w-full h-12 lg:h-14 cursor-not-allowed rounded-2xl border border-emerald-900/25 bg-slate-950/40 pl-10 pr-3 text-sm lg:text-base text-slate-200 outline-none";
  const buttonPrimary =
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 h-12 lg:h-14 text-sm lg:text-base font-semibold text-slate-950 transition hover:bg-emerald-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70";
  const buttonGhost =
    "inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-900/35 bg-slate-950/55 px-4 h-11 lg:h-12 text-xs lg:text-sm font-semibold text-slate-200 transition hover:border-emerald-500/40 hover:bg-slate-950/75";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-48 left-1/2 h-96 w-[46rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-60 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <header className="border-b border-emerald-900/30 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:py-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logoHomeWise} alt="HomeWise" className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12 lg:h-14 lg:w-14" draggable={false} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-base font-semibold tracking-tight sm:text-lg lg:text-xl">HomeWise</div>
              <div className="truncate text-xs text-slate-400 sm:text-sm">Controle financeiro em família</div>
            </div>
          </div>

          {isLoggedIn ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-emerald-900/30 bg-slate-950/55 px-3 py-2 text-xs text-slate-300 lg:px-4 lg:py-2.5 lg:text-sm">
                <FiUser className="text-slate-400" />
                <span className="text-slate-200">{loggedPerson}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{remainingMin} min</span>
              </div>
              <button onClick={handleLogout} className={buttonGhost}>
                <FiLogOut />
                Sair
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 lg:text-sm">
              <FiShield />
              Acesso protegido
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10 lg:px-6">
        <MobileAccent />

        <div className="mt-5 grid gap-6 lg:mt-0 lg:grid-cols-12 lg:gap-8 lg:items-stretch">
          {!isLoggedIn ? (
            <>
              <section className="lg:col-span-5 flex">
                <Card title="Entrar" icon={FiLogIn} subtitle="Acesse para registrar gastos com rapidez." className="w-full">
                  <form onSubmit={handleLogin} className="grid gap-4 lg:gap-5">
                    <Field label="Pessoa" icon={FiUser}>
                      <SelectControl value={loginPerson} onChange={(e) => setLoginPerson(e.target.value)} options={PEOPLE} className={selectWithIcon} />
                    </Field>

                    <Field label="Acesso" icon={FiShield} hint="Usado apenas para validar e manter o acesso neste dispositivo.">
                      <div className="relative">
                        <input
                          type={showPin ? "text" : "password"}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="Digite aqui"
                          value={pin}
                          onChange={(e) => setPin(normalizePin(e.target.value))}
                          className={controlWithRightButton}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-xl border border-emerald-900/30 bg-slate-950/55 text-slate-200 hover:bg-slate-950/75"
                          aria-label={showPin ? "Ocultar acesso" : "Mostrar acesso"}
                        >
                          {showPin ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </Field>

                    <button type="submit" disabled={loginStatus.type === "loading"} className={buttonPrimary}>
                      {loginStatus.type === "loading" ? <FiLoader className="animate-spin" /> : <FiLogIn />}
                      {loginStatus.type === "loading" ? "Entrando..." : "Entrar"}
                    </button>

                    <StatusBox status={loginStatus} />
                  </form>
                </Card>
              </section>

              <section className="hidden lg:col-span-7 lg:flex">
                <div className="w-full rounded-3xl border border-emerald-900/30 bg-slate-900/15 p-10 shadow-[0_0_0_1px_rgba(16,185,129,0.05)] flex">
                  <div className="flex w-full flex-col justify-between gap-10">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-900/30 bg-slate-950/55 px-4 py-2 text-sm text-slate-300">
                        <FiShield className="text-emerald-200" />
                        Disciplina financeira
                      </div>

                      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-100">
                        Cuidado com pequenas despesas; um pequeno vazamento afundará um grande navio.
                      </h1>

                      <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-400">Benjamin Franklin</p>

                      <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-500">
                        Pequenos gastos se acumulam. Registrar o que sai ajuda a manter clareza e controle.
                      </p>
                    </div>

                    <div className="rounded-3xl border border-emerald-900/25 bg-slate-950/40 p-6">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <FiInfo className="text-slate-400" />
                        Use este app como um hábito rápido: anotar agora evita esquecer depois.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="lg:col-span-7 flex">
                <Card
                  title="Novo gasto"
                  icon={FiSave}
                  subtitle={`Logado como ${loggedPerson}. Ao salvar, vai direto para a planilha.`}
                  className="w-full"
                  rightSlot={
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-900/30 bg-slate-950/55 px-3 py-2 lg:px-4 lg:py-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-200">
                        <FiWifi />
                      </span>
                      <span className="text-xs text-slate-300 lg:text-sm">Conectado</span>
                    </div>
                  }
                >
                  <form onSubmit={handleSubmitExpense} className="grid gap-6 lg:gap-8">
                    <div className="grid gap-6 sm:grid-cols-2 lg:gap-10">
                      <Field label="Data" icon={FiCalendar} hint="Lançamento registrado com a data de hoje.">
                        <input type="text" value={date} readOnly className={controlDisabled} />
                      </Field>

                      <Field label="Categoria">
                        <SelectControl value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORIES} className={selectWithIcon} />
                      </Field>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:gap-10">
                      <Field
                        label="Valor"
                        icon={FiDollarSign}
                        rightAddon={
                          <span>
                            Prévia: <span className="text-emerald-200">{amountPreview}</span>
                          </span>
                        }
                      >
                        <input
                          inputMode="decimal"
                          placeholder="0,00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className={controlWithIcon}
                        />
                      </Field>

                      <Field label="Descrição (opcional)">
                        <input
                          placeholder="Ex: padaria, farmácia"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className={controlWithIcon}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[auto,1fr] sm:items-center sm:gap-4">
                      <button type="submit" disabled={status.type === "loading"} className={buttonPrimary + " w-full sm:w-auto"}>
                        {status.type === "loading" ? <FiLoader className="animate-spin" /> : <FiSave />}
                        {status.type === "loading" ? "Salvando..." : "Salvar gasto"}
                      </button>

                      <div className="inline-flex items-center justify-center sm:justify-end gap-2 text-xs text-slate-500 lg:text-sm">
                        <FiInfo />
                        Acesso ativo neste dispositivo
                      </div>
                    </div>

                    <StatusBox status={status} />
                  </form>
                </Card>
              </section>

              <section className="hidden lg:col-span-5 lg:flex">
                <div className="w-full rounded-3xl border border-emerald-900/30 bg-slate-900/15 p-8 shadow-[0_0_0_1px_rgba(16,185,129,0.05)] flex flex-col">
                  <div className="flex flex-col gap-6 flex-1">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-900/30 bg-slate-950/55 px-4 py-2 text-sm text-slate-300">
                        <FiWifi className="text-emerald-200" />
                        Visão do app
                      </div>

                      <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-100">Tudo pronto para registrar com consistência</h3>

                      <p className="mt-2 text-base leading-relaxed text-slate-400">
                        Use este painel como conferência rápida: usuário, tempo de sessão e ações essenciais no mesmo lugar.
                      </p>

                      <div className="mt-6 grid gap-4">
                        <div className="rounded-3xl border border-emerald-900/30 bg-slate-950/45 p-5">
                          <div className="flex items-center gap-3">
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-200">
                              <FiUser />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-slate-100">Usuário</div>
                              <div className="text-sm text-slate-400">{loggedPerson}</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-emerald-900/30 bg-slate-950/45 p-5">
                          <div className="flex items-center gap-3">
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-200">
                              <FiShield />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-slate-100">Sessão</div>
                              <div className="text-sm text-slate-400">Expira em {remainingMin} min</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <button onClick={handleLogout} className={buttonGhost + " w-full"}>
                        <FiLogOut />
                        Encerrar acesso
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="mt-8 border-t border-emerald-900/25 py-6 text-center text-xs text-slate-500 lg:mt-12">
          HomeWise • by Luciano K.
        </footer>
      </main>
    </div>
  );
}
