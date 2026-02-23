// ===== Modal focus fix (minimal) =====
let __lastFocusedEl = null;

function openModal(modalEl) {
  const modal = modalEl; // DOM要素が渡ってくる前提
  if (!modal) return;

  const card = modal.querySelector('.modalCard');
  __lastFocusedEl = document.activeElement;

  // 表示
  modal.classList.remove('hidden');

  // aria-hidden は card 側で管理（あなたのHTMLに合わせる）
  if (card) card.setAttribute('aria-hidden', 'false');

  // モーダル内へフォーカス移動（最初の入力/ボタンへ）
  const focusTarget = modal.querySelector(
    '[autofocus], input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
  );
  (focusTarget || card || modal).focus?.();
}

function closeModal(modalEl) {
  const modal = modalEl; // DOM要素が渡ってくる前提
  if (!modal) return;

  const card = modal.querySelector('.modalCard');

  // ★ここが aria-hidden 警告を止める核心：先にフォーカスを外へ戻す
  if (__lastFocusedEl && typeof __lastFocusedEl.focus === 'function') {
    __lastFocusedEl.focus();
  } else {
    document.body.focus?.();
  }

  // その後に aria-hidden / 非表示
  if (card) card.setAttribute('aria-hidden', 'true');
  modal.classList.add('hidden');
}

/* =========================
   サロン予約カレンダー（クラウド同期・リセット版）
   - 月カレンダー：日付ごと「合計予約数」だけ表示（0〜20）
   - 入力：合計予約数を大きく、メモは小さく
   - 設定：PIN(初期4043)でスタッフ管理（追加/並び替え/有効無効）＋PIN変更
   - 定休日：毎週月曜 + 第1火曜 + 第3火曜
   - Supabase: staffs / bookings
========================= */

// ここはあなたの値に置き換え済みでOK
const SUPABASE_URL = "https://ujfgmuhwmaauioeueyep.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8xbjrHfOxAzaidTzX7S6fA_mxEE0pFD";

// ★ supabaseという名前は使わない
const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// ===== 設定 =====
const MAX_COUNT = 20;
const DEFAULT_PIN = "4043";
const KEY_LOCAL_PIN = "salon_pin_v1"; // PINはローカルにも保持（バックアップ）
const DEFAULT_STAFFS = [
  { id: crypto.randomUUID(), name: "スタッフA", sort: 1, active: true },
  { id: crypto.randomUUID(), name: "スタッフB", sort: 2, active: true },
];

// ===== DOM =====
const elMonthTitle = document.getElementById("monthTitle");
const elCalendar   = document.getElementById("calendar");
const btnPrev      = document.getElementById("prevBtn");
const btnNext      = document.getElementById("nextBtn");
const btnExport    = document.getElementById("exportCsvBtn");
const btnSettings  = document.getElementById("settingsBtn");

// day modal
const dayModal      = document.getElementById("dayModal");
const dayCloseBtn   = document.getElementById("dayCloseBtn");
const daySaveBtn    = document.getElementById("daySaveBtn");
const dayTitle      = document.getElementById("dayModalTitle");
const totalSelect   = document.getElementById("totalCountSelect");
const salesInput    = document.getElementById("salesInput");
const techSalesInput        = document.getElementById("techSalesInput");
const retailSalesInput      = document.getElementById("retailSalesInput");
const newCustomersSelect    = document.getElementById("newCustomersSelect");
const repeatCustomersSelect = document.getElementById("repeatCustomersSelect");
// settings modal
const settingsModal = document.getElementById("settingsModal");
const settingsCloseBtn  = document.getElementById("settingsCloseBtn");
const settingsCloseBtn2 = document.getElementById("settingsCloseBtn2");
const pinInput      = document.getElementById("pinInput");
const pinEnterBtn   = document.getElementById("pinEnterBtn");
const settingsArea  = document.getElementById("settingsArea");
const staffNameInput= document.getElementById("staffNameInput");
const staffAddBtn   = document.getElementById("staffAddBtn");
const staffList     = document.getElementById("staffList");
const newPinInput   = document.getElementById("newPinInput");
const pinChangeBtn  = document.getElementById("pinChangeBtn");
// goal modal
const goalEditBtn    = document.getElementById("goalEditBtn");
const goalModal      = document.getElementById("goalModal");
const goalCloseBtn   = document.getElementById("goalCloseBtn");
const goalSaveBtn    = document.getElementById("goalSaveBtn");
const goalSalesInput = document.getElementById("goalSalesInput");
// ▼ここに追記（追加DOM）
const totalCountDisplay = document.getElementById("totalCountDisplay");


// ===== Modal open / close events =====
goalEditBtn?.addEventListener("click", () => {
  if (goalSalesInput) goalSalesInput.value = String(goalSales || 0);
  openModal(goalModal);
});

goalCloseBtn?.addEventListener("click", () => closeModal(goalModal));

goalSaveBtn?.addEventListener("click", async () => {
  try{
    const v = Number(goalSalesInput?.value || 0);
    const saved = await saveGoalSales(currentMonthKey, v, "pc");
    goalSales = saved;

    closeModal(goalModal);
    await loadAndRender();
    alert("目標を保存しました");
  }catch(e){
    console.error(e);
    alert("目標の保存で止まりました: " + (e?.message || e));
  }
});

// 設定モーダルを開く
btnSettings?.addEventListener('click', () => {
  openModal(settingsModal);
});

// 日付モーダルを閉じる（×）
dayCloseBtn?.addEventListener('click', () => {
  closeModal(dayModal);
});

// 設定モーダルを閉じる（× / 下の閉じる）
settingsCloseBtn?.addEventListener('click', () => {
  closeModal(settingsModal);
});
settingsCloseBtn2?.addEventListener('click', () => {
  closeModal(settingsModal);
});

// 背景クリックで閉じる（安全・汎用）
document.querySelectorAll('.modalBackdrop[data-close]').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    // 背景そのものをクリックしたときだけ閉じる
    if (e.target !== e.currentTarget) return;

    const id = e.currentTarget.getAttribute('data-close');
    const modal = document.getElementById(id);
    if (modal) closeModal(modal);
  });
});


// ===== state =====
let goalSales = 1500000; // 初期値（Supabaseから読めたら上書き）
let viewDate = new Date();
let currentMonthKey = ""; // YYYY-MM
let monthData = {};       // { "YYYY-MM-DD": {count, memo} }
let staffs = [];
let pinOk = false;

// ===== util =====
const pad2 = (n)=> String(n).padStart(2,"0");
const toMonthKey = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
const toDateKey  = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const fromDateKey = (s)=>{
  const [y,m,dd] = s.split("-").map(Number);
  return new Date(y, m-1, dd);
};

// ★ここに追加（fromDateKey の直後）
function ensureViewDate(){
  if (!(viewDate instanceof Date) || isNaN(viewDate.getTime())) {
    console.warn("[fix] viewDate invalid -> reset", viewDate);
    viewDate = new Date();
  }
}

function updateRings(sumSales, unitPrice, goalSalesValue){
  const GOAL_UNIT_PRICE = 7500;
  const GOAL_SALES = Math.max(0, Math.floor(Number(goalSalesValue || 0)));

  // URLテスト（?test=92）
  const p = new URLSearchParams(location.search);
  const n = Number(p.get("test"));
  const overridePct = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.floor(n))) : null;

  const pctSalesRaw = GOAL_SALES > 0 ? Math.floor((sumSales / GOAL_SALES) * 100) : 0;
  const pctSalesRing = Math.max(0, Math.min(100, pctSalesRaw));

  const pctUnitRaw = GOAL_UNIT_PRICE > 0 ? Math.floor((unitPrice / GOAL_UNIT_PRICE) * 100) : 0;
  const pctUnitRing = Math.max(0, Math.min(100, pctUnitRaw));

  let el = document.getElementById("mSalesPct");
  if (el) el.textContent = pctSalesRaw + "%";
  el = document.getElementById("mUnitPct");
  if (el) el.textContent = pctUnitRaw + "%";

  const vSales = (overridePct ?? pctSalesRing);
  const vUnit  = (overridePct ?? pctUnitRing);

  const salesRing = document.getElementById("mSalesRing");
  if (salesRing){
    salesRing.style.setProperty("--pct", String(vSales));
    salesRing.style.setProperty("--pctCut", String(Math.min(90, vSales)));
  }

  const unitRing = document.getElementById("mUnitRing");
  if (unitRing){
    unitRing.style.setProperty("--pct", String(vUnit));
    unitRing.style.setProperty("--pctCut", String(Math.min(90, vUnit)));
  }
}
function isStoreLikeDevice(){
  const p = new URLSearchParams(location.search);

  // ★PCでも確認できる強制フラグ
  if (p.get("ui") === "store") return true;
  if (p.get("ui") === "pc") return false;

  // 通常の自動判定（iPad/タブレット寄り）
  return window.matchMedia("(pointer: coarse) and (max-width: 1024px)").matches;
}
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function fmtYen(n){
  const v = Math.max(0, Math.floor(Number(n||0)));
  return v.toLocaleString("ja-JP") + "円";
}
function fmtNum(n){
  const v = Math.max(0, Math.floor(Number(n||0)));
  return v.toLocaleString("ja-JP");
}
function remainingDaysInViewedMonth(viewDate){
  const now = new Date();
  const sameMonth = (now.getFullYear() === viewDate.getFullYear()) && (now.getMonth() === viewDate.getMonth());
  if (!sameMonth) return 0;
  const last = endOfMonth(viewDate).getDate();
  const today = now.getDate();
  return Math.max(0, last - today + 1); // 今日含む
}

function addMonths(d, diff){ return new Date(d.getFullYear(), d.getMonth()+diff, 1); }

const WEEK = ["日","月","火","水","木","金","土"];

function isClosedDay(date){
  const dow = date.getDay();
  if (dow === 1) return true; // 月曜

  // 第1火曜 / 第3火曜
  if (dow === 2){
    const day = date.getDate();
    const weekIndex = Math.floor((day-1)/7) + 1; // 1〜
    if (weekIndex === 1 || weekIndex === 3) return true;
  }
  return false;
}
// 次回営業日（今日の翌日〜）を返す。見つからなければ null
function getNextBusinessDay(baseDate){
  // baseDate が壊れてても必ず Date にする
  const d0 = (baseDate instanceof Date && !isNaN(baseDate.getTime()))
    ? baseDate
    : new Date();

  // その日の 00:00 に揃える
  const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());

  // 明日から最大40日探す（定休日ルールを回避できない月があっても落ちない）
  for(let i=0; i<40; i++){
    d.setDate(d.getDate() + 1);
    if (!isClosedDay(d)) return d;
  }

  // 万一見つからなくても null を返さない
  return d0;
}
// ===== 営業日数（その月の営業日）=====
function businessDaysInMonth(viewDate){
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const last = endOfMonth(viewDate).getDate();
  let count = 0;
  for(let d=1; d<=last; d++){
    const dt = new Date(y, m, d);
    if (!isClosedDay(dt)) count++;
  }
  return count;
}

// ===== 営業日割の「1日目標売上」=====
function dailyGoalSalesByBusinessDays(viewDate, goalSales){
  const bd = businessDaysInMonth(viewDate);
  if (!bd) return 0;
  return Math.ceil(Number(goalSales || 0) / bd);
}

/*
 // ===== モーダル内：今日のモチベ表示を描画 =====
 function renderBoostPanel(){
   ...
 }
*/
// ===== 営業日カウント（定休日ルールは isClosedDay を使う） =====
function isBusinessDay(d){
  // 営業日 = 定休日ではない日
  return !isClosedDay(d);
}

// その月の営業日総数
function businessDaysInMonth(viewDate){
  const first = startOfMonth(viewDate);
  const last  = endOfMonth(viewDate);
  let count = 0;

  for(let day=1; day<=last.getDate(); day++){
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    if(isBusinessDay(d)) count++;
  }
  return count;
}

// 今日までの営業日数（今月のみ・今日が営業日なら今日を含む）
function businessDaysElapsedInMonth(viewDate){
  const now = new Date();

  const sameMonth =
    (now.getFullYear() === viewDate.getFullYear()) &&
    (now.getMonth() === viewDate.getMonth());

  if (!sameMonth) return 0;

  const first = startOfMonth(viewDate);
  const today = now.getDate();
  let count = 0;

  for(let day=1; day<=today; day++){
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    if(isBusinessDay(d)) count++;
  }
  return count;
}

// その月の「残り営業日数」を返す（定休日除外）
// startFromTomorrow = false → 今日を含めて数える
// startFromTomorrow = true  → 明日から数える（今日を含めない）
function remainingBusinessDaysInViewedMonth(viewDate, startFromTomorrow = false){
  const now = new Date();

  const sameMonth =
    (now.getFullYear() === viewDate.getFullYear()) &&
    (now.getMonth() === viewDate.getMonth());

  // 今月以外はペース計算しない（0扱い）
  if (!sameMonth) return 0;

  const lastDate = endOfMonth(viewDate).getDate();
  const startDay = startFromTomorrow ? (now.getDate() + 1) : now.getDate();

  let count = 0;
  for (let day = startDay; day <= lastDate; day++){
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (!isClosedDay(d)) count++;
  }
  return count;
}


// ===== 営業日カウント（isClosedDay を使う）=====
function isBusinessDay(date){
  // 休みでなければ営業日
  return !isClosedDay(date);
}

// 対象月の営業日数（1日〜月末）
function businessDaysInMonth(viewDate){
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);
  let count = 0;

  for(let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)){
    if (isBusinessDay(d)) count++;
  }
  return count;
}

// “今日まで”の営業日数（今月のときだけ、今日を含む）
function elapsedBusinessDaysInViewedMonth(viewDate){
  const now = new Date();
  const sameMonth = (now.getFullYear() === viewDate.getFullYear()) && (now.getMonth() === viewDate.getMonth());
  if (!sameMonth) return 0;

  const first = startOfMonth(viewDate);

  // 今日（00:00）に揃える
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let count = 0;

  for(let d = new Date(first); d <= today; d.setDate(d.getDate() + 1)){
    if (isBusinessDay(d)) count++;
  }
  return count;
}



// ===== Supabase helpers =====
async function loadGoalSales(monthKey){
  const res = await sb
    .from("goals_monthly")
    .select("goal_sales")
    .eq("month_key", monthKey)
    .maybeSingle();

  if (res.error) {
    console.warn("goals_monthly load error:", res.error);
    return null;
  }
  return res.data?.goal_sales ?? null;
}

async function saveGoalSales(monthKey, value, updatedBy){
  const v = Math.max(0, Math.floor(Number(value || 0)));
  const res = await sb
    .from("goals_monthly")
    .upsert([{
      month_key: monthKey,
      goal_sales: v,
      updated_by: updatedBy || "pc"
    }], { onConflict: "month_key" });

  if (res.error) throw res.error;
  return v;
}
async function ensureTablesExistHint(){
  // テーブルが無いと以降が失敗するので、エラーを見やすくする
}

async function loadPin(){
  // PINは Supabaseに置いてもいいが、今回は簡単にローカル保持（将来移行可）
  return localStorage.getItem(KEY_LOCAL_PIN) || DEFAULT_PIN;
}
async function savePin(newPin){
  localStorage.setItem(KEY_LOCAL_PIN, newPin);
}

async function loadStaffs(){
  const { data, error } = await sb.from("staffs")
    .select("*")
    .order("sort", { ascending:true });

  if(error){
    console.warn("staffs load error:", error);
    // 初回はテーブルが空の想定 → 0件なら初期投入を試す
    return [];
  }
  return data || [];
}

async function upsertStaff(row){
  const { error } = await sb.from("staffs").upsert(row);
  if(error) throw error;
}
async function updateStaff(id, patch){
  const { error } = await sb.from("staffs").update(patch).eq("id", id);
  if(error) throw error;
}

async function loadMonthData(monthKey){
  const { data, error } = await sb.from("bookings")
    .select("month_key, data")
    .eq("month_key", monthKey)
    .maybeSingle();

  if(error){
    console.warn("bookings load error:", error);
    return {};
  }
  return (data && data.data) ? data.data : {};
}

async function saveMonthData(monthKey, dataObj){
  const payload = { month_key: monthKey, data: dataObj, updated_at: new Date().toISOString() };
  const { error } = await sb.from("bookings").upsert(payload);
  if(error) throw error;
}
function fillSelect(){
  if(!totalSelect) return;
  totalSelect.innerHTML = "";
  for(let i=0;i<=MAX_COUNT;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    totalSelect.appendChild(opt);
  }
}

// ===== render =====
function renderMonth(){
  // ===== mobile は別描画（確認のみ）=====
  const isMobile = window.matchMedia("(max-width: 520px)").matches;
  if (isMobile){
    renderMonthMobile();
    return;
  }

  const first = startOfMonth(viewDate);
  const last  = endOfMonth(viewDate);

  currentMonthKey = toMonthKey(first);
  elMonthTitle.textContent = `${first.getFullYear()}年 ${first.getMonth()+1}月`;

  elCalendar.innerHTML = "";

  // 曜日ヘッダー
  for(let i=0;i<7;i++){
    const h = document.createElement("div");
    h.className = "weekHeader";
    h.textContent = WEEK[i];
    elCalendar.appendChild(h);
  }

  // 1日が何曜日か
  const startDow = first.getDay();

  // 空白セル
  for(let i=0;i<startDow;i++){
    const blank = document.createElement("div");
    blank.style.visibility = "hidden";
    elCalendar.appendChild(blank);
  }

  // 日付セル
  for(let day=1; day<=last.getDate(); day++){
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    const key = toDateKey(d);
    const info = monthData[key] || { count: 0, memo: "" };

    const cell = document.createElement("div");
    cell.className = "dayCell";
    if(isClosedDay(d)) cell.classList.add("closed");

    const top = document.createElement("div");
    top.className = "dayTop";

    const num = document.createElement("div");
    num.className = "dayNum";
    num.textContent = day;

    const badge = document.createElement("div");
    badge.className = "badge reserveBadge";
    badge.textContent = `予${Number(info.count || 0)}`;

    top.appendChild(num);
    top.appendChild(badge);

    if((info.memo||"").trim().length>0){
      const note = document.createElement("div");
      note.className = "badge note";
      note.textContent = "📝";
      top.appendChild(note);
    }

    cell.appendChild(top);
// 売上（合計）を小さく表示（0は表示しない運用）
const salesVal = Number(info.sales || 0);
if (salesVal > 0) {
  const salesEl = document.createElement("div");
  salesEl.className = "daySales";
  salesEl.textContent = salesVal.toLocaleString("ja-JP");
  cell.appendChild(salesEl);
}

    cell.addEventListener("click", ()=>{
      openDayEditor(d);
    });

    elCalendar.appendChild(cell);
  }
}
function renderMonthMobile(){
  const first = startOfMonth(viewDate);
  const last  = endOfMonth(viewDate);

  currentMonthKey = toMonthKey(first);
  elMonthTitle.textContent = `${first.getFullYear()}年 ${first.getMonth()+1}月`;

  // スマホ用クラスに切り替え
  elCalendar.classList.add("mobileList");
  elCalendar.innerHTML = "";

  // 今日〜月末を「一覧」で出す（確認のみ）
  const now = new Date();
  const sameMonth = (now.getFullYear() === first.getFullYear()) && (now.getMonth() === first.getMonth());
  const startDay = sameMonth ? now.getDate() : 1;

  for(let day=startDay; day<=last.getDate(); day++){
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    const key = toDateKey(d);
    const info = monthData[key] || { count: 0, memo: "" };

    const row = document.createElement("div");
    row.className = "mDayRow";
    if (isClosedDay(d)) row.classList.add("closed");

    const left = document.createElement("div");
    left.className = "mDayLeft";
    left.textContent = `${d.getMonth()+1}/${d.getDate()}（${WEEK[d.getDay()]}）`;

    const right = document.createElement("div");
    right.className = "mDayRight";

    const badge = document.createElement("div");
    badge.className = "mBadge";
    badge.textContent = `予${Number(info.count || 0)}`;

    right.appendChild(badge);

    // スマホは確認のみ：クリック無効（開かない）
    row.appendChild(left);
    row.appendChild(right);

    elCalendar.appendChild(row);
  }
}

function fillCountSelect(el){
  if(!el) return;
  el.innerHTML = "";
  for(let i=0;i<=MAX_COUNT;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    el.appendChild(opt);
  }
}

// ===== day editor =====
let editingDateKey = null;

async function openDayEditor(date){
  editingDateKey = toDateKey(date);

  dayTitle.textContent =
    `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日（${WEEK[date.getDay()]}）`;

  // 店舗(iPad)では売上欄を隠す（PCは表示）
const storeMode = isStoreLikeDevice();
const salesEl = document.getElementById("salesSection");
if (salesEl) salesEl.style.display = storeMode ? "none" : "";
  // スタッフ一覧（active=true）
  const { data: staffRows, error: eStaff } = await sb
    .from("staffs")
    .select("id,name,sort_order")
    .eq("active", true)
    .order("sort_order");

  if (eStaff){ alert("staffs取得エラー: " + eStaff.message); return; }

  // その日のスタッフ別予約数
  const { data: dailyStaff, error: eRows } = await sb
    .from("bookings_staff_daily")
    .select("staff_id,count")
    .eq("day", editingDateKey);

  if (eRows){ alert("staff別取得エラー: " + eRows.message); return; }

  const staffCountMap = new Map((dailyStaff||[]).map(r => [r.staff_id, Number(r.count||0)]));

  // その日の売上/客数（bookings_daily）
  const { data: daily, error: eDaily } = await sb
    .from("bookings_daily")
    .select("total,tech_sales,retail_sales,new_customers,repeat_customers")
    .eq("day", editingDateKey)
    .maybeSingle();

  if (eDaily){ alert("daily取得エラー: " + eDaily.message); return; }

  // カード描画
  const box = document.getElementById("staffInputs");
  box.innerHTML = "";

  const maxTotal = MAX_COUNT; // 合計上限（20）
  const getTotal = () => {
    let t = 0;
    for (const s of (staffRows||[])) t += Number(staffCountMap.get(s.id) || 0);
    return t;
  };

  const renderTotal = () => {
    const t = getTotal();
    if (totalSelect) totalSelect.value = String(t);
    if (totalCountDisplay) totalCountDisplay.textContent = String(t);
  };

  const makeCard = (s) => {
    const current = Number(staffCountMap.get(s.id) || 0);

    const card = document.createElement("div");
    card.className = "staffCard";
    card.dataset.staff = String(s.id);

    const top = document.createElement("div");
    top.className = "staffCardTop";

    const name = document.createElement("div");
    name.className = "staffCardName";
    name.textContent = s.name;

    const smallCount = document.createElement("div");
    smallCount.className = "staffCardCount";
    smallCount.textContent = String(current);

    top.appendChild(name);
    top.appendChild(smallCount);

    const stepper = document.createElement("div");
    stepper.className = "stepper";

    const btnMinus = document.createElement("button");
    btnMinus.type = "button";
    btnMinus.className = "stepBtn";
    btnMinus.textContent = "−";

    const val = document.createElement("div");
    val.className = "stepValue";
    val.textContent = String(current);

    const btnPlus = document.createElement("button");
    btnPlus.type = "button";
    btnPlus.className = "stepBtn";
    btnPlus.textContent = "＋";

    const syncButtons = () => {
      const v = Number(staffCountMap.get(s.id) || 0);
      const total = getTotal();
      btnMinus.disabled = (v <= 0);
      // 合計上限に達している時は＋を止める（そのスタッフが増やす場合）
      btnPlus.disabled = (total >= maxTotal);
      smallCount.textContent = String(v);
      val.textContent = String(v);
      renderTotal();
    };

    btnMinus.addEventListener("click", () => {
      const v = Number(staffCountMap.get(s.id) || 0);
      staffCountMap.set(s.id, Math.max(0, v - 1));
      syncButtons();
    });

    btnPlus.addEventListener("click", () => {
      const total = getTotal();
      if (total >= maxTotal) return;
      const v = Number(staffCountMap.get(s.id) || 0);
      staffCountMap.set(s.id, Math.min(MAX_COUNT, v + 1));
      syncButtons();
    });

    stepper.appendChild(btnMinus);
    stepper.appendChild(val);
    stepper.appendChild(btnPlus);

    card.appendChild(top);
    card.appendChild(stepper);

    // 初期状態
    syncButtons();
    return card;
  };

  (staffRows||[]).forEach(s => box.appendChild(makeCard(s)));
  renderTotal();

  // PCのみ：売上/客数を反映（iPadは非表示なので値は入れてもOK）
  fillCountSelect(newCustomersSelect);
  fillCountSelect(repeatCustomersSelect);

  if (techSalesInput)        techSalesInput.value = String(Number(daily?.tech_sales || 0));
  if (retailSalesInput)      retailSalesInput.value = String(Number(daily?.retail_sales || 0));
  if (newCustomersSelect)    newCustomersSelect.value = String(Number(daily?.new_customers || 0));
  if (repeatCustomersSelect) repeatCustomersSelect.value = String(Number(daily?.repeat_customers || 0));

  openModal(dayModal);
}

async function saveDay(){
  try{
    if(!editingDateKey){
      alert("保存できません：日付が選択されていません");
      return;
    }

    daySaveBtn.disabled = true;
    daySaveBtn.textContent = "保存中...";

    const storeMode = isStoreLikeDevice();

    // --- スタッフ別予約数を集計 ---
    const cards = document.querySelectorAll("#staffInputs .staffCard[data-staff]");
    let total = 0;

    const rows = Array.from(cards).map(card=>{
      const staff_id = card.dataset.staff;
      const v = Number(card.querySelector(".stepValue")?.textContent || 0);
      total += v;
      return {
        day: editingDateKey,
        staff_id,
        count: v,
        updated_by: storeMode ? "ipad" : "pc"
      };
    });

    // 1) bookings_staff_daily を保存
    const r1 = await sb
      .from("bookings_staff_daily")
      .upsert(rows, { onConflict: "day,staff_id" });

    if (r1.error) throw new Error("スタッフ別保存失敗: " + r1.error.message);

    // 2) bookings_daily を保存
    if (storeMode){
      // iPad：予約（total）だけ更新。売上/客数は上書きしない。
      const exists = await sb
        .from("bookings_daily")
        .select("day")
        .eq("day", editingDateKey)
        .maybeSingle();

      if (exists.error) throw new Error("daily存在確認失敗: " + exists.error.message);

      if (exists.data){
        const u = await sb
          .from("bookings_daily")
          .update({ total, updated_by: "ipad" })
          .eq("day", editingDateKey);

        if (u.error) throw new Error("daily更新失敗: " + u.error.message);
      } else {
        // 初回だけ最低限で作成（売上等は0でOK）
        const ins = await sb
          .from("bookings_daily")
          .insert([{
            day: editingDateKey,
            total,
            tech_sales: 0,
            retail_sales: 0,
            new_customers: 0,
            repeat_customers: 0,
            updated_by: "ipad"
          }]);
        if (ins.error) throw new Error("daily作成失敗: " + ins.error.message);
      }
    } else {
      // PC：売上/客数も保存
      const techSales = Number(techSalesInput?.value || 0);
      const retailSales = Number(retailSalesInput?.value || 0);
      const newCus = Number(newCustomersSelect?.value || 0);
      const repeatCus = Number(repeatCustomersSelect?.value || 0);

      const r2 = await sb
        .from("bookings_daily")
        .upsert([{
          day: editingDateKey,
          total,
          tech_sales: techSales,
          retail_sales: retailSales,
          new_customers: newCus,
          repeat_customers: repeatCus,
          updated_by: "pc"
        }], { onConflict: "day" });

      if (r2.error) throw new Error("daily保存失敗: " + r2.error.message);
    }

    closeModal(dayModal);
    await loadAndRender();
    alert("保存しました");
  }catch(e){
    console.error(e);
    alert("保存で止まりました: " + (e?.message || e));
  }finally{
    daySaveBtn.disabled = false;
    daySaveBtn.textContent = "保存";
  }
}






// ===== settings =====
async function openSettings(){
  pinInput.value = "";
  pinOk = false;
  settingsArea.classList.add("hidden");
  openModal(settingsModal);
}

function renderStaffList(){
  staffList.innerHTML = "";
  staffs.sort((a,b)=>(a.sort||0)-(b.sort||0));

  staffs.forEach((s, idx)=>{
    const item = document.createElement("div");
    item.className = "staffItem";

    const left = document.createElement("div");
    left.className = "staffLeft";

    const name = document.createElement("div");
    name.className = "staffName";
    name.textContent = `${s.name}${s.active ? "" : "（無効）"}`;

    left.appendChild(name);

    const btns = document.createElement("div");
    btns.className = "staffBtns";

    const up = document.createElement("button");
    up.className = "smallBtn";
    up.type = "button";
    up.textContent = "↑";
    up.disabled = (idx===0);
    up.onclick = async ()=>{
      const prev = staffs[idx-1];
      const cur = staffs[idx];
      const tmp = prev.sort;
      prev.sort = cur.sort;
      cur.sort = tmp;
      await upsertStaff(prev);
      await upsertStaff(cur);
      staffs = await loadStaffs();
      renderStaffList();
    };

    const down = document.createElement("button");
    down.className = "smallBtn";
    down.type = "button";
    down.textContent = "↓";
    down.disabled = (idx===staffs.length-1);
    down.onclick = async ()=>{
      const next = staffs[idx+1];
      const cur = staffs[idx];
      const tmp = next.sort;
      next.sort = cur.sort;
      cur.sort = tmp;
      await upsertStaff(next);
      await upsertStaff(cur);
      staffs = await loadStaffs();
      renderStaffList();
    };

    const toggle = document.createElement("button");
    toggle.className = "smallBtn off";
    toggle.type = "button";
    toggle.textContent = s.active ? "無効" : "有効";
    toggle.onclick = async ()=>{
      await updateStaff(s.id, { active: !s.active });
      staffs = await loadStaffs();
      renderStaffList();
    };

    btns.appendChild(up);
    btns.appendChild(down);
    btns.appendChild(toggle);

    item.appendChild(left);
    item.appendChild(btns);

    staffList.appendChild(item);
  });
}

async function enterPin(){
  const pin = (await loadPin()).trim();
  const input = (pinInput.value||"").trim();
  if(input !== pin){
    alert("PINが違います");
    return;
  }
  pinOk = true;
  settingsArea.classList.remove("hidden");
  staffs = await loadStaffs();
  // 初回0件なら投入
  if(staffs.length === 0){
    let sort = 1;
    for(const s of DEFAULT_STAFFS){
      await upsertStaff({ ...s, sort: sort++ });
    }
    staffs = await loadStaffs();
  }
  renderStaffList();
}

async function addStaff(){
  if(!pinOk) return;
  const name = (staffNameInput.value||"").trim();
  if(!name) return;

  const maxSort = Math.max(0, ...staffs.map(s=>Number(s.sort||0)));
  const row = { id: crypto.randomUUID(), name, sort: maxSort+1, active: true };
  await upsertStaff(row);

  staffNameInput.value = "";
  staffs = await loadStaffs();
  renderStaffList();
}

async function changePin(){
  if(!pinOk) return;
  const np = (newPinInput.value||"").trim();
  if(np.length < 4){
    alert("PINは4桁以上を推奨します");
    return;
  }
  await savePin(np);
  alert("PINを変更しました");
  newPinInput.value = "";
}

// ===== CSV =====
function exportCsv(){
  const first = startOfMonth(viewDate);
  const last  = endOfMonth(viewDate);

  const rows = [];
  rows.push(["date","count","memo"].join(","));

  for(let day=1; day<=last.getDate(); day++){
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    const key = toDateKey(d);
    const info = monthData[key] || { count:0, memo:"" };

    const memo = (info.memo||"").replaceAll('"','""');
    rows.push([key, Number(info.count||0), `"${memo}"`].join(","));
  }

  const blob = new Blob([rows.join("\n")], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bookings_${currentMonthKey}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ===== init =====
async function loadAndRender(){
   // ★超重要：viewDate を必ず Date に復旧してから以降は vd を使う
  const vd = (viewDate instanceof Date && !isNaN(viewDate.getTime()))
    ? viewDate
    : new Date();
  viewDate = vd;
  fillSelect();

  const y = vd.getFullYear();
const m = vd.getMonth();

  const start = new Date(y, m, 1);
  const monthKey = toMonthKey(start);
currentMonthKey = monthKey;

// ★この月の目標をSupabaseから読む（なければ初期値のまま）
const gs = await loadGoalSales(monthKey);
if (Number.isFinite(Number(gs)) && Number(gs) >= 0) {
  goalSales = Number(gs);
}
  const end   = new Date(y, m + 1, 0);

  const startKey = toDateKey(start);
  const endKey   = toDateKey(end);

  monthData = {};

 

 // 集計（必ず関数スコープで保持）
let monthTotal = 0;
let sumSales = 0;
let sumCustomers = 0;
let sumNew = 0;
let sumRepeat = 0;

// ★追加：新規/既存の月合計

  const res = await sb
    .from("bookings_daily")
    .select("day,total,tech_sales,retail_sales,new_customers,repeat_customers")
    .gte("day", startKey)
    .lte("day", endKey);

  if (res.error) {
    alert("bookings_daily の取得でエラー: " + res.error.message);
    console.error(res.error);

    const el = document.getElementById("totalMonthCount");
    if (el) el.textContent = "今月 合計予約数：0";

    // パネルもゼロ扱いで出す
    sumSales = 0;
    sumCustomers = 0;

  } else {
for (const r of (res.data || [])) {
  const c = Number(r.total || 0);
  monthTotal += c;

  const tech = Number(r.tech_sales || 0);
  const retail = Number(r.retail_sales || 0);

  // ★追加：売上が入ってる日だけログに出す
  if ((tech + retail) > 0) {
    console.log("売上あり日:", r.day, "tech:", tech, "retail:", retail);
  }

  const newC = Number(r.new_customers || 0);
const repC = Number(r.repeat_customers || 0);

sumNew += newC;
sumRepeat += repC;

const cus = newC + repC;

sumSales += (tech + retail);
sumCustomers += cus;


  const daySales = tech + retail;

monthData[r.day] = {
  count: c,
  memo: "",
  sales: daySales
};

}


    const el = document.getElementById("totalMonthCount");
    if (el) el.textContent = `今月 合計予約数：${monthTotal}`;
  }
// ===== 今日の予約数（“予6”の合計） =====
var tEl = document.getElementById("todayTotalCount");
if (tEl){
  const now = new Date();
  const sameMonth =
    (now.getFullYear() === viewDate.getFullYear()) &&
    (now.getMonth() === viewDate.getMonth());

  if (!sameMonth){
    tEl.textContent = ""; // 今月以外は表示しない（好みで変えてOK）
  } else {
    const todayKey = toDateKey(now);
    const todayTotal = Number(monthData?.[todayKey]?.count || 0);
    tEl.textContent = `今日の予約数：${todayTotal}`;
  }
}
  　// ===== 目標（固定）=====
const GOAL_CUSTOMERS = 200;
const GOAL_UNIT_PRICE = 7500;
const GOAL_SALES = goalSales; // ★ここが可変
 // ===== ここからパネル計算（営業日ベース） =====
const lackSales = Math.max(0, GOAL_SALES - sumSales);
const lackCustomers = Math.max(0, GOAL_CUSTOMERS - sumCustomers);

// 残り営業日（今日含む・今月のみ）
const remDays = remainingBusinessDaysInViewedMonth(vd, true);


const needSalesPerDay = remDays > 0 ? Math.ceil(lackSales / remDays) : 0;
const needCustomersPerDay = remDays > 0 ? Math.ceil(lackCustomers / remDays) : 0;

const unitPrice = sumCustomers > 0 ? Math.floor(sumSales / sumCustomers) : 0;

// ペース判定（今月だけ・営業日ペース）
let onTrack = true;
const now = new Date();
const sameMonth =
  (now.getFullYear() === viewDate.getFullYear()) &&
  (now.getMonth() === viewDate.getMonth());

if (sameMonth) {
  // 今月の営業日総数
  const bizTotal = businessDaysInMonth(vd);

  // 今日までの営業日数（今日が営業日なら今日を含む）
  const bizElapsed = businessDaysElapsedInMonth(vd);

  const expectedByNowSales = Math.floor(GOAL_SALES * (bizElapsed / Math.max(1, bizTotal)));
  const expectedByNowCustomers = Math.floor(GOAL_CUSTOMERS * (bizElapsed / Math.max(1, bizTotal)));

  onTrack = (sumSales >= expectedByNowSales) && (sumCustomers >= expectedByNowCustomers);
}

  // ===== DOM反映（var版だけに統一） =====
  var el;
el = document.getElementById("mDailyGoal");
if (el) el.textContent = fmtYen(dailyGoalSalesByBusinessDays(vd, GOAL_SALES));
  el = document.getElementById("mSales");
  if (el) el.textContent = fmtYen(sumSales);

  el = document.getElementById("mCustomers");
  if (el) el.textContent = fmtNum(sumCustomers) + "名";
  // 月 客数合計
el = document.getElementById("mCustomers");
if (el) el.textContent = fmtNum(sumCustomers) + "名";

// ★追加：月 新規/既存 客数合計
el = document.getElementById("mCustomersNew");
if (el) el.textContent = fmtNum(sumNew) + "名";

el = document.getElementById("mCustomersRepeat");
if (el) el.textContent = fmtNum(sumRepeat) + "名";

　// ★ここに追加（新規 / 既存）
　el = document.getElementById("mNewCustomers");
　if (el) el.textContent = fmtNum(sumNew) + "名";

　el = document.getElementById("mRepeatCustomers");
　if (el) el.textContent = fmtNum(sumRepeat) + "名";
  el = document.getElementById("mUnitPrice");
  if (el) el.textContent = unitPrice ? fmtYen(unitPrice) : "—";


// ⑥：売上タイトル横の目標表示
el = document.getElementById("mGoalSalesInline");
if (el) el.textContent = fmtYen(GOAL_SALES);

  el = document.getElementById("needSales");
  if (el) el.textContent = remDays ? (fmtYen(needSalesPerDay) + "/日") : "—";

  el = document.getElementById("needCustomers");
  if (el) el.textContent = remDays ? (fmtNum(needCustomersPerDay) + "名/日") : "—";

// ★追加：次回営業日 必要客単価（= 次回営業日の必要売上 ÷ 次回営業日の予約数）
el = document.getElementById("needUnitPrice");
if (el){
  // 次回営業日（今月以外は表示しない運用なら sameMonth の条件で切る）
  const nextBiz = getNextBusinessDay(vd);

  // 次回営業日が今月の範囲外なら "—"
  const sameMonthNext =
    (nextBiz.getFullYear() === vd.getFullYear()) &&
    (nextBiz.getMonth() === vd.getMonth());

  if (!sameMonthNext){
    el.textContent = "—";
  } else {
    const nextKey = toDateKey(nextBiz);

    // 次回営業日の予約数（合計）
    const nextBookings = Number(monthData?.[nextKey]?.count || 0);

    // 「残り営業日あたり必要（売上）」＝ needSalesPerDay を使う（表示と同じ前提）
    const needUnit = (nextBookings > 0)
      ? Math.ceil(needSalesPerDay / nextBookings)
      : 0;

    // 表示（予約0なら — にするのがおすすめ）
    el.textContent = (nextBookings > 0) ? (fmtNum(needUnit) + "円") : "—";
  }
}

  

updateRings(sumSales, unitPrice, GOAL_SALES);
renderMonth();
}






btnPrev?.addEventListener("click", async ()=>{
  const vd = (viewDate instanceof Date && !isNaN(viewDate.getTime())) ? viewDate : new Date();
  viewDate = addMonths(vd, -1);
  await loadAndRender();
});

btnNext?.addEventListener("click", async ()=>{
  const vd = (viewDate instanceof Date && !isNaN(viewDate.getTime())) ? viewDate : new Date();
  viewDate = addMonths(vd, +1);
  await loadAndRender();
});

dayCloseBtn?.addEventListener("click", ()=> closeModal(dayModal));
daySaveBtn?.addEventListener("click", saveDay);
// 入力のたびに「今日のモチベ表示」を更新（効果大）

btnSettings?.addEventListener("click", openSettings);
settingsCloseBtn?.addEventListener("click", ()=> closeModal(settingsModal));
settingsCloseBtn2?.addEventListener("click", ()=> closeModal(settingsModal));

pinEnterBtn?.addEventListener("click", enterPin);
staffAddBtn?.addEventListener("click", addStaff);
pinChangeBtn?.addEventListener("click", changePin);

btnExport?.addEventListener("click", exportCsv);

// タブに戻ったら再読み込み（PC確認用）
window.addEventListener("focus", ()=>{
  setTimeout(()=>{ loadAndRender(); }, 150);
});
// ===== Store Board (Supabase sync: memo tasks + shared photo) =====
(function initStoreBoard(){
  const memoDateSelect = document.getElementById("memoDateSelect");
  const memoText = document.getElementById("memoText");
  const memoAddBtn = document.getElementById("memoAddBtn");
  const memoClearInputBtn = document.getElementById("memoClearInputBtn");
  const taskList = document.getElementById("taskList");

  const photoFile = document.getElementById("photoFile");
  const photoUploadBtn = document.getElementById("photoUploadBtn");
  const photoDeleteBtn = document.getElementById("photoDeleteBtn");
  const photoPreview = document.getElementById("photoPreview");

  // 店舗ボードが無いページでも落ちないように
  if (!memoDateSelect || !memoText || !memoAddBtn || !memoClearInputBtn || !taskList) return;

  // Supabase client は既存の sb を使う前提（あなたの予約カレンダーと同じ）
  if (typeof sb === "undefined") {
    console.error("Supabase client (sb) が見つかりません");
    return;
  }

  // 店舗単位（あなたの運用なら固定でOK）
  const STORE_ID = "default"; // ←必要なら "comfort" などに変更してOK
  const TASK_TABLE = "store_tasks";

  // Storage
  const BUCKET = "storeboard";
  const PHOTO_PATH = `${STORE_ID}/shared.jpg`;

  // --- utils ---
  const pad2 = (n)=> String(n).padStart(2, "0");
  const toDateKey = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const weekdayJP = ["日","月","火","水","木","金","土"];
  const formatJP = (d)=> `${d.getMonth()+1}月${d.getDate()}日（${weekdayJP[d.getDay()]}）`;

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function getSelectedDateKey(){
    return memoDateSelect.value; // "YYYY-MM-DD"
  }

  // --- date dropdown fill: 今日〜90日先 ---
  function fillMemoDates(){
    const today = new Date();
    memoDateSelect.innerHTML = "";
    for (let i=0; i<90; i++){
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const opt = document.createElement("option");
      opt.value = toDateKey(d);
      opt.textContent = `${formatJP(d)}（${opt.value}）`;
      memoDateSelect.appendChild(opt);
    }
  }

  // ===== Tasks: Supabase CRUD =====
  async function fetchTasks(){
    const day = getSelectedDateKey();
    const res = await sb
      .from(TASK_TABLE)
      .select("id, text, done, created_at")
      .eq("store_id", STORE_ID)
      .eq("day", day)
      .order("created_at", { ascending: false });

    if (res.error) {
      console.error(res.error);
      taskList.innerHTML = `<div class="hint">メモの取得でエラー：${escapeHtml(res.error.message)}</div>`;
      return [];
    }
    return res.data || [];
  }

  async function renderTasks(){
    const tasks = await fetchTasks();
    if (!tasks.length){
      taskList.innerHTML = `<div class="hint">メモはまだありません</div>`;
      return;
    }

    taskList.innerHTML = tasks.map(t=>{
      const doneClass = t.done ? "done" : "";
      return `
        <div class="taskItem ${doneClass}" data-id="${escapeHtml(t.id)}">
          <input class="taskChk" type="checkbox" ${t.done ? "checked" : ""} />
          <div class="taskText">${escapeHtml(t.text)}</div>
          <button class="btn taskDelBtn" type="button">削除</button>
        </div>
      `;
    }).join("");
  }

  async function addTask(){
  const text = memoText.value.trim();
  if (!text) return;

  const day = getSelectedDateKey();

  const res = await sb.from(TASK_TABLE).insert([{
    store_id: STORE_ID,
    day,
    text,
    done: false,
    updated_by: "ipad"   // ← これを追加
  }]);


    if (res.error) {
      alert("メモの追加でエラー: " + res.error.message);
      console.error(res.error);
      return;
    }
    memoText.value = "";
    await renderTasks();
  }

  async function setDone(id, done){
    const res = await sb
      .from(TASK_TABLE)
      .update({ done })
      .eq("id", id)
      .eq("store_id", STORE_ID);

    if (res.error) {
      alert("更新でエラー: " + res.error.message);
      console.error(res.error);
      return;
    }
    await renderTasks();
  }

  async function deleteTask(id){
    const res = await sb
      .from(TASK_TABLE)
      .delete()
      .eq("id", id)
      .eq("store_id", STORE_ID);

    if (res.error) {
      alert("削除でエラー: " + res.error.message);
      console.error(res.error);
      return;
    }
    await renderTasks();
  }

  // list events (toggle done / delete)
  taskList.addEventListener("click", async (e)=>{
    const item = e.target.closest(".taskItem");
    if (!item) return;
    const id = item.getAttribute("data-id");

    if (e.target.closest(".taskDelBtn")){
      await deleteTask(id);
      return;
    }

    if (e.target.classList.contains("taskChk")){
      await setDone(id, e.target.checked);
    }
  });

  taskList.addEventListener("change", async (e)=>{
    if (!e.target.classList.contains("taskChk")) return;
    const item = e.target.closest(".taskItem");
    if (!item) return;
    const id = item.getAttribute("data-id");
    await setDone(id, e.target.checked);
  });

  // ===== Photo: Supabase Storage =====
  function setPhotoPlaceholder(){
    if (photoPreview) photoPreview.innerHTML = `<div class="hint">プレビュー</div>`;
  }

  function bust(url){
    const sep = url.includes("?") ? "&" : "?";
    return url + sep + "t=" + Date.now();
  }

  async function loadPhoto(){
    if (!photoPreview) return;

    const { data } = sb.storage.from(BUCKET).getPublicUrl(PHOTO_PATH);
    const publicUrl = data?.publicUrl;

    if (!publicUrl){
      setPhotoPlaceholder();
      return;
    }

    // 画像が存在しない場合もあるので、まず表示だけ試す（onerrorでプレースホルダに戻す）
    photoPreview.innerHTML = `<img src="${bust(publicUrl)}" alt="写真プレビュー" />`;
    const img = photoPreview.querySelector("img");
    img.onerror = () => setPhotoPlaceholder();
  }

  async function handlePhotoUpload(){
    if (!photoFile || !photoPreview) return;
    const file = photoFile.files?.[0];
    if (!file) return;

    // jpg固定で保存（上書き）
    const res = await sb.storage.from(BUCKET).upload(PHOTO_PATH, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "image/jpeg"
    });

    if (res.error) {
      alert("写真アップロードでエラー: " + res.error.message);
      console.error(res.error);
      return;
    }

    photoFile.value = "";
    await loadPhoto();
  }

  async function handlePhotoDelete(){
    if (!confirm("写真を削除しますか？")) return;

    const res = await sb.storage.from(BUCKET).remove([PHOTO_PATH]);
    if (res.error) {
      alert("写真削除でエラー: " + res.error.message);
      console.error(res.error);
      return;
    }
    if (photoFile) photoFile.value = "";
    setPhotoPlaceholder();
  }

  // ===== realtime (同時に見ていても更新反映) =====
  function setupRealtime(){
    try{
      const channel = sb.channel("store_tasks_changes");
      channel
        .on("postgres_changes",
          { event: "*", schema: "public", table: TASK_TABLE, filter: `store_id=eq.${STORE_ID}` },
          async (payload) => {
            // 選択中の日付だけ再描画
            const selected = getSelectedDateKey();
            const changedDay = payload.new?.day || payload.old?.day;
            if (String(changedDay) === String(selected)) {
              await renderTasks();
            }
          }
        )
        .subscribe();
    } catch (e){
      console.warn("Realtime購読が開始できませんでした（致命ではありません）", e);
    }
  }

  // --- wire up ---
  fillMemoDates();
  memoAddBtn.addEventListener("click", addTask);
  memoClearInputBtn.addEventListener("click", ()=>{ memoText.value = ""; memoText.focus(); });
  memoDateSelect.addEventListener("change", renderTasks);

  memoText.addEventListener("keydown", (e)=>{
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){
      e.preventDefault();
      addTask();
    }
  });

  if (photoUploadBtn) photoUploadBtn.addEventListener("click", handlePhotoUpload);
  if (photoDeleteBtn) photoDeleteBtn.addEventListener("click", handlePhotoDelete);

  // 初回表示
  renderTasks();
  loadPhoto();
  setupRealtime();

  // タブに戻ったら写真も更新（キャッシュ対策）
  window.addEventListener("focus", ()=>{
    loadPhoto();
  });
})();


// 起動
loadAndRender();
// ===== Mobile view-only mode (today〜今月だけ閲覧) =====
(function enableMobileViewOnly(){
  // PCで幅が狭いだけでは発動させない（タッチ端末だけ）
  const isTouchMobile = window.matchMedia("(pointer: coarse) and (max-width: 520px)").matches;
  if (!isTouchMobile) return;

  // 1) 今月に固定（念のため）
  const now = new Date();
  viewDate = new Date(now.getFullYear(), now.getMonth(), 1);

  // 3) 設定/CSVなど “編集系” ボタン無効化（表示も薄く）
  [btnSettings, btnExport, daySaveBtn, pinEnterBtn, staffAddBtn, pinChangeBtn].forEach(el=>{
    if(!el) return;
    el.setAttribute("disabled","disabled");
    el.style.opacity = "0.45";
    el.style.pointerEvents = "none";
  });

  // 4) 店舗ボードを“見るだけ”に（入力欄を無効化）
  document.querySelectorAll(".storeBoard input, .storeBoard textarea, .storeBoard select, .storeBoard button")
    .forEach(el=>{
      el.setAttribute("disabled","disabled");
      el.style.opacity = "0.55";
      el.style.pointerEvents = "none";
    });

  // 5) カレンダー日付クリックで編集モーダルを開かないようにする
  const cal = document.getElementById("calendar");
  if (cal) {
    const guard = document.createElement("div");
    guard.style.position = "absolute";
    guard.style.inset = "0";
    guard.style.zIndex = "5";
    guard.style.background = "transparent";
    guard.style.pointerEvents = "auto";
    guard.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); });
    cal.style.position = "relative";
    cal.appendChild(guard);
  }
  
// ★切り分け用：HTML onclick から呼ぶ（月移動）
window.__goPrev = async function(){
  try{
    viewDate = addMonths(viewDate, -1);
    await loadAndRender();
  }catch(e){
    console.error(e);
    alert("prevでエラー: " + (e?.message || e));
  }
};

window.__goNext = async function(){
  try{
    viewDate = addMonths(viewDate, +1);
    await loadAndRender();
  }catch(e){
    console.error(e);
    alert("nextでエラー: " + (e?.message || e));
  }
};
  // 再描画（今月固定）
  loadAndRender();
})();
// ===== 月移動（HTML onclick 用：最終保険）=====
function __ensureViewDate(){
  if (!(viewDate instanceof Date) || isNaN(viewDate.getTime())) {
    console.warn("[fix] viewDate invalid -> reset", viewDate);
    viewDate = new Date();
  }
}

async function __moveMonth(diff){
  try{
    __ensureViewDate();
    viewDate = addMonths(viewDate, diff);
    await loadAndRender();
  }catch(e){
    console.error(e);
    alert("月移動でエラー: " + (e?.message || e));
  }
}

// HTML が _goPrev/_goNext を呼んでいる前提
window._goPrev = ()=> __moveMonth(-1);
window._goNext = ()=> __moveMonth(+1);

// ついでに別名でも動くよう保険（あっても害なし）
window.goPrev = window._goPrev;
window.goNext = window._goNext;
