/* =========================
   サロン予約カレンダー（クラウド同期版）
   - 日付ごと「合計予約数」だけ表示（0〜20）
   - 入力画面：合計予約数を大きく
   - スタッフ別メモは小さく（数の入力は合計のみ）
   - スタッフ管理（追加/編集/並び替え/有効無効）
   - 設定画面はPIN（デフォルト 4043）
   - 定休日：毎週月曜 + 第1火曜 + 第3火曜
   - Supabase: bookings(date=YYYY-MM, data=月データJSON), staffs
========================= */

/* ======== Supabase設定（ここだけあなたの値に変更） ======== */
const SUPABASE_URL = https://ujfgmuhwmaauioeueyep.supabase.co";       // 例: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = sb_publishable_8xbjrHfOxAzaidTzX7S6fA_mxEE0pFD;     // 例: sb_publishable_...
/* ============================================================ */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ======== アプリ基本設定 ======== */
const MAX_COUNT = 20;
const DEFAULT_PIN = "4043";

const KEY_PIN_HASH = "salonBooking_pin_hash_v1";
const KEY_LOCAL_FALLBACK = "salonBooking_local_fallback_v1"; // 万一の退避用（普段は使わない）
const WEEKDAYS = ["日","月","火","水","木","金","土"];

/* ======== DOM取得（index.htmlにこれらIDがある前提） ======== */
const elCalendar = document.getElementById("calendar");
const elMonthTitle = document.getElementById("monthTitle");
const btnPrev = document.getElementById("prevBtn");
const btnNext = document.getElementById("nextBtn");
const btnExport = document.getElementById("exportCsvBtn");
const btnSettings = document.getElementById("settingsBtn");

/* ======== 状態 ======== */
let viewDate = new Date(); // 表示中の月
viewDate.setDate(1);

let state = {
  // 月データ：{ "YYYY-MM-DD": { count:number, memo:string, staffMemo:{staffId:string} } }
  daily: {},
  staffs: [],        // [{id,name,sort,active}]
  pinOk: false
};

let selectedDateKey = null;

/* ======== ユーティリティ ======== */
function pad2(n){ return String(n).padStart(2,"0"); }
function ymKeyFromDate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
function dateKeyFromDate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function fromDateKey(s){
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
}

function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function addMonths(d, delta){ return new Date(d.getFullYear(), d.getMonth()+delta, 1); }

/* 第1火曜・第3火曜判定 */
function isNthWeekdayOfMonth(dateObj, weekday /*0-6*/, nth /*1..*/){
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth();
  const first = new Date(y, m, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth-1)*7;
  return dateObj.getDate() === day;
}

/* 定休日：毎週月曜 + 第1火曜 + 第3火曜 */
function isClosedDay(dateObj){
  const dow = dateObj.getDay();
  if (dow === 1) return true;              // 月曜
  if (dow === 2 && isNthWeekdayOfMonth(dateObj, 2, 1)) return true; // 第1火曜
  if (dow === 2 && isNthWeekdayOfMonth(dateObj, 2, 3)) return true; // 第3火曜
  return false;
}

/* 簡易PINハッシュ（ローカル用途） */
async function sha256(str){
  const buf = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function ensurePinHash(){
  const existing = localStorage.getItem(KEY_PIN_HASH);
  if (existing) return existing;
  const h = await sha256(DEFAULT_PIN);
  localStorage.setItem(KEY_PIN_HASH, h);
  return h;
}
async function checkPin(pin){
  const saved = await ensurePinHash();
  const h = await sha256(pin);
  return h === saved;
}

/* ======== Supabase（クラウド）I/O ======== */
async function cloudLoadMonth(ym){
  const { data, error } = await sb
    .from("bookings")
    .select("data")
    .eq("date", ym)
    .maybeSingle();

  if (error) throw error;
  return data ? (data.data || {}) : {};
}

async function cloudSaveMonth(ym, monthObj){
  const { error } = await sb
    .from("bookings")
    .upsert({ date: ym, data: monthObj, updated_at: new Date().toISOString() }, { onConflict: "date" });

  if (error) throw error;
}

async function cloudGetDay(dateObj){
  const ym = ymKeyFromDate(dateObj);
  const dk = dateKeyFromDate(dateObj);
  const month = await cloudLoadMonth(ym);
  return { ym, dk, month, dayData: month[dk] || null };
}

async function cloudSetDay(dateObj, dayData){
  const { ym, dk, month } = await cloudGetDay(dateObj);
  month[dk] = dayData;
  await cloudSaveMonth(ym, month);
}

/* staffs テーブル */
async function cloudLoadStaffs(){
  const { data, error } = await sb
    .from("staffs")
    .select("id,name,sort,active")
    .order("sort", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function cloudUpsertStaff(staff){
  const { error } = await sb
    .from("staffs")
    .upsert(staff, { onConflict: "id" });
  if (error) throw error;
}

/* ======== 画面描画 ======== */
function formatMonthTitle(d){
  return `${d.getFullYear()}年 ${d.getMonth()+1}月`;
}

function getDayCount(dk){
  const dd = state.daily[dk];
  return dd ? Number(dd.count || 0) : 0;
}

function render(){
  // タイトル
  elMonthTitle.textContent = formatMonthTitle(viewDate);

  // クリア
  elCalendar.innerHTML = "";

  // カレンダー：日曜始まり
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);

  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // その週の日曜へ

  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay())); // その週の土曜へ

  // 曜日ヘッダ
  const headerRow = document.createElement("div");
  headerRow.className = "weekHeader";
  for (let i=0;i<7;i++){
    const h = document.createElement("div");
    h.className = "weekDay";
    h.textContent = WEEKDAYS[i];
    headerRow.appendChild(h);
  }
  elCalendar.appendChild(headerRow);

  // 日付セル
  let cur = new Date(start);
  while (cur <= end){
    const row = document.createElement("div");
    row.className = "weekRow";

    for (let i=0;i<7;i++){
      const cellDate = new Date(cur);
      const inMonth = cellDate.getMonth() === viewDate.getMonth();
      const dk = dateKeyFromDate(cellDate);

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "dayCell";
      if (!inMonth) cell.classList.add("outMonth");
      if (isClosedDay(cellDate)) cell.classList.add("closed");

      const dayNum = document.createElement("div");
      dayNum.className = "dayNum";
      dayNum.textContent = cellDate.getDate();

      const count = document.createElement("div");
      count.className = "dayCount";
      const v = getDayCount(dk);
      count.textContent = v > 0 ? `予約 ${v}` : "";

      cell.appendChild(dayNum);
      cell.appendChild(count);

      cell.addEventListener("click", ()=> openDayModal(dk));

      row.appendChild(cell);
      cur.setDate(cur.getDate()+1);
    }

    elCalendar.appendChild(row);
  }
}

/* ======== モーダル（入力） ======== */
function ensureModal(){
  // 既にあれば使う
  let modal = document.getElementById("dayModal");
  if (modal) return modal;

  // なければJSで生成（index.htmlが簡素でも動くように）
  modal = document.createElement("div");
  modal.id = "dayModal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modalBackdrop"></div>
    <div class="modalCard">
      <div class="modalHeader">
        <div>
          <div id="modalDateTitle" class="modalTitle"></div>
          <div id="modalSubTitle" class="modalSubTitle"></div>
        </div>
        <button id="modalCloseBtn" class="btn">×</button>
      </div>

      <div class="modalBody">
        <div class="bigInputBox">
          <label class="label">合計予約数（0〜${MAX_COUNT}）</label>
          <select id="totalSelect" class="bigSelect"></select>
        </div>

        <div class="memoBox">
          <label class="label">メモ（任意）</label>
          <textarea id="dayMemo" rows="2" class="memoArea" placeholder="共有メモ"></textarea>
        </div>

        <div class="staffMemoBox">
          <div class="label">スタッフ別メモ（小さめ）</div>
          <div id="staffMemoList" class="staffMemoList"></div>
        </div>
      </div>

      <div class="modalFooter">
        <button id="saveDayBtn" class="btn primary">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".modalBackdrop").addEventListener("click", closeDayModal);
  document.getElementById("modalCloseBtn").addEventListener("click", closeDayModal);

  document.getElementById("saveDayBtn").addEventListener("click", saveDay);

  // select options
  const sel = document.getElementById("totalSelect");
  sel.innerHTML = "";
  for (let i=0;i<=MAX_COUNT;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    sel.appendChild(opt);
  }

  return modal;
}

function openDayModal(dk){
  selectedDateKey = dk;
  const d = fromDateKey(dk);
  const modal = ensureModal();

  document.getElementById("modalDateTitle").textContent = `${dk}（${WEEKDAYS[d.getDay()]}）`;
  document.getElementById("modalSubTitle").textContent = isClosedDay(d) ? "定休日" : "";

  const dayData = state.daily[dk] || { count: 0, memo: "", staffMemo: {} };

  // 合計（大きく）
  document.getElementById("totalSelect").value = String(dayData.count || 0);

  // 共通メモ
  document.getElementById("dayMemo").value = dayData.memo || "";

  // スタッフ別メモ（小さめ）
  const list = document.getElementById("staffMemoList");
  list.innerHTML = "";
  const active = state.staffs.filter(s=>s.active !== false).sort((a,b)=>(a.sort||0)-(b.sort||0));
  for (const s of active){
    const wrap = document.createElement("div");
    wrap.className = "staffMemoRow";
    wrap.dataset.staffId = s.id;

    const name = document.createElement("div");
    name.className = "staffMemoName";
    name.textContent = s.name;

    const ta = document.createElement("textarea");
    ta.className = "staffMemoArea";
    ta.rows = 1;
    ta.placeholder = "メモ";
    ta.value = (dayData.staffMemo && dayData.staffMemo[s.id]) ? dayData.staffMemo[s.id] : "";

    wrap.appendChild(name);
    wrap.appendChild(ta);
    list.appendChild(wrap);
  }

  modal.classList.remove("hidden");
}

function closeDayModal(){
  const modal = document.getElementById("dayModal");
  if (modal) modal.classList.add("hidden");
  selectedDateKey = null;
}

/* ======== 保存（クラウド） ======== */
async function saveDay(){
  if (!selectedDateKey) return;

  const dk = selectedDateKey;
  const d = fromDateKey(dk);

  // 既存
  const dayData = state.daily[dk] || { count: 0, memo: "", staffMemo: {} };

  // 合計
  const total = Number(document.getElementById("totalSelect").value || 0);
  dayData.count = total;

  // 共通メモ
  dayData.memo = document.getElementById("dayMemo").value || "";

  // スタッフ別メモ
  const staffMemo = {};
  const rows = [...document.querySelectorAll("#staffMemoList .staffMemoRow")];
  for (const r of rows){
    const staffId = r.dataset.staffId;
    const ta = r.querySelector("textarea");
    staffMemo[staffId] = ta.value || "";
  }
  dayData.staffMemo = staffMemo;

  // 保存（クラウド）
  try {
    await cloudSetDay(d, dayData);
    // 表示中の月のデータを再読込（ズレ防止）
    await initCloud();
    closeDayModal();
  } catch (e) {
    console.error(e);
    alert("保存に失敗しました。通信状況を確認して、もう一度お試しください。");
  }
}

/* ======== 初期読み込み（クラウド） ======== */
async function initCloud(){
  try {
    // スタッフ
    state.staffs = await cloudLoadStaffs();

    // 月データ
    const ym = ymKeyFromDate(viewDate);
    state.daily = await cloudLoadMonth(ym);

  } catch (e) {
    console.warn("initCloud error", e);

    // 最低限表示だけはする（クラウド失敗時の保険）
    try {
      const raw = localStorage.getItem(KEY_LOCAL_FALLBACK);
      state.daily = raw ? JSON.parse(raw) : {};
    } catch {
      state.daily = {};
    }
  }

  // 退避（万一用）
  try { localStorage.setItem(KEY_LOCAL_FALLBACK, JSON.stringify(state.daily || {})); } catch {}

  render();
}

/* ======== CSV出力 ======== */
function exportCsv(){
  // その月の全日分（表示月のみ）
  const ym = ymKeyFromDate(viewDate);
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);

  const lines = [];
  // ヘッダ
  lines.push(["date","weekday","count","memo"].join(","));

  let cur = new Date(first);
  while (cur <= last){
    const dk = dateKeyFromDate(cur);
    const dd = state.daily[dk] || {};
    const row = [
      dk,
      WEEKDAYS[cur.getDay()],
      Number(dd.count || 0),
      csvEscape(dd.memo || "")
    ];
    lines.push(row.join(","));
    cur.setDate(cur.getDate()+1);
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `salon_booking_${ym}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(s){
  // 改行/カンマ/ダブルクォートがあればクォート
  const needs = /[",\n]/.test(s);
  if (!needs) return s;
  return `"${String(s).replaceAll('"','""')}"`;
}

/* ======== 設定（スタッフ管理 & PIN） ======== */
function ensureSettingsModal(){
  let modal = document.getElementById("settingsModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "settingsModal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modalBackdrop"></div>
    <div class="modalCard">
      <div class="modalHeader">
        <div class="modalTitle">設定</div>
        <button id="settingsCloseBtn" class="btn">×</button>
      </div>
      <div class="modalBody">
        <div class="pinBox">
          <div class="label">管理者PIN（スタッフ編集用）</div>
          <div class="pinRow">
            <input id="pinInput" class="pinInput" type="password" placeholder="PINを入力" />
            <button id="pinOkBtn" class="btn">OK</button>
          </div>
          <div id="pinStatus" class="pinStatus"></div>
        </div>

        <hr/>

        <div class="label">スタッフ管理</div>
        <div class="smallNote">※ 編集はPINがOKのときだけ可能</div>
        <div id="staffAdminList" class="staffAdminList"></div>
        <button id="addStaffBtn" class="btn">＋スタッフ追加</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".modalBackdrop").addEventListener("click", closeSettings);
  document.getElementById("settingsCloseBtn").addEventListener("click", closeSettings);

  document.getElementById("pinOkBtn").addEventListener("click", async ()=>{
    const pin = document.getElementById("pinInput").value || "";
    const ok = await checkPin(pin);
    state.pinOk = ok;
    document.getElementById("pinStatus").textContent = ok ? "PIN OK（編集可能）" : "PINが違います";
    renderStaffAdmin();
  });

  document.getElementById("addStaffBtn").addEventListener("click", async ()=>{
    if (!state.pinOk){
      alert("スタッフ追加にはPINが必要です。");
      return;
    }
    const name = prompt("スタッフ名を入力してください");
    if (!name) return;

    const id = crypto.randomUUID();
    const sort = (state.staffs.reduce((m,s)=>Math.max(m, s.sort||0), 0) || 0) + 1;
    const staff = { id, name, sort, active: true };

    try {
      await cloudUpsertStaff(staff);
      state.staffs = await cloudLoadStaffs();
      renderStaffAdmin();
      alert("追加しました。");
    } catch (e) {
      console.error(e);
      alert("追加に失敗しました。");
    }
  });

  return modal;
}

function openSettings(){
  const modal = ensureSettingsModal();
  document.getElementById("pinStatus").textContent = state.pinOk ? "PIN OK（編集可能）" : "PIN未確認";
  renderStaffAdmin();
  modal.classList.remove("hidden");
}

function closeSettings(){
  const modal = document.getElementById("settingsModal");
  if (modal) modal.classList.add("hidden");
}

function renderStaffAdmin(){
  const box = document.getElementById("staffAdminList");
  if (!box) return;

  box.innerHTML = "";

  const staffs = [...state.staffs].sort((a,b)=>(a.sort||0)-(b.sort||0));
  for (const s of staffs){
    const row = document.createElement("div");
    row.className = "staffAdminRow";

    const name = document.createElement("input");
    name.className = "staffNameInput";
    name.value = s.name;

    const sort = document.createElement("input");
    sort.className = "staffSortInput";
    sort.type = "number";
    sort.value = String(s.sort || 0);

    const active = document.createElement("input");
    active.type = "checkbox";
    active.checked = s.active !== false;

    const btnSave = document.createElement("button");
    btnSave.className = "btn small";
    btnSave.textContent = "保存";

    const labelActive = document.createElement("label");
    labelActive.className = "staffActiveLabel";
    labelActive.appendChild(active);
    labelActive.appendChild(document.createTextNode("有効"));

    row.appendChild(name);
    row.appendChild(sort);
    row.appendChild(labelActive);
    row.appendChild(btnSave);

    // 編集不可
    if (!state.pinOk){
      name.disabled = true;
      sort.disabled = true;
      active.disabled = true;
      btnSave.disabled = true;
    }

    btnSave.addEventListener("click", async ()=>{
      if (!state.pinOk) return;

      const updated = {
        id: s.id,
        name: name.value.trim() || s.name,
        sort: Number(sort.value || s.sort || 0),
        active: active.checked
      };

      try {
        await cloudUpsertStaff(updated);
        state.staffs = await cloudLoadStaffs();
        alert("保存しました。");
        renderStaffAdmin();
      } catch (e) {
        console.error(e);
        alert("保存に失敗しました。");
      }
    });

    box.appendChild(row);
  }
}

/* ======== イベント ======== */
btnPrev?.addEventListener("click", async ()=>{
  viewDate = addMonths(viewDate, -1);
  await initCloud();
});
btnNext?.addEventListener("click", async ()=>{
  viewDate = addMonths(viewDate, +1);
  await initCloud();
});
btnExport?.addEventListener("click", exportCsv);
btnSettings?.addEventListener("click", openSettings);

// タブに戻ったら再読み込み（PC確認用）
window.addEventListener("focus", ()=>{
  // 連打防止の軽い遅延
  setTimeout(()=>{ initCloud(); }, 150);
});

/* ======== 起動 ======== */
initCloud();

