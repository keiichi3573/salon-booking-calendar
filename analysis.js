/* =========================
  COMFORT 売上分析ページ
========================= */

/* ===== Supabase ===== */
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase設定が読み込めていません（config.jsを確認してください）");
}

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* ===== Utils ===== */
const pad2 = (n) => String(n).padStart(2, "0");

const toMonthKey = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

function addMonths(d, diff) {
  return new Date(
    d.getFullYear(),
    d.getMonth() + diff,
    1
  );
}

/* ===== DOM ===== */
const analysisAppShell =
  document.getElementById("analysisAppShell");

const analysisAuthMessage =
  document.getElementById("analysisAuthMessage");

const analysisMonthTitle =
  document.getElementById("analysisMonthTitle");

const analysisPrevBtn =
  document.getElementById("analysisPrevBtn");

const analysisNextBtn =
  document.getElementById("analysisNextBtn");

const backToCalendarBtn =
  document.getElementById("backToCalendarBtn");

const goToLoginBtn =
  document.getElementById("goToLoginBtn");

const analysisLogoutBtn =
  document.getElementById("analysisLogoutBtn");

const analysisStatus =
  document.getElementById("analysisStatus");

/* ===== 表示月 ===== */
function getInitialMonth() {
  const params = new URLSearchParams(location.search);
  const month = params.get("month");

  if (/^\d{4}-\d{2}$/.test(month || "")) {
    const [year, monthNumber] = month.split("-").map(Number);

    return new Date(
      year,
      monthNumber - 1,
      1
    );
  }

  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );
}

let viewDate = getInitialMonth();

/* ===== 月タイトル ===== */
function renderMonthTitle() {
  if (!analysisMonthTitle) return;

  analysisMonthTitle.textContent =
    `${viewDate.getFullYear()}年 ${viewDate.getMonth() + 1}月`;
}

/* ===== URLの月を更新 ===== */
function updateMonthUrl() {
  const monthKey = toMonthKey(viewDate);

  history.replaceState(
    null,
    "",
    `analysis.html?month=${monthKey}`
  );
}

/* ===== 分析ページ表示 ===== */
function showAnalysisPage() {
  analysisAppShell?.classList.remove("hidden");
  analysisAuthMessage?.classList.add("hidden");
  analysisLogoutBtn?.classList.remove("hidden");

  renderMonthTitle();

  if (analysisStatus) {
    analysisStatus.textContent =
      "分析ページを表示しました。次の作業でデータを読み込みます。";
  }
}

/* ===== 未ログイン表示 ===== */
function showLoginMessage() {
  analysisAppShell?.classList.add("hidden");
  analysisAuthMessage?.classList.remove("hidden");
  analysisLogoutBtn?.classList.add("hidden");
}

/* ===== ログイン確認 ===== */
async function checkLogin() {
  const {
    data: { session },
    error
  } = await sb.auth.getSession();

  if (error) {
    console.error("ログイン確認エラー:", error);
    showLoginMessage();
    return;
  }

  if (!session) {
    showLoginMessage();
    return;
  }

  showAnalysisPage();
}

/* ===== Events ===== */
backToCalendarBtn?.addEventListener("click", () => {
  const monthKey = toMonthKey(viewDate);

  window.location.href =
    `index.html?month=${monthKey}`;
});

goToLoginBtn?.addEventListener("click", () => {
  window.location.href = "index.html";
});

analysisPrevBtn?.addEventListener("click", () => {
  viewDate = addMonths(viewDate, -1);

  renderMonthTitle();
  updateMonthUrl();
});

analysisNextBtn?.addEventListener("click", () => {
  viewDate = addMonths(viewDate, 1);

  renderMonthTitle();
  updateMonthUrl();
});

analysisLogoutBtn?.addEventListener("click", async () => {
  await sb.auth.signOut();

  window.location.href = "index.html";
});

/* ===== Start ===== */
checkLogin();
