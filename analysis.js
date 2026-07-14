/* =========================
  COMFORT 売上分析ページ
========================= */

/* ===== Supabase ===== */
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase設定が読み込めていません（config.jsを確認してください）"
  );
}

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* ===== Utils ===== */
const pad2 = (n) => String(n).padStart(2, "0");

const toMonthKey = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

const toDateKey = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d, diff) {
  return new Date(d.getFullYear(), d.getMonth() + diff, 1);
}

function fmtYen(n) {
  const value = Math.max(0, Math.floor(Number(n || 0)));
  return value.toLocaleString("ja-JP") + "円";
}

function fmtNum(n) {
  const value = Math.max(0, Math.floor(Number(n || 0)));
  return value.toLocaleString("ja-JP");
}

function fmtNum1(n) {
  return Number(n || 0).toLocaleString("ja-JP", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

/* ===== 定休日 ===== */
function isClosedDay(date) {
  const dow = date.getDay();

  if (dow === 1) return true;

  if (dow === 2) {
    const weekIndex =
      Math.floor((date.getDate() - 1) / 7) + 1;

    if (weekIndex === 1 || weekIndex === 3) {
      return true;
    }
  }

  return false;
}

function businessDaysInRange(baseDate, startDay, endDay) {
  const lastDay = endOfMonth(baseDate).getDate();
  const safeStart = Math.max(1, startDay);
  const safeEnd = Math.min(lastDay, endDay);

  if (safeEnd < safeStart) return 0;

  let count = 0;

  for (let day = safeStart; day <= safeEnd; day++) {
    const d = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      day
    );

    if (!isClosedDay(d)) {
      count++;
    }
  }

  return count;
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

const elAvgDaySales =
  document.getElementById("avgDaySales");

const elAvgDayCustomers =
  document.getElementById("avgDayCustomers");

const elFirstHalfSales =
  document.getElementById("firstHalfSales");

const elSecondHalfSales =
  document.getElementById("secondHalfSales");

const elFirstHalfAvgSales =
  document.getElementById("firstHalfAvgSales");

const elSecondHalfAvgSales =
  document.getElementById("secondHalfAvgSales");

const elProjectedSales =
  document.getElementById("projectedSales");

const elProjectedCustomers =
  document.getElementById("projectedCustomers");

const elWeeklySummaryBox =
  document.getElementById("weeklySummaryBox");

/* ===== State ===== */
let bookingsDailyMap = new Map();
let dailyMenuMap = new Map();
let monthStaffSalesMap = new Map();
let monthlyCompareMap = new Map();
let yearlyBookingsDailyMap = new Map();

let yoySalesChartInstance = null;

/* ===== 表示月 ===== */
function getInitialMonth() {
  const params = new URLSearchParams(location.search);
  const month = params.get("month");

  if (/^\d{4}-\d{2}$/.test(month || "")) {
    const [year, monthNumber] =
      month.split("-").map(Number);

    return new Date(year, monthNumber - 1, 1);
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

function updateMonthUrl() {
  history.replaceState(
    null,
    "",
    `analysis.html?month=${toMonthKey(viewDate)}`
  );
}

/* ===== データ取得 ===== */
async function loadBookingsDaily() {
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);

  const { data, error } = await sb
    .from("bookings_daily")
    .select(
      "day,total,tech_sales,retail_sales,new_customers,repeat_customers"
    )
    .gte("day", toDateKey(first))
    .lte("day", toDateKey(last));

  if (error) throw error;

  bookingsDailyMap = new Map();

  for (const row of data || []) {
    bookingsDailyMap.set(row.day, {
      total: Number(row.total || 0),
      tech_sales: Number(row.tech_sales || 0),
      retail_sales: Number(row.retail_sales || 0),
      new_customers: Number(row.new_customers || 0),
      repeat_customers: Number(row.repeat_customers || 0)
    });
  }
}

async function loadDailyMenus() {
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);

  const { data, error } = await sb
    .from("sales_staff_daily")
    .select("day,menus")
    .gte("day", toDateKey(first))
    .lte("day", toDateKey(last));

  if (error) throw error;

  dailyMenuMap = new Map();

  for (const row of data || []) {
    const current =
      dailyMenuMap.get(row.day) || {
        soda: 0,
        ptreat: 0,
        treat: 0,
        spa: 0
      };

    const menu = row.menus || {};

    current.soda += Number(menu.soda || 0);
    current.ptreat += Number(menu.ptreat || 0);
    current.treat += Number(menu.treat || 0);
    current.spa += Number(menu.spa || 0);

    dailyMenuMap.set(row.day, current);
  }
}

async function loadStaffSales() {
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);

  const { data, error } = await sb
    .from("sales_staff_daily")
    .select(
      "day,staff_name,tech_sales,retail_sales,customers,menus"
    )
    .gte("day", toDateKey(first))
    .lte("day", toDateKey(last));

  if (error) throw error;

  monthStaffSalesMap = new Map();

  for (const row of data || []) {
    const name = String(row.staff_name || "")
      .replace(/[ 　]/g, "")
      .trim();

    if (!name) continue;

    const current =
      monthStaffSalesMap.get(name) || {
        tech: 0,
        retail: 0,
        customers: 0,
        menus: {
          color: 0,
          soda: 0,
          ptreat: 0,
          treat: 0,
          spa: 0
        }
      };

    current.tech += Number(row.tech_sales || 0);
    current.retail += Number(row.retail_sales || 0);
    current.customers += Number(row.customers || 0);

    const menu = row.menus || {};

    current.menus.color += Number(menu.color || 0);
    current.menus.soda += Number(menu.soda || 0);
    current.menus.ptreat += Number(menu.ptreat || 0);
    current.menus.treat += Number(menu.treat || 0);
    current.menus.spa += Number(menu.spa || 0);

    monthStaffSalesMap.set(name, current);
  }
}

async function loadMonthlyCompare() {
  const currentYear = viewDate.getFullYear();

  const { data, error } = await sb
    .from("monthly_compare")
    .select("month_key,sales,customers,new_customers")
    .gte("month_key", `${currentYear - 1}-01`)
    .lte("month_key", `${currentYear}-12`)
    .order("month_key", { ascending: true });

  if (error) throw error;

  monthlyCompareMap = new Map();

  for (const row of data || []) {
    monthlyCompareMap.set(row.month_key, {
      sales: Number(row.sales || 0),
      customers: Number(row.customers || 0),
      new_customers: Number(row.new_customers || 0)
    });
  }
}

async function loadYearlyBookings() {
  const currentYear = viewDate.getFullYear();

  const { data, error } = await sb
    .from("bookings_daily")
    .select(
      "day,tech_sales,retail_sales,new_customers,repeat_customers"
    )
    .gte("day", `${currentYear}-01-01`)
    .lte("day", `${currentYear}-12-31`);

  if (error) throw error;

  yearlyBookingsDailyMap = new Map();

  for (const row of data || []) {
    yearlyBookingsDailyMap.set(row.day, {
      tech_sales: Number(row.tech_sales || 0),
      retail_sales: Number(row.retail_sales || 0),
      new_customers: Number(row.new_customers || 0),
      repeat_customers: Number(row.repeat_customers || 0)
    });
  }
}

/* ===== 基本分析 ===== */
function renderBasicAnalysis() {
  const lastDay = endOfMonth(viewDate).getDate();

  let sumSales = 0;
  let sumCustomers = 0;
  let firstHalfSales = 0;
  let secondHalfSales = 0;

  for (let day = 1; day <= lastDay; day++) {
    const key = toDateKey(
      new Date(
        viewDate.getFullYear(),
        viewDate.getMonth(),
        day
      )
    );

    const row = bookingsDailyMap.get(key);

    if (!row) continue;

    const daySales =
      Number(row.tech_sales || 0) +
      Number(row.retail_sales || 0);

    const dayCustomers =
      Number(row.new_customers || 0) +
      Number(row.repeat_customers || 0);

    sumSales += daySales;
    sumCustomers += dayCustomers;

    if (day <= 15) {
      firstHalfSales += daySales;
    } else {
      secondHalfSales += daySales;
    }
  }

  const now = new Date();

  const sameMonth =
    now.getFullYear() === viewDate.getFullYear() &&
    now.getMonth() === viewDate.getMonth();

  let salesEndDay = lastDay;
  let customersEndDay = lastDay;

  if (sameMonth) {
    const today = now.getDate();
    const todayKey = toDateKey(now);
    const todayRow = bookingsDailyMap.get(todayKey);

    const todaySales =
      Number(todayRow?.tech_sales || 0) +
      Number(todayRow?.retail_sales || 0);

    const todayCustomers =
      Number(todayRow?.new_customers || 0) +
      Number(todayRow?.repeat_customers || 0);

    salesEndDay = todaySales > 0 ? today : today - 1;
    customersEndDay =
      todayCustomers > 0 ? today : today - 1;
  }

  const elapsedSalesDays =
    businessDaysInRange(viewDate, 1, salesEndDay);

  const elapsedCustomerDays =
    businessDaysInRange(viewDate, 1, customersEndDay);

  const avgDaySales =
    elapsedSalesDays > 0
      ? sumSales / elapsedSalesDays
      : 0;

  const avgDayCustomers =
    elapsedCustomerDays > 0
      ? sumCustomers / elapsedCustomerDays
      : 0;

  const firstHalfTotalDays =
    businessDaysInRange(viewDate, 1, 15);

  const secondHalfTotalDays =
    businessDaysInRange(viewDate, 16, lastDay);

  let firstHalfDiv = firstHalfTotalDays;
  let secondHalfDiv = secondHalfTotalDays;

  if (sameMonth) {
    const today = now.getDate();

    if (today <= 15) {
      firstHalfDiv =
        businessDaysInRange(
          viewDate,
          1,
          salesEndDay
        );

      secondHalfDiv = 0;
    } else {
      secondHalfDiv =
        businessDaysInRange(
          viewDate,
          16,
          salesEndDay
        );
    }
  }

  const firstHalfAverage =
    firstHalfDiv > 0
      ? firstHalfSales / firstHalfDiv
      : 0;

  const secondHalfAverage =
    secondHalfDiv > 0
      ? secondHalfSales / secondHalfDiv
      : 0;

  const totalBusinessDays =
    businessDaysInRange(viewDate, 1, lastDay);

  const projectedSales =
    avgDaySales * totalBusinessDays;

  const projectedCustomers =
    avgDayCustomers * totalBusinessDays;

  elAvgDaySales.textContent =
    avgDaySales
      ? fmtYen(Math.round(avgDaySales))
      : "—";

  elAvgDayCustomers.textContent =
    avgDayCustomers
      ? `${fmtNum1(avgDayCustomers)}名`
      : "—";

  elFirstHalfSales.textContent =
    firstHalfSales
      ? fmtYen(firstHalfSales)
      : "—";

  elSecondHalfSales.textContent =
    secondHalfSales
      ? fmtYen(secondHalfSales)
      : "—";

  elFirstHalfAvgSales.textContent =
    firstHalfAverage
      ? fmtYen(Math.round(firstHalfAverage))
      : "—";

  elSecondHalfAvgSales.textContent =
    secondHalfAverage
      ? fmtYen(Math.round(secondHalfAverage))
      : "—";

  elProjectedSales.textContent =
    projectedSales
      ? fmtYen(Math.round(projectedSales))
      : "—";

  elProjectedCustomers.textContent =
    projectedCustomers
      ? `${fmtNum1(projectedCustomers)}名`
      : "—";
}

/* ===== 週別まとめ ===== */
function getWeekBucketsForMonth(baseDate) {
  const first = startOfMonth(baseDate);
  const last = endOfMonth(baseDate);
  const weeks = [];

  let cursor = new Date(first);

  cursor.setDate(
    first.getDate() - first.getDay()
  );

  while (cursor <= last) {
    const start = new Date(cursor);
    const end = new Date(cursor);

    end.setDate(start.getDate() + 6);

    const rangeStart =
      start < first
        ? new Date(first)
        : new Date(start);

    const rangeEnd =
      end > last
        ? new Date(last)
        : new Date(end);

    weeks.push({
      rangeStart,
      rangeEnd
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

function renderWeeklySummary() {
  if (!elWeeklySummaryBox) return;

  elWeeklySummaryBox.innerHTML = "";

  const weeks = getWeekBucketsForMonth(viewDate);

  weeks.forEach((week, index) => {
    const total = {
      sales: 0,
      customers: 0,
      newCustomers: 0,
      soda: 0,
      ptreat: 0,
      treat: 0,
      spa: 0
    };

    for (
      let d = new Date(week.rangeStart);
      d <= week.rangeEnd;
      d.setDate(d.getDate() + 1)
    ) {
      const key = toDateKey(d);
      const row = bookingsDailyMap.get(key) || {};
      const menu = dailyMenuMap.get(key) || {};

      total.sales +=
        Number(row.tech_sales || 0) +
        Number(row.retail_sales || 0);

      total.customers +=
        Number(row.new_customers || 0) +
        Number(row.repeat_customers || 0);

      total.newCustomers +=
        Number(row.new_customers || 0);

      total.soda += Number(menu.soda || 0);
      total.ptreat += Number(menu.ptreat || 0);
      total.treat += Number(menu.treat || 0);
      total.spa += Number(menu.spa || 0);
    }

    const card = document.createElement("div");
    card.className = "weeklyCard";

    const head = document.createElement("div");
    head.className = "weeklyCardHead";

    head.innerHTML = `
      <strong>第${index + 1}週</strong>
      <span>
        ${week.rangeStart.getMonth() + 1}/${week.rangeStart.getDate()}
        〜
        ${week.rangeEnd.getMonth() + 1}/${week.rangeEnd.getDate()}
      </span>
    `;

    const grid = document.createElement("div");
    grid.className = "weeklyGrid";

    const entries = [
      ["売上", total.sales ? fmtYen(total.sales) : "—"],
      [
        "客数",
        total.customers
          ? `${fmtNum(total.customers)}名`
          : "—"
      ],
      [
        "新規",
        total.newCustomers
          ? `${fmtNum(total.newCustomers)}名`
          : "—"
      ],
      [
        "炭酸",
        total.soda
          ? `${fmtNum(total.soda)}件`
          : "—"
      ],
      [
        "Pトリ",
        total.ptreat
          ? `${fmtNum(total.ptreat)}件`
          : "—"
      ],
      [
        "Tトリ",
        total.treat
          ? `${fmtNum(total.treat)}件`
          : "—"
      ],
      [
        "スパ",
        total.spa
          ? `${fmtNum(total.spa)}件`
          : "—"
      ]
    ];

    entries.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "weeklyItem";

      row.innerHTML =
        `<span>${label}</span><b>${value}</b>`;

      grid.appendChild(row);
    });

    card.appendChild(head);
    card.appendChild(grid);

    elWeeklySummaryBox.appendChild(card);
  });
}

/* ===== スタッフ別 ===== */
function normalizeStaffName(value) {
  return String(value || "")
    .replace(/[ 　]/g, "")
    .trim();
}

function pickStaffMonthSum(displayName) {
  const target = normalizeStaffName(displayName);

  for (const [name, value] of monthStaffSalesMap) {
    const normalized = normalizeStaffName(name);

    if (
      normalized === target ||
      normalized.startsWith(target) ||
      normalized.includes(target)
    ) {
      return value;
    }
  }

  return {
    tech: 0,
    retail: 0,
    customers: 0,
    menus: {
      color: 0,
      soda: 0,
      ptreat: 0,
      treat: 0,
      spa: 0
    }
  };
}

function getMenuRate(count, customers) {
  const customerCount = Number(customers || 0);

  if (customerCount <= 0) return 0;

  return Math.round(
    (Number(count || 0) / customerCount) * 100
  );
}

function renderStaffAnalysis() {
  const box =
    document.getElementById("staffAnalysisBox");

  if (!box) return;

  box.innerHTML = "";

  const staffOrder = [
    "北村美穂",
    "山崎錦子",
    "竹内いずみ"
  ];

  const makeSalesRow = (label, value) => {
    const row = document.createElement("div");
    row.className = "salesRow";

    row.innerHTML =
      `<span>${label}</span><b>${value}</b>`;

    return row;
  };

  const makeRing = (
    label,
    percentage,
    count,
    showCount
  ) => {
    const item = document.createElement("div");
    item.className = "menuRateItem";

    const ring = document.createElement("div");
    ring.className = "ringProgress";

    ring.style.setProperty(
      "--pct",
      String(percentage)
    );

    ring.style.setProperty(
      "--pctCut",
      String(percentage)
    );

    const inner = document.createElement("div");
    inner.className = "ringInner";

    inner.innerHTML =
      `<b>${percentage}%</b>` +
      (
        showCount
          ? `<div class="ringCount">${count}件</div>`
          : ""
      );

    ring.appendChild(inner);

    const labelElement =
      document.createElement("div");

    labelElement.className = "menuRateLabel";
    labelElement.textContent = label;

    item.appendChild(ring);
    item.appendChild(labelElement);

    return item;
  };

  const buildBlock = (
    displayName,
    value,
    withRates,
    showCounts = false
  ) => {
    const sales =
      Number(value.tech || 0) +
      Number(value.retail || 0);

    const unitPrice =
      value.customers > 0
        ? Math.floor(sales / value.customers)
        : 0;

    const block = document.createElement("div");
    block.className = "staffBlock";

    const head = document.createElement("div");
    head.className = "staffBlockHead";

    const shortName =
      displayName.startsWith("北村")
        ? "北村"
        : displayName.startsWith("山崎")
          ? "山崎"
          : displayName.startsWith("竹内")
            ? "竹内"
            : displayName;

    head.innerHTML =
      `<div class="staffName">${shortName}</div>` +
      `<div class="staffMini">月合計</div>`;

    block.appendChild(head);

    const rows = document.createElement("div");
    rows.className = "staffRows";

    rows.appendChild(
      makeSalesRow(
        "技術売上",
        value.tech ? fmtYen(value.tech) : "—"
      )
    );

    rows.appendChild(
      makeSalesRow(
        "店販売上",
        value.retail ? fmtYen(value.retail) : "—"
      )
    );

    rows.appendChild(
      makeSalesRow(
        "客数",
        value.customers
          ? `${fmtNum(value.customers)}名`
          : "—"
      )
    );

    if (withRates) {
      rows.appendChild(
        makeSalesRow(
          "客単価",
          unitPrice ? fmtYen(unitPrice) : "—"
        )
      );
    }

    block.appendChild(rows);

    if (withRates) {
      const grid = document.createElement("div");
      grid.className = "menuRateGrid";

      const menus = value.menus || {};

      grid.appendChild(
        makeRing(
          "カラー率",
          getMenuRate(
            menus.color,
            value.customers
          ),
          menus.color || 0,
          false
        )
      );

      grid.appendChild(
        makeRing(
          "炭酸率",
          getMenuRate(
            menus.soda,
            value.customers
          ),
          menus.soda || 0,
          showCounts
        )
      );

      grid.appendChild(
        makeRing(
          "Pトリ率",
          getMenuRate(
            menus.ptreat,
            value.customers
          ),
          menus.ptreat || 0,
          showCounts
        )
      );

      grid.appendChild(
        makeRing(
          "Tトリ率",
          getMenuRate(
            menus.treat,
            value.customers
          ),
          menus.treat || 0,
          false
        )
      );

      grid.appendChild(
        makeRing(
          "スパ率",
          getMenuRate(
            menus.spa,
            value.customers
          ),
          menus.spa || 0,
          showCounts
        )
      );

      block.appendChild(grid);
    }

    return block;
  };

  staffOrder.forEach((name) => {
    const value = pickStaffMonthSum(name);
    const withRates =
      name.startsWith("北村") ||
      name.startsWith("山崎");

    box.appendChild(
      buildBlock(name, value, withRates)
    );
  });

  const shopTotal = {
    tech: 0,
    retail: 0,
    customers: 0,
    menus: {
      color: 0,
      soda: 0,
      ptreat: 0,
      treat: 0,
      spa: 0
    }
  };

  for (const value of monthStaffSalesMap.values()) {
    shopTotal.tech += Number(value.tech || 0);
    shopTotal.retail += Number(value.retail || 0);
    shopTotal.customers += Number(
      value.customers || 0
    );

    shopTotal.menus.color += Number(
      value.menus?.color || 0
    );

    shopTotal.menus.soda += Number(
      value.menus?.soda || 0
    );

    shopTotal.menus.ptreat += Number(
      value.menus?.ptreat || 0
    );

    shopTotal.menus.treat += Number(
      value.menus?.treat || 0
    );

    shopTotal.menus.spa += Number(
      value.menus?.spa || 0
    );
  }

  box.appendChild(
    buildBlock(
      "店舗全体",
      shopTotal,
      true,
      true
    )
  );
}

/* ===== 前年同月比較 ===== */
function setYoY(id, current, previous, suffix) {
  const element = document.getElementById(id);

  if (!element) return;

  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);

  if (previousValue <= 0) {
    element.textContent = "—";
    return;
  }

  const difference =
    currentValue - previousValue;

  const rate =
    (currentValue / previousValue) * 100;

  const sign = difference > 0 ? "+" : "";

  element.textContent =
    `${rate.toFixed(1)}% ` +
    `(${sign}${difference.toLocaleString("ja-JP")}${suffix})`;
}

function renderYearOnYear() {
  let sales = 0;
  let customers = 0;
  let newCustomers = 0;

  for (const row of bookingsDailyMap.values()) {
    sales +=
      Number(row.tech_sales || 0) +
      Number(row.retail_sales || 0);

    customers +=
      Number(row.new_customers || 0) +
      Number(row.repeat_customers || 0);

    newCustomers += Number(
      row.new_customers || 0
    );
  }

  const previousMonthKey =
    `${viewDate.getFullYear() - 1}-` +
    `${pad2(viewDate.getMonth() + 1)}`;

  const previous =
    monthlyCompareMap.get(previousMonthKey);

  if (!previous) {
    [
      "yoySales",
      "yoyCustomers",
      "yoyNewCustomers",
      "yoyUnitPrice"
    ].forEach((id) => {
      const element = document.getElementById(id);

      if (element) element.textContent = "—";
    });

    return;
  }

  const currentUnitPrice =
    customers > 0
      ? Math.floor(sales / customers)
      : 0;

  const previousUnitPrice =
    previous.customers > 0
      ? Math.floor(
          previous.sales /
          previous.customers
        )
      : 0;

  setYoY(
    "yoySales",
    sales,
    previous.sales,
    "円"
  );

  setYoY(
    "yoyCustomers",
    customers,
    previous.customers,
    "名"
  );

  setYoY(
    "yoyNewCustomers",
    newCustomers,
    previous.new_customers,
    "名"
  );

  setYoY(
    "yoyUnitPrice",
    currentUnitPrice,
    previousUnitPrice,
    "円"
  );
}

/* ===== 月別売上比較グラフ ===== */
function getCurrentYearMonthlySales() {
  const monthly = Array(12).fill(0);

  for (
    const [dayKey, row]
    of yearlyBookingsDailyMap.entries()
  ) {
    const date = new Date(`${dayKey}T00:00:00`);

    monthly[date.getMonth()] +=
      Number(row.tech_sales || 0) +
      Number(row.retail_sales || 0);
  }

  return monthly;
}

function getPreviousYearMonthlySales() {
  const previousYear =
    viewDate.getFullYear() - 1;

  const monthly = Array(12).fill(0);

  for (
    const [monthKey, row]
    of monthlyCompareMap.entries()
  ) {
    const [year, month] =
      monthKey.split("-").map(Number);

    if (year !== previousYear) continue;

    monthly[month - 1] =
      Number(row.sales || 0);
  }

  return monthly;
}

function renderSalesChart() {
  const canvas =
    document.getElementById("yoySalesChart");

  if (
    !canvas ||
    typeof Chart === "undefined"
  ) {
    return;
  }

  if (yoySalesChartInstance) {
    yoySalesChartInstance.destroy();
  }

  const currentYear =
    viewDate.getFullYear();

  const previousYear =
    currentYear - 1;

  yoySalesChartInstance = new Chart(
    canvas,
    {
      type: "line",

      data: {
        labels: [
          "1月",
          "2月",
          "3月",
          "4月",
          "5月",
          "6月",
          "7月",
          "8月",
          "9月",
          "10月",
          "11月",
          "12月"
        ],

        datasets: [
          {
            label: `${previousYear}年`,
            data: getPreviousYearMonthlySales(),
            borderWidth: 2,
            tension: 0.32,
            fill: false
          },
          {
            label: `${currentYear}年`,
            data: getCurrentYearMonthlySales(),
            borderWidth: 3,
            tension: 0.32,
            fill: false
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          mode: "index",
          intersect: false
        },

        plugins: {
          legend: {
            display: true,
            position: "top"
          },

          tooltip: {
            callbacks: {
              label(context) {
                const value =
                  Number(context.parsed.y || 0);

                return (
                  `${context.dataset.label}: ` +
                  `${value.toLocaleString("ja-JP")}円`
                );
              }
            }
          }
        },

        scales: {
          y: {
            beginAtZero: true,

            ticks: {
              callback(value) {
                return (
                  Number(value).toLocaleString("ja-JP") +
                  "円"
                );
              }
            }
          }
        }
      }
    }
  );
}

/* ===== 全体描画 ===== */
async function loadAndRenderAnalysis() {
  renderMonthTitle();

  if (analysisStatus) {
    analysisStatus.textContent =
      "分析データを読み込んでいます…";
  }

  try {
    await Promise.all([
      loadBookingsDaily(),
      loadDailyMenus(),
      loadStaffSales(),
      loadMonthlyCompare(),
      loadYearlyBookings()
    ]);

    renderBasicAnalysis();
    renderWeeklySummary();
    renderStaffAnalysis();
    renderYearOnYear();
    renderSalesChart();

    if (analysisStatus) {
      analysisStatus.textContent =
        "分析データを表示しました。";
    }
  } catch (error) {
    console.error("分析データ取得エラー:", error);

    if (analysisStatus) {
      analysisStatus.textContent =
        "分析データの読み込みに失敗しました。";
    }

    alert(
      "分析データの読み込みでエラーが発生しました：" +
      (error?.message || error)
    );
  }
}

/* ===== 表示制御 ===== */
async function showAnalysisPage() {
  analysisAppShell?.classList.remove("hidden");
  analysisAuthMessage?.classList.add("hidden");
  analysisLogoutBtn?.classList.remove("hidden");

  await loadAndRenderAnalysis();
}

function showLoginMessage() {
  analysisAppShell?.classList.add("hidden");
  analysisAuthMessage?.classList.remove("hidden");
  analysisLogoutBtn?.classList.add("hidden");
}

async function checkLogin() {
  const {
    data: { session },
    error
  } = await sb.auth.getSession();

  if (error || !session) {
    showLoginMessage();
    return;
  }

  await showAnalysisPage();
}

/* ===== Events ===== */
backToCalendarBtn?.addEventListener(
  "click",
  () => {
    window.location.href =
      `index.html?month=${toMonthKey(viewDate)}`;
  }
);

goToLoginBtn?.addEventListener(
  "click",
  () => {
    window.location.href = "index.html";
  }
);

analysisPrevBtn?.addEventListener(
  "click",
  async () => {
    viewDate = addMonths(viewDate, -1);

    updateMonthUrl();
    await loadAndRenderAnalysis();
  }
);

analysisNextBtn?.addEventListener(
  "click",
  async () => {
    viewDate = addMonths(viewDate, 1);

    updateMonthUrl();
    await loadAndRenderAnalysis();
  }
);

analysisLogoutBtn?.addEventListener(
  "click",
  async () => {
    await sb.auth.signOut();

    window.location.href = "index.html";
  }
);

/* ===== Start ===== */
checkLogin();
