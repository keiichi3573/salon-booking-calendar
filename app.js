/* =========================
  Salon Booking Calendar (Clean Minimal)
  Tables:
  - staffs
  - bookings_staff_daily
  - bookings_daily
  - goals_monthly
========================= */

/* ===== Supabase ===== */
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase設定が読み込めていません（config.js を確認してください）");
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
/* ===== Config ===== */
const MAX_COUNT = 20;
const DEFAULT_GOAL_CUSTOMERS = 200;
const DEFAULT_GOAL_UNIT_PRICE = 7500;

const DEFAULT_PIN = "4043";
const KEY_LOCAL_PIN = "salon_pin_v1";

/* ===== Utils ===== */
const pad2 = (n) => String(n).padStart(2, "0");
const WEEK = ["日","月","火","水","木","金","土"];

const toMonthKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
const toDateKey  = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function addMonths(d, diff){ return new Date(d.getFullYear(), d.getMonth()+diff, 1); }

function fmtYen(n){
  const v = Math.max(0, Math.floor(Number(n || 0)));
  return v.toLocaleString("ja-JP") + "円";
}
function fmtNum(n){
  const v = Math.max(0, Math.floor(Number(n || 0)));
  return v.toLocaleString("ja-JP");
}
function fmtYen1(n){
  const v = Number(n || 0);
  return v.toLocaleString("ja-JP", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }) + "円";
}

function fmtNum1(n){
  const v = Number(n || 0);
  return v.toLocaleString("ja-JP", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}
/* ===== Device mode =====
  - PC: sales inputs visible
  - iPad(store-like): sales inputs hidden
  You asked: iPad tap shows NO sales inputs.
*/
function isStoreLikeDevice(){
  const p = new URLSearchParams(location.search);
  if (p.get("ui") === "store") return true;
  if (p.get("ui") === "pc") return false;

  // iPad / tablet-ish: coarse pointer and <= 1024px
  return window.matchMedia("(pointer: coarse) and (max-width: 1024px)").matches;
}
function applyDeviceVisibility(){
  const storeMode = isStoreLikeDevice();

  document.querySelectorAll(".pcOnly").forEach(el => {
    el.style.display = storeMode ? "none" : "";
  });
}
/* ===== Closed days =====
  - Every Monday
  - 1st Tuesday
  - 3rd Tuesday
*/
function isClosedDay(date){
  const dow = date.getDay();
  if (dow === 1) return true; // Monday
  if (dow === 2){
    const weekIndex = Math.floor((date.getDate() - 1) / 7) + 1; // 1..5
    if (weekIndex === 1 || weekIndex === 3) return true;
  }
  return false;
}

function businessDaysInMonth(viewDate){
  const first = startOfMonth(viewDate);
  const last  = endOfMonth(viewDate);
  let count = 0;
  for(let d = new Date(first); d <= last; d.setDate(d.getDate()+1)){
    if (!isClosedDay(d)) count++;
  }
  return count;
}
function businessDaysInRange(viewDate, startDay, endDay){
  const lastDay = endOfMonth(viewDate).getDate();
  const safeStart = Math.max(1, startDay);
  const safeEnd = Math.min(lastDay, endDay);

  if (safeEnd < safeStart) return 0;

  let count = 0;
  for (let day = safeStart; day <= safeEnd; day++){
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (!isClosedDay(d)) count++;
  }
  return count;
}
function businessDaysElapsedInMonth(viewDate){
  const now = new Date();
  const sameMonth = now.getFullYear() === viewDate.getFullYear() && now.getMonth() === viewDate.getMonth();
  if (!sameMonth) return 0;

  const first = startOfMonth(viewDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let count = 0;
  for(let d = new Date(first); d <= today; d.setDate(d.getDate()+1)){
    if (!isClosedDay(d)) count++;
  }
  return count;
}

function remainingBusinessDaysInMonthFromTomorrow(viewDate){
  const now = new Date();
  const sameMonth = now.getFullYear() === viewDate.getFullYear() && now.getMonth() === viewDate.getMonth();
  if (!sameMonth) return 0;

  const lastDate = endOfMonth(viewDate).getDate();
  const startDay = now.getDate() + 1;

  let count = 0;
  for(let day = startDay; day <= lastDate; day++){
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (!isClosedDay(d)) count++;
  }
  return count;
}
function remainingBusinessDaysIncludingToday(viewDate){
  const now = new Date();
  const sameMonth =
    now.getFullYear() === viewDate.getFullYear() &&
    now.getMonth() === viewDate.getMonth();

  if (!sameMonth) return 0;

  const lastDate = endOfMonth(viewDate).getDate();
  const startDay = now.getDate(); // ← 今日を含む

  let count = 0;
  for (let day = startDay; day <= lastDate; day++){
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (!isClosedDay(d)) count++;
  }
  return count;
}
function getNextBusinessDay(base){
  const baseDate = (base instanceof Date && !isNaN(base.getTime())) ? base : new Date();
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  for(let i=0; i<40; i++){
    d.setDate(d.getDate()+1);
    if(!isClosedDay(d)) return d;
  }
  return baseDate;
}

/* ===== Modal helpers (focus safe) ===== */
let __lastFocusedEl = null;

function openModal(modal){
  if(!modal) return;
  const card = modal.querySelector(".modalCard");
  __lastFocusedEl = document.activeElement;

  modal.classList.remove("hidden");
  if(card) card.setAttribute("aria-hidden","false");

  const focusTarget = modal.querySelector(
    '[autofocus], input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
  );
  (focusTarget || card || modal).focus?.();
}

function closeModal(modal){
  if(!modal) return;

  const card = modal.querySelector(".modalCard");

  // モーダル内にフォーカスが残っていたら先に外す
  const active = document.activeElement;
  if (active && modal.contains(active) && typeof active.blur === "function"){
    active.blur();
  }

  // 元の要素へフォーカスを戻す
  if (__lastFocusedEl && typeof __lastFocusedEl.focus === "function"){
    __lastFocusedEl.focus();
  } else {
    document.body.focus?.();
  }

  // その後に aria-hidden / 非表示
  if (card) card.setAttribute("aria-hidden", "true");
  modal.classList.add("hidden");
}

/* ===== DOM ===== */
const elMonthTitle = document.getElementById("monthTitle");
const elCalendar   = document.getElementById("calendar");
const btnPrev      = document.getElementById("prevBtn");
const btnNext      = document.getElementById("nextBtn");
const btnExport    = document.getElementById("exportCsvBtn");
const btnSettings  = document.getElementById("settingsBtn");

const elTotalMonthCount = document.getElementById("totalMonthCount");
const elTodayTotalCount = document.getElementById("todayTotalCount");

// Month summary bar
const elMSales = document.getElementById("mSales");
const elMNew = document.getElementById("mCustomersNew");
const elMRepeat = document.getElementById("mCustomersRepeat");
const elMCustomers = document.getElementById("mCustomers");
const elMUnitPrice = document.getElementById("mUnitPrice");

// Right panel
const elGoalSalesInline = document.getElementById("mGoalSalesInline");
const elDailyGoal = document.getElementById("mDailyGoal");
const elNeedSales = document.getElementById("needSales");
const elNeedCustomers = document.getElementById("needCustomers");
const elNeedUnitPrice = document.getElementById("needUnitPrice");

const elSalesPct = document.getElementById("mSalesPct");
const elUnitPct  = document.getElementById("mUnitPct");
const elSalesRing = document.getElementById("mSalesRing");
const elUnitRing  = document.getElementById("mUnitRing");

const elAvgDaySales = document.getElementById("avgDaySales");
const elAvgDayCustomers = document.getElementById("avgDayCustomers");
const elFirstHalfSales = document.getElementById("firstHalfSales");
const elSecondHalfSales = document.getElementById("secondHalfSales");
const elFirstHalfAvgSales = document.getElementById("firstHalfAvgSales");
const elSecondHalfAvgSales = document.getElementById("secondHalfAvgSales");
const elProjectedSales = document.getElementById("projectedSales");
const elProjectedCustomers = document.getElementById("projectedCustomers");

// Day modal
const dayModal = document.getElementById("dayModal");
const dayCloseBtn = document.getElementById("dayCloseBtn");
const daySaveBtn  = document.getElementById("daySaveBtn");
const dayTitle    = document.getElementById("dayModalTitle");
const staffInputs = document.getElementById("staffInputs");
const totalCountDisplay = document.getElementById("totalCountDisplay");
const daySaveNextBtn = document.getElementById("daySaveNextBtn");
const dayFormHint = document.getElementById("dayFormHint");

// Hidden select (kept for compatibility)
const totalCountSelect = document.getElementById("totalCountSelect");

const salesSection = document.getElementById("salesSection");
const techSalesInput = document.getElementById("techSalesInput");
const retailSalesInput = document.getElementById("retailSalesInput");
const newCustomersSelect = document.getElementById("newCustomersSelect");
const repeatCustomersSelect = document.getElementById("repeatCustomersSelect");

// Settings modal
const settingsModal = document.getElementById("settingsModal");
const settingsCloseBtn  = document.getElementById("settingsCloseBtn");
const settingsCloseBtn2 = document.getElementById("settingsCloseBtn2");
const pinInput = document.getElementById("pinInput");
const pinEnterBtn = document.getElementById("pinEnterBtn");
const settingsArea = document.getElementById("settingsArea");
const staffNameInput = document.getElementById("staffNameInput");
const staffAddBtn = document.getElementById("staffAddBtn");
const staffList = document.getElementById("staffList");
const newPinInput = document.getElementById("newPinInput");
const pinChangeBtn = document.getElementById("pinChangeBtn");

// Goal modal
const goalModal = document.getElementById("goalModal");
const goalEditBtn = document.getElementById("goalEditBtn");
const goalCloseBtn = document.getElementById("goalCloseBtn");
const goalSaveBtn = document.getElementById("goalSaveBtn");
const goalCustomersInput = document.getElementById("goalCustomersInput");
const goalUnitPriceInput = document.getElementById("goalUnitPriceInput");

/* ===== State ===== */
let viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let currentMonthKey = toMonthKey(viewDate);

// Month data maps keyed by YYYY-MM-DD
// bookingsDailyMap: { day -> { total, tech_sales, retail_sales, new_customers, repeat_customers } }
let bookingsDailyMap = new Map();
// bookingsStaffMap: { day -> Map(staff_id -> count) }  // only loaded for a day when editing
let monthStaffs = [];

let monthGoalCustomers = DEFAULT_GOAL_CUSTOMERS;
let monthGoalUnitPrice = DEFAULT_GOAL_UNIT_PRICE;

// day editor state
let editingDayKey = null;
let editingStaffRows = [];
let editingStaffCountMap = new Map();

/* ===== Data access ===== */
async function loadGoals(monthKey){
  const res = await sb
    .from("goals_monthly")
    .select("goal_customers, goal_unit_price")
    .eq("month_key", monthKey)
    .maybeSingle();

  if(res.error){
    console.warn("goals_monthly load error:", res.error);
    return { goalCustomers: null, goalUnitPrice: null };
  }

  const row = res.data || {};
  const gc = row.goal_customers != null ? Number(row.goal_customers) : null;
  const gu = row.goal_unit_price != null ? Number(row.goal_unit_price) : null;

  return {
    goalCustomers: Number.isFinite(gc) ? gc : null,
    goalUnitPrice: Number.isFinite(gu) ? gu : null,
  };
}

async function saveGoals(monthKey, goalCustomers, goalUnitPrice, updatedBy){
  const gc = Math.max(0, Math.floor(Number(goalCustomers || 0)));
  const gu = Math.max(0, Math.floor(Number(goalUnitPrice || 0)));

  const res = await sb
    .from("goals_monthly")
    .upsert([{
      month_key: monthKey,
      goal_customers: gc,
      goal_unit_price: gu,
      updated_by: updatedBy || (isStoreLikeDevice() ? "ipad" : "pc"),
    }], { onConflict: "month_key" });

  if(res.error) throw res.error;
  return { goalCustomers: gc, goalUnitPrice: gu };
}

async function fetchStaffsActive(){
  // column name variance guard: sort_order or sort
  const tryOrder = async (col) => {
    const r = await sb.from("staffs")
      .select("id,name,active,sort_order,sort")
      .eq("active", true)
      .order(col, { ascending: true });
    return r;
  };

  let res = await tryOrder("sort_order");
  if(res.error){
    // fallback
    res = await tryOrder("sort");
  }
  if(res.error) throw res.error;
  return res.data || [];
}

async function fetchStaffsAll(){
  const tryOrder = async (col) => {
    const r = await sb.from("staffs")
      .select("id,name,active,sort_order,sort")
      .order(col, { ascending: true });
    return r;
  };

  let res = await tryOrder("sort_order");
  if(res.error){
    res = await tryOrder("sort");
  }
  if(res.error) throw res.error;
  return res.data || [];
}

async function upsertStaff(row){
  const res = await sb.from("staffs").upsert([row]);
  if(res.error) throw res.error;
}
async function updateStaff(id, patch){
  const res = await sb.from("staffs").update(patch).eq("id", id);
  if(res.error) throw res.error;
}

async function fetchBookingsDailyRange(startKey, endKey){
  const res = await sb
    .from("bookings_daily")
    .select("day,total,tech_sales,retail_sales,new_customers,repeat_customers")
    .gte("day", startKey)
    .lte("day", endKey);

  if(res.error) throw res.error;
  return res.data || [];
}

async function fetchBookingsStaffDay(dayKey){
  const res = await sb
    .from("bookings_staff_daily")
    .select("staff_id,count")
    .eq("day", dayKey);

  if(res.error) throw res.error;
  return res.data || [];
}

async function fetchBookingsDailyDay(dayKey){
  const res = await sb
    .from("bookings_daily")
    .select("day,total,tech_sales,retail_sales,new_customers,repeat_customers")
    .eq("day", dayKey)
    .maybeSingle();

  if(res.error) throw res.error;
  return res.data || null;
}

/* ===== Render (calendar) ===== */
function renderCalendar(){
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);

  currentMonthKey = toMonthKey(first);
  elMonthTitle.textContent = `${first.getFullYear()}年 ${first.getMonth()+1}月`;

  elCalendar.classList.remove("mobileList");
  elCalendar.innerHTML = "";

  // weekday header
  for(let i=0;i<7;i++){
    const h = document.createElement("div");
    h.className = "weekHeader";
    h.textContent = WEEK[i];
    elCalendar.appendChild(h);
  }

  // blanks before first day
  const startDow = first.getDay();
  for(let i=0;i<startDow;i++){
    const blank = document.createElement("div");
    blank.style.visibility = "hidden";
    elCalendar.appendChild(blank);
  }

  for(let day=1; day<=last.getDate(); day++){
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    const key = toDateKey(d);

    const row = bookingsDailyMap.get(key) || {
      total: 0, tech_sales:0, retail_sales:0, new_customers:0, repeat_customers:0
    };

    const cell = document.createElement("div");
    cell.className = "dayCell";
    if(isClosedDay(d)) cell.classList.add("closed");

    const top = document.createElement("div");
    top.className = "dayTop";

    const num = document.createElement("div");
    num.className = "dayNum";
    num.textContent = String(day);

    const badge = document.createElement("div");
    badge.className = "badge reserveBadge";
    badge.textContent = `予${Number(row.total||0)}`;

    top.appendChild(num);
    top.appendChild(badge);

    cell.appendChild(top);

    const sales = Number(row.tech_sales||0) + Number(row.retail_sales||0);
    if(sales > 0){
      const salesEl = document.createElement("div");
      salesEl.className = "daySales";
      salesEl.textContent = sales.toLocaleString("ja-JP");
      cell.appendChild(salesEl);
    }

    cell.addEventListener("click", () => openDayEditor(d));
    elCalendar.appendChild(cell);
  }
}

/* ===== Summary + Right Panel ===== */
function updateRings(sumSales, unitPrice, goalSales, goalUnitPrice){
  const pctSalesRaw = goalSales > 0 ? Math.floor((sumSales / goalSales) * 100) : 0;
  const pctUnitRaw  = goalUnitPrice > 0 ? Math.floor((unitPrice / goalUnitPrice) * 100) : 0;

  const pctSales = Math.max(0, Math.min(100, pctSalesRaw));
  const pctUnit  = Math.max(0, Math.min(100, pctUnitRaw));

  if(elSalesPct) elSalesPct.textContent = pctSalesRaw + "%";
  if(elUnitPct)  elUnitPct.textContent  = pctUnitRaw + "%";

  if(elSalesRing){
    elSalesRing.style.setProperty("--pct", String(pctSales));
    elSalesRing.style.setProperty("--pctCut", String(Math.min(90, pctSales)));
  }
  if(elUnitRing){
    elUnitRing.style.setProperty("--pct", String(pctUnit));
    elUnitRing.style.setProperty("--pctCut", String(Math.min(90, pctUnit)));
  }
}

function renderSummaryAndPanel(){
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);

  // totals
  let monthTotalBookings = 0;

  let sumSales = 0;
  let sumNew = 0;
  let sumRepeat = 0;

  for(let day=1; day<=last.getDate(); day++){
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    const key = toDateKey(d);
    const row = bookingsDailyMap.get(key);
    if(!row) continue;

    monthTotalBookings += Number(row.total||0);

    const tech = Number(row.tech_sales||0);
    const retail = Number(row.retail_sales||0);
    sumSales += (tech + retail);

    sumNew += Number(row.new_customers||0);
    sumRepeat += Number(row.repeat_customers||0);
  }

  const sumCustomers = sumNew + sumRepeat;
  const unitPrice = sumCustomers > 0 ? Math.floor(sumSales / sumCustomers) : 0;

  // Goal
  const goalCustomers = monthGoalCustomers;
  const goalUnitPrice = monthGoalUnitPrice;
  const goalSales = goalCustomers * goalUnitPrice;

  // legend totals
  if(elTotalMonthCount) elTotalMonthCount.textContent = `今月 合計予約数：${monthTotalBookings}`;

  // today total
  if(elTodayTotalCount){
    const now = new Date();
    const sameMonth = now.getFullYear() === viewDate.getFullYear() && now.getMonth() === viewDate.getMonth();
    if(!sameMonth){
      elTodayTotalCount.textContent = "";
    }else{
      const todayKey = toDateKey(now);
      const todayRow = bookingsDailyMap.get(todayKey);
      elTodayTotalCount.textContent = `今日の予約数：${Number(todayRow?.total||0)}`;
    }
  }

  // month summary bar
  if(elMSales) elMSales.textContent = fmtYen(sumSales);
  if(elMNew) elMNew.textContent = fmtNum(sumNew) + "名";
  if(elMRepeat) elMRepeat.textContent = fmtNum(sumRepeat) + "名";
  if(elMCustomers) elMCustomers.textContent = fmtNum(sumCustomers) + "名";
  if(elMUnitPrice) elMUnitPrice.textContent = unitPrice ? fmtYen(unitPrice) : "—";

  // goal inline
  if(elGoalSalesInline) elGoalSalesInline.textContent = fmtYen(goalSales);

  // business-day metrics (this month only)
  const bizTotal = businessDaysInMonth(viewDate);
  const dailyGoal = bizTotal > 0 ? Math.ceil(goalSales / bizTotal) : 0;
  if(elDailyGoal) elDailyGoal.textContent = dailyGoal ? fmtYen(dailyGoal) : "—";

  const now = new Date();
const sameMonth =
  now.getFullYear() === viewDate.getFullYear() &&
  now.getMonth() === viewDate.getMonth();

let needSalesPerDay = 0;
let needCustomersPerDay = 0;

if (sameMonth){
  // 昨日までの実績だけ集計
  let salesThroughYesterday = 0;
  let customersThroughYesterday = 0;

  const todayDate = now.getDate();

  for (let day = 1; day < todayDate; day++){
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const key = toDateKey(d);
    const row = bookingsDailyMap.get(key);
    if (!row) continue;

    salesThroughYesterday += Number(row.tech_sales || 0) + Number(row.retail_sales || 0);
    customersThroughYesterday += Number(row.new_customers || 0) + Number(row.repeat_customers || 0);
  }

  const lackSales = Math.max(0, goalSales - salesThroughYesterday);
  const lackCustomers = Math.max(0, goalCustomers - customersThroughYesterday);

  // 今日を含む残り営業日
  const remBiz = remainingBusinessDaysIncludingToday(viewDate);

  needSalesPerDay = remBiz > 0 ? Math.ceil(lackSales / remBiz) : 0;
  needCustomersPerDay = remBiz > 0 ? (lackCustomers / remBiz) : 0;

  if (elNeedSales) {
    elNeedSales.textContent = remBiz ? (fmtYen(needSalesPerDay) + "/日") : "—";
  }

if (elNeedCustomers) {
  elNeedCustomers.textContent = remBiz ? (fmtNum1(needCustomersPerDay) + "名/日") : "—";
}

  // 必要客単価：今日は営業日なら「本日」、休みなら「次回営業日」
  const today = new Date(viewDate.getFullYear(), viewDate.getMonth(), todayDate);
  let targetDate = null;

  if (!isClosedDay(today)) {
    targetDate = today;
    const label = document.getElementById("needUnitLabel");
    if (label) label.textContent = "本日 必要客単価";
  } else {
    targetDate = getNextBusinessDay(today);
    const label = document.getElementById("needUnitLabel");
    if (label) label.textContent = "次回営業日 必要客単価";
  }

  if (elNeedUnitPrice){
    const sameMonthTarget =
      targetDate &&
      targetDate.getFullYear() === viewDate.getFullYear() &&
      targetDate.getMonth() === viewDate.getMonth();

    if (!sameMonthTarget){
      elNeedUnitPrice.textContent = "—";
    } else {
      const targetKey = toDateKey(targetDate);
      const targetBookings = Number(bookingsDailyMap.get(targetKey)?.total || 0);

      if (targetBookings > 0 && needSalesPerDay > 0){
        const needUnit = Math.ceil(needSalesPerDay / targetBookings);
        elNeedUnitPrice.textContent = fmtNum(needUnit) + "円";
      } else {
        elNeedUnitPrice.textContent = "—";
      }
    }
  }
} else {
  if (elNeedSales) elNeedSales.textContent = "—";
  if (elNeedCustomers) elNeedCustomers.textContent = "—";
  if (elNeedUnitPrice) elNeedUnitPrice.textContent = "—";

  const label = document.getElementById("needUnitLabel");
  if (label) label.textContent = "本日 / 次回営業日 必要客単価";
}
  /* ===== 新しい分析項目（PCのみ）===== */
  const analysisNow = new Date();
  const analysisSameMonth =
    analysisNow.getFullYear() === viewDate.getFullYear() &&
    analysisNow.getMonth() === viewDate.getMonth();

  const analysisMonthBizTotal = businessDaysInMonth(viewDate);
  const analysisLastDay = endOfMonth(viewDate).getDate();

  // 今日のデータ（今月表示中のみ）
  let analysisTodaySales = 0;
  let analysisTodayCustomers = 0;
  let analysisTodayDate = 0;

  if (analysisSameMonth){
    analysisTodayDate = analysisNow.getDate();
    const analysisTodayKey = toDateKey(
      new Date(viewDate.getFullYear(), viewDate.getMonth(), analysisTodayDate)
    );
    const analysisTodayRow = bookingsDailyMap.get(analysisTodayKey);

    analysisTodaySales =
      Number(analysisTodayRow?.tech_sales || 0) +
      Number(analysisTodayRow?.retail_sales || 0);

    analysisTodayCustomers =
      Number(analysisTodayRow?.new_customers || 0) +
      Number(analysisTodayRow?.repeat_customers || 0);
  }

  // 1日の平均（営業日ベース）
  // 売上：本日の売上が入った時だけ今日を分母に含める
  // 客数：本日の客数が入った時だけ今日を分母に含める
  const analysisSalesEndDay = analysisSameMonth
    ? (analysisTodaySales > 0 ? analysisTodayDate : analysisTodayDate - 1)
    : analysisLastDay;

  const analysisCustomersEndDay = analysisSameMonth
    ? (analysisTodayCustomers > 0 ? analysisTodayDate : analysisTodayDate - 1)
    : analysisLastDay;

  const analysisElapsedBizSales = businessDaysInRange(viewDate, 1, analysisSalesEndDay);
  const analysisElapsedBizCustomers = businessDaysInRange(viewDate, 1, analysisCustomersEndDay);

  const avgDaySales = analysisElapsedBizSales > 0 ? (sumSales / analysisElapsedBizSales) : 0;
  const avgDayCustomers = analysisElapsedBizCustomers > 0 ? (sumCustomers / analysisElapsedBizCustomers) : 0;

  // 前半・後半の売上合計
  let firstHalfSales = 0;
  let secondHalfSales = 0;

  for (let day = 1; day <= analysisLastDay; day++){
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const key = toDateKey(d);
    const row = bookingsDailyMap.get(key);
    if (!row) continue;

    const daySales = Number(row.tech_sales || 0) + Number(row.retail_sales || 0);

    if (day <= 15){
      firstHalfSales += daySales;
    } else {
      secondHalfSales += daySales;
    }
  }

  // 前半・後半の営業日数（平均用）
  const firstHalfBizTotal = businessDaysInRange(viewDate, 1, 15);
  const secondHalfBizTotal = businessDaysInRange(viewDate, 16, analysisLastDay);

  let firstHalfDiv = firstHalfBizTotal;
  let secondHalfDiv = secondHalfBizTotal;

  if (analysisSameMonth){
    if (analysisTodayDate <= 15){
      // 前半の途中
      const firstHalfEndDay = analysisTodaySales > 0 ? analysisTodayDate : analysisTodayDate - 1;
      firstHalfDiv = businessDaysInRange(viewDate, 1, firstHalfEndDay);
      secondHalfDiv = 0;
    } else {
      // 後半の途中
      firstHalfDiv = firstHalfBizTotal;
      const secondHalfEndDay = analysisTodaySales > 0 ? analysisTodayDate : analysisTodayDate - 1;
      secondHalfDiv = businessDaysInRange(viewDate, 16, secondHalfEndDay);
    }
  }

  const firstHalfAvgSales = firstHalfDiv > 0 ? (firstHalfSales / firstHalfDiv) : 0;
  const secondHalfAvgSales = secondHalfDiv > 0 ? (secondHalfSales / secondHalfDiv) : 0;

  // 月の予想
  const projectedSales = avgDaySales * analysisMonthBizTotal;
  const projectedCustomers = avgDayCustomers * analysisMonthBizTotal;

  // DOM反映（分析パネルは小数点第1位まで）
  if (elAvgDaySales) elAvgDaySales.textContent = avgDaySales ? fmtYen1(avgDaySales) : "—";
  if (elAvgDayCustomers) elAvgDayCustomers.textContent = avgDayCustomers ? (fmtNum1(avgDayCustomers) + "名") : "—";

  if (elFirstHalfSales) elFirstHalfSales.textContent = firstHalfSales ? fmtYen1(firstHalfSales) : "—";
  if (elSecondHalfSales) elSecondHalfSales.textContent = secondHalfSales ? fmtYen1(secondHalfSales) : "—";

  if (elFirstHalfAvgSales) elFirstHalfAvgSales.textContent = firstHalfAvgSales ? fmtYen1(firstHalfAvgSales) : "—";
  if (elSecondHalfAvgSales) elSecondHalfAvgSales.textContent = secondHalfAvgSales ? fmtYen1(secondHalfAvgSales) : "—";

  if (elProjectedSales) elProjectedSales.textContent = projectedSales ? fmtYen1(projectedSales) : "—";
  if (elProjectedCustomers) elProjectedCustomers.textContent = projectedCustomers ? (fmtNum1(projectedCustomers) + "名") : "—";
  
  updateRings(sumSales, unitPrice, goalSales, goalUnitPrice);
}

/* ===== Day Editor ===== */
function fill0toMaxSelect(sel, max){
  if(!sel) return;
  sel.innerHTML = "";
  for(let i=0;i<=max;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    sel.appendChild(opt);
  }
}

async function openDayEditor(date){
  const d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
  editingDayKey = toDateKey(d);

  if(dayTitle){
    dayTitle.textContent = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;
  }

  // iPad(store-like) hides sales section
  const storeMode = isStoreLikeDevice();
  if(salesSection) salesSection.style.display = storeMode ? "none" : "";

  // load staffs + daily data
  const staffRows = await fetchStaffsActive();
  const dailyStaff = await fetchBookingsStaffDay(editingDayKey);
  const daily = await fetchBookingsDailyDay(editingDayKey);

  editingStaffRows = staffRows;
  editingStaffCountMap = new Map((dailyStaff||[]).map(r => [r.staff_id, Number(r.count||0)]));

  // init totals UI
  const getTotal = () => staffRows.reduce((sum, s) => sum + Number(editingStaffCountMap.get(s.id)||0), 0);
  const renderTotal = () => {
    const t = getTotal();
    if(totalCountDisplay) totalCountDisplay.textContent = String(t);
    if(totalCountSelect) totalCountSelect.value = String(t);
  };

  // render staff cards
  if(staffInputs){
    staffInputs.innerHTML = "";

    const makeCard = (s) => {
      const card = document.createElement("div");
      card.className = "staffCard";
      card.dataset.staff = String(s.id);

      const top = document.createElement("div");
      top.className = "staffCardTop";

      const name = document.createElement("div");
      name.className = "staffCardName";
      name.textContent = s.name;

      const small = document.createElement("div");
      small.className = "staffCardCount";

      top.appendChild(name);
      top.appendChild(small);

      const stepper = document.createElement("div");
      stepper.className = "stepper";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "stepBtn";
      minus.textContent = "−";

      const val = document.createElement("div");
      val.className = "stepValue";

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "stepBtn";
      plus.textContent = "＋";

      const sync = () => {
        const v = Number(editingStaffCountMap.get(s.id)||0);
        const total = getTotal();
        minus.disabled = (v <= 0);
        plus.disabled = (total >= MAX_COUNT);
        small.textContent = String(v);
        val.textContent = String(v);
        renderTotal();
      };

      minus.addEventListener("click", ()=>{
        const v = Number(editingStaffCountMap.get(s.id)||0);
        editingStaffCountMap.set(s.id, Math.max(0, v-1));
        sync();
      });
      plus.addEventListener("click", ()=>{
        const total = getTotal();
        if(total >= MAX_COUNT) return;
        const v = Number(editingStaffCountMap.get(s.id)||0);
        editingStaffCountMap.set(s.id, Math.min(MAX_COUNT, v+1));
        sync();
      });

      stepper.appendChild(minus);
      stepper.appendChild(val);
      stepper.appendChild(plus);

      card.appendChild(top);
      card.appendChild(stepper);

      sync();
      return card;
    };

    staffRows.forEach(s => staffInputs.appendChild(makeCard(s)));
  }

  // sales inputs (PC only visible, but values can be set anyway)
  fill0toMaxSelect(newCustomersSelect, MAX_COUNT);
  fill0toMaxSelect(repeatCustomersSelect, MAX_COUNT);

  if(techSalesInput) techSalesInput.value = String(Number(daily?.tech_sales||0));
  if(retailSalesInput) retailSalesInput.value = String(Number(daily?.retail_sales||0));
  if(newCustomersSelect) newCustomersSelect.value = String(Number(daily?.new_customers||0));
  if(repeatCustomersSelect) repeatCustomersSelect.value = String(Number(daily?.repeat_customers||0));

  renderTotal();
  updateDayFormHint();
  openModal(dayModal);
}

function updateDayFormHint(){
  if (!dayFormHint) return;

  const total = Number(totalCountDisplay?.textContent || 0);
  const newCus = Number(newCustomersSelect?.value || 0);
  const repeatCus = Number(repeatCustomersSelect?.value || 0);
  const customerTotal = newCus + repeatCus;

  dayFormHint.classList.remove("ok", "ng");

  // 店舗モード（iPad）は売上欄非表示なので案内しない
  if (isStoreLikeDevice()){
  dayFormHint.style.display = "none";
  return;
} else {
  dayFormHint.style.display = "";
}

  if (customerTotal === 0){
    dayFormHint.textContent = "客数を入力してください";
    return;
  }

  if (customerTotal > total){
    dayFormHint.textContent = `客数合計（${customerTotal}名）が予約数（${total}）を超えています`;
    dayFormHint.classList.add("ng");
    return;
  }

  if (customerTotal < total){
    dayFormHint.textContent = `客数合計 ${customerTotal}名 / 予約数 ${total}（未入力があります）`;
    return;
  }

  dayFormHint.textContent = `客数合計 ${customerTotal}名 / 予約数 ${total} で一致しています`;
  dayFormHint.classList.add("ok");
}
async function saveDay(goNext = false){
  if(!editingDayKey) return;

  try{
    daySaveBtn.disabled = true;
    daySaveBtn.textContent = "保存中...";

    const storeMode = isStoreLikeDevice();

    // staff daily upsert
    let total = 0;
    const rows = editingStaffRows.map(s=>{
      const v = Number(editingStaffCountMap.get(s.id)||0);
      total += v;
      return {
        day: editingDayKey,
        staff_id: s.id,
        count: v,
        updated_by: storeMode ? "ipad" : "pc"
      };
    });

    const r1 = await sb
      .from("bookings_staff_daily")
      .upsert(rows, { onConflict: "day,staff_id" });
    if(r1.error) throw r1.error;

    // bookings_daily upsert
    if(storeMode){
      // iPad: keep sales fields if exist; otherwise 0
      const existing = await fetchBookingsDailyDay(editingDayKey);
      const payload = {
        day: editingDayKey,
        total,
        tech_sales: Number(existing?.tech_sales||0),
        retail_sales: Number(existing?.retail_sales||0),
        new_customers: Number(existing?.new_customers||0),
        repeat_customers: Number(existing?.repeat_customers||0),
        updated_by: "ipad"
      };

      const r2 = await sb.from("bookings_daily").upsert([payload], { onConflict: "day" });
      if(r2.error) throw r2.error;
    }else{
      const tech = Number(techSalesInput?.value || 0);
      const retail = Number(retailSalesInput?.value || 0);
      const nCus = Number(newCustomersSelect?.value || 0);
      const rCus = Number(repeatCustomersSelect?.value || 0);

      const payload = {
        day: editingDayKey,
        total,
        tech_sales: tech,
        retail_sales: retail,
        new_customers: nCus,
        repeat_customers: rCus,
        updated_by: "pc"
      };

      const r2 = await sb.from("bookings_daily").upsert([payload], { onConflict: "day" });
      if(r2.error) throw r2.error;
    }

    closeModal(dayModal);
await loadAndRender();

if (goNext){
  const current = editingDayKey ? new Date(editingDayKey + "T00:00:00") : new Date();
  const next = new Date(current.getFullYear(), current.getMonth(), current.getDate());

  // 次の営業日を探す
  for (let i = 0; i < 40; i++){
    next.setDate(next.getDate() + 1);
    if (!isClosedDay(next)) break;
  }

  // 同じ月内ならそのまま開く
  if (
    next.getFullYear() === viewDate.getFullYear() &&
    next.getMonth() === viewDate.getMonth()
  ){
    await openDayEditor(next);
  } else {
    alert("保存しました");
  }
} else {
  alert("保存しました");
}
  }catch(e){
    console.error(e);
    alert("保存で止まりました: " + (e?.message || e));
  }finally{
    daySaveBtn.disabled = false;
    daySaveBtn.textContent = "保存";
  }
}

/* ===== CSV ===== */
function exportCsv(){
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);

  const rows = [];
  rows.push(["day","total","tech_sales","retail_sales","new_customers","repeat_customers"].join(","));

  for(let day=1; day<=last.getDate(); day++){
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    const key = toDateKey(d);
    const row = bookingsDailyMap.get(key) || {};
    rows.push([
      key,
      Number(row.total||0),
      Number(row.tech_sales||0),
      Number(row.retail_sales||0),
      Number(row.new_customers||0),
      Number(row.repeat_customers||0),
    ].join(","));
  }

  const blob = new Blob([rows.join("\n")], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bookings_${toMonthKey(viewDate)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ===== Settings (PIN + staff manager minimal) ===== */
async function loadPin(){ return localStorage.getItem(KEY_LOCAL_PIN) || DEFAULT_PIN; }
async function savePin(pin){ localStorage.setItem(KEY_LOCAL_PIN, pin); }

let pinOk = false;
let staffsAll = [];

function renderStaffList(){
  if(!staffList) return;
  staffList.innerHTML = "";

  const getSort = (s) => Number(s.sort_order ?? s.sort ?? 0);

  staffsAll.sort((a,b)=> getSort(a) - getSort(b));

  staffsAll.forEach((s, idx)=>{
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
      const prev = staffsAll[idx-1];
      const cur = staffsAll[idx];
      const prevSort = getSort(prev);
      const curSort = getSort(cur);

      await updateStaff(prev.id, { sort_order: curSort, sort: curSort });
      await updateStaff(cur.id,  { sort_order: prevSort, sort: prevSort });

      staffsAll = await fetchStaffsAll();
      renderStaffList();
    };

    const down = document.createElement("button");
    down.className = "smallBtn";
    down.type = "button";
    down.textContent = "↓";
    down.disabled = (idx===staffsAll.length-1);
    down.onclick = async ()=>{
      const next = staffsAll[idx+1];
      const cur = staffsAll[idx];
      const nextSort = getSort(next);
      const curSort = getSort(cur);

      await updateStaff(next.id, { sort_order: curSort, sort: curSort });
      await updateStaff(cur.id,  { sort_order: nextSort, sort: nextSort });

      staffsAll = await fetchStaffsAll();
      renderStaffList();
    };

    const toggle = document.createElement("button");
    toggle.className = "smallBtn off";
    toggle.type = "button";
    toggle.textContent = s.active ? "無効" : "有効";
    toggle.onclick = async ()=>{
      await updateStaff(s.id, { active: !s.active });
      staffsAll = await fetchStaffsAll();
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
  const input = (pinInput?.value||"").trim();

  if(input !== pin){
    alert("PINが違います");
    return;
  }

  pinOk = true;
  if(settingsArea) settingsArea.classList.remove("hidden");

  try{
    staffsAll = await fetchStaffsAll();
  }catch(e){
    console.error(e);
    alert("staffsの取得でエラー: " + (e?.message || e));
    staffsAll = [];
  }
  renderStaffList();
}

async function addStaff(){
  if(!pinOk) return;
  const name = (staffNameInput?.value||"").trim();
  if(!name) return;

  const getSort = (s) => Number(s.sort_order ?? s.sort ?? 0);
  const maxSort = Math.max(0, ...staffsAll.map(getSort));
  const id = crypto.randomUUID();

  await upsertStaff({
    id,
    name,
    active: true,
    sort_order: maxSort + 1,
    sort: maxSort + 1,
  });

  if(staffNameInput) staffNameInput.value = "";
  staffsAll = await fetchStaffsAll();
  renderStaffList();
}

async function changePin(){
  if(!pinOk) return;
  const np = (newPinInput?.value||"").trim();
  if(np.length < 4){
    alert("PINは4桁以上を推奨します");
    return;
  }
  await savePin(np);
  alert("PINを変更しました");
  if(newPinInput) newPinInput.value = "";
}

/* ===== Store Board (memo/tasks + shared photo) =====
  NOTE: If your table/bucket doesn't exist, it won't crash.
*/
function initStoreBoardSafe(){
  const memoDateSelect = document.getElementById("memoDateSelect");
  const memoText = document.getElementById("memoText");
  const memoAddBtn = document.getElementById("memoAddBtn");
  const memoClearInputBtn = document.getElementById("memoClearInputBtn");
  const taskList = document.getElementById("taskList");

  const photoFile = document.getElementById("photoFile");
  const photoUploadBtn = document.getElementById("photoUploadBtn");
  const photoDeleteBtn = document.getElementById("photoDeleteBtn");
  const photoPreview = document.getElementById("photoPreview");

  if(!memoDateSelect || !memoText || !memoAddBtn || !memoClearInputBtn || !taskList) return;

  const STORE_ID = "default";
  const TASK_TABLE = "store_tasks"; // 既にある前提。無ければガードで落ちない
  const BUCKET = "storeboard";
  const PHOTO_PATH = `${STORE_ID}/shared.jpg`;

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

  function fillMemoDates(){
    const today = new Date();
    memoDateSelect.innerHTML = "";
    for(let i=0;i<90;i++){
      const d = new Date(today);
      d.setDate(today.getDate()+i);
      const opt = document.createElement("option");
      opt.value = toDateKey(d);
      opt.textContent = `${formatJP(d)}（${opt.value}）`;
      memoDateSelect.appendChild(opt);
    }
  }

  function setPhotoPlaceholder(){
    if(photoPreview) photoPreview.innerHTML = `<div class="hint">プレビュー</div>`;
  }
  function bust(url){
    const sep = url.includes("?") ? "&" : "?";
    return url + sep + "t=" + Date.now();
  }

  async function fetchTasks(){
    const day = memoDateSelect.value;
    const res = await sb
      .from(TASK_TABLE)
      .select("id,text,done,created_at")
      .eq("store_id", STORE_ID)
      .eq("day", day)
      .order("created_at", { ascending:false });

    if(res.error){
      console.warn("store_tasks load error:", res.error);
      taskList.innerHTML = `<div class="hint">メモ機能（store_tasks）が未設定の可能性があります</div>`;
      return [];
    }
    return res.data || [];
  }

  async function renderTasks(){
    const tasks = await fetchTasks();
    if(!tasks.length){
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
    if(!text) return;

    const day = memoDateSelect.value;
    const res = await sb.from(TASK_TABLE).insert([{
      store_id: STORE_ID,
      day,
      text,
      done: false,
      updated_by: isStoreLikeDevice() ? "ipad" : "pc",
    }]);

    if(res.error){
      alert("メモの追加でエラー: " + res.error.message);
      return;
    }
    memoText.value = "";
    await renderTasks();
  }

  async function setDone(id, done){
    const res = await sb.from(TASK_TABLE)
      .update({ done })
      .eq("id", id)
      .eq("store_id", STORE_ID);
    if(res.error){
      alert("更新でエラー: " + res.error.message);
      return;
    }
    await renderTasks();
  }

  async function deleteTask(id){
    const res = await sb.from(TASK_TABLE)
      .delete()
      .eq("id", id)
      .eq("store_id", STORE_ID);
    if(res.error){
      alert("削除でエラー: " + res.error.message);
      return;
    }
    await renderTasks();
  }

  taskList.addEventListener("click", async (e)=>{
    const item = e.target.closest(".taskItem");
    if(!item) return;
    const id = item.getAttribute("data-id");

    if(e.target.closest(".taskDelBtn")){
      await deleteTask(id);
      return;
    }
    if(e.target.classList.contains("taskChk")){
      await setDone(id, e.target.checked);
    }
  });

  async function loadPhoto(){
    if(!photoPreview) return;
    try{
      const { data } = sb.storage.from(BUCKET).getPublicUrl(PHOTO_PATH);
      const url = data?.publicUrl;
      if(!url){ setPhotoPlaceholder(); return; }
      photoPreview.innerHTML = `<img src="${bust(url)}" alt="写真プレビュー" />`;
      const img = photoPreview.querySelector("img");
      img.onerror = () => setPhotoPlaceholder();
    }catch(e){
      console.warn("storage not available:", e);
      setPhotoPlaceholder();
    }
  }

  async function uploadPhoto(){
    if(!photoFile) return;
    const file = photoFile.files?.[0];
    if(!file) return;

    const res = await sb.storage.from(BUCKET).upload(PHOTO_PATH, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "image/jpeg"
    });

    if(res.error){
      alert("写真アップロードでエラー: " + res.error.message);
      return;
    }
    photoFile.value = "";
    await loadPhoto();
  }

  async function deletePhoto(){
    if(!confirm("写真を削除しますか？")) return;
    const res = await sb.storage.from(BUCKET).remove([PHOTO_PATH]);
    if(res.error){
      alert("写真削除でエラー: " + res.error.message);
      return;
    }
    if(photoFile) photoFile.value = "";
    setPhotoPlaceholder();
  }

  // wire
  fillMemoDates();
  memoAddBtn.addEventListener("click", addTask);
  memoClearInputBtn.addEventListener("click", ()=>{ memoText.value=""; memoText.focus(); });
  memoDateSelect.addEventListener("change", renderTasks);

  photoUploadBtn?.addEventListener("click", uploadPhoto);
  photoDeleteBtn?.addEventListener("click", deletePhoto);

  renderTasks();
  loadPhoto();
}

/* ===== Main load ===== */
async function loadAndRender(){
  // Repair viewDate safety
  if(!(viewDate instanceof Date) || isNaN(viewDate.getTime())){
    viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }

  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);
  currentMonthKey = toMonthKey(first);

  // load goals
  const goals = await loadGoals(currentMonthKey);
  monthGoalCustomers = goals.goalCustomers ?? DEFAULT_GOAL_CUSTOMERS;
  monthGoalUnitPrice = goals.goalUnitPrice ?? DEFAULT_GOAL_UNIT_PRICE;

  // load month daily bookings
  const startKey = toDateKey(first);
  const endKey = toDateKey(last);

  let rows = [];
  try{
    rows = await fetchBookingsDailyRange(startKey, endKey);
  }catch(e){
    console.error(e);
    alert("bookings_daily 取得でエラー: " + (e?.message || e));
    rows = [];
  }

  bookingsDailyMap = new Map();
  for(const r of rows){
    bookingsDailyMap.set(r.day, {
      total: Number(r.total||0),
      tech_sales: Number(r.tech_sales||0),
      retail_sales: Number(r.retail_sales||0),
      new_customers: Number(r.new_customers||0),
      repeat_customers: Number(r.repeat_customers||0),
    });
  }

  renderCalendar();
  renderSummaryAndPanel();
  applyDeviceVisibility();
}

/* ===== Events ===== */
btnPrev?.addEventListener("click", async ()=>{
  viewDate = addMonths(viewDate, -1);
  await loadAndRender();
});
btnNext?.addEventListener("click", async ()=>{
  viewDate = addMonths(viewDate, +1);
  await loadAndRender();
});

btnExport?.addEventListener("click", exportCsv);

btnSettings?.addEventListener("click", ()=> openModal(settingsModal));
settingsCloseBtn?.addEventListener("click", ()=> closeModal(settingsModal));
settingsCloseBtn2?.addEventListener("click", ()=> closeModal(settingsModal));

pinEnterBtn?.addEventListener("click", enterPin);
staffAddBtn?.addEventListener("click", addStaff);
pinChangeBtn?.addEventListener("click", changePin);

dayCloseBtn?.addEventListener("click", ()=> closeModal(dayModal));
daySaveBtn?.addEventListener("click", ()=> saveDay(false));
daySaveNextBtn?.addEventListener("click", ()=> saveDay(true));

dayModal?.addEventListener("keydown", (e)=>{
  if (e.key === "Escape"){
    e.preventDefault();
    closeModal(dayModal);
    return;
  }

  // Ctrl+Enter または Cmd+Enter で保存
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){
    e.preventDefault();
    saveDay(false);
  }
});
newCustomersSelect?.addEventListener("change", updateDayFormHint);
repeatCustomersSelect?.addEventListener("change", updateDayFormHint);

// backdrop close
document.querySelectorAll('.modalBackdrop[data-close]').forEach(backdrop=>{
  backdrop.addEventListener("click", (e)=>{
    if(e.target !== e.currentTarget) return;
    const id = e.currentTarget.getAttribute("data-close");
    const modal = document.getElementById(id);
    if(modal) closeModal(modal);
  });
});

// goal modal
goalEditBtn?.addEventListener("click", ()=>{
  if(goalCustomersInput) goalCustomersInput.value = String(monthGoalCustomers ?? 0);
  if(goalUnitPriceInput) goalUnitPriceInput.value = String(monthGoalUnitPrice ?? 0);
  openModal(goalModal);
});
goalCloseBtn?.addEventListener("click", ()=> closeModal(goalModal));
goalSaveBtn?.addEventListener("click", async ()=>{
  try{
    const gc = Number(goalCustomersInput?.value || 0);
    const gu = Number(goalUnitPriceInput?.value || 0);
    const saved = await saveGoals(currentMonthKey, gc, gu, isStoreLikeDevice() ? "ipad" : "pc");

    monthGoalCustomers = saved.goalCustomers;
    monthGoalUnitPrice = saved.goalUnitPrice;

    closeModal(goalModal);
    await loadAndRender();
    alert("保存しました");
  }catch(e){
    console.error(e);
    alert("目標の保存で止まりました: " + (e?.message || e));
  }
});

// reload on focus (PC confirm)
window.addEventListener("focus", ()=>{
  setTimeout(()=> loadAndRender(), 150);
});

/* ===== Boot ===== */
initStoreBoardSafe();
loadAndRender();
