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

// ★ supabase という名前を使わない（重要）
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ===== 設定 =====
const MAX_COUNT = 20;
const DEFAULT_PIN = "4043";
const KEY_LOCAL_PIN = "salon_pin_v1"; // PINはローカルにも保持（バックアップ）
const DEFAULT_STAFFS = [
  { id: crypto.randomUUID(), name: "スタッフA", sort: 1, active: true },
  { id: crypto.randomUUID(), name: "スタッフB", sort: 2, active: true },
];

// ===== Supabase初期化 =====
let supabase = null;
try{
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}catch(e){
  alert("SupabaseのURL/KEYが正しくありません。URLとKEYは必ずダブルクォートで囲んでください。");
  console.error(e);
}

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
const dayMemo       = document.getElementById("dayMemo");

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

// ===== state =====
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

function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
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

function openModal(modal){
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden","false");
}
function closeModal(modal){
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden","true");
}

// backdropクリックで閉じる
document.querySelectorAll("[data-close]").forEach(el=>{
  el.addEventListener("click", ()=>{
    const id = el.getAttribute("data-close");
    const m = document.getElementById(id);
    if(m) closeModal(m);
  });
});

// ===== Supabase helpers =====
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

// ===== render =====
function renderMonth(){
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
    badge.className = "badge";
    badge.textContent = `予約 ${Number(info.count||0)}`;

    top.appendChild(num);
    top.appendChild(badge);

    if((info.memo||"").trim().length>0){
      const note = document.createElement("div");
      note.className = "badge note";
      note.textContent = "📝";
      top.appendChild(note);
    }

    cell.appendChild(top);

    cell.addEventListener("click", ()=>{
      openDayEditor(d);
    });

    elCalendar.appendChild(cell);
  }
}

function fillSelect(){
  totalSelect.innerHTML = "";
  for(let i=0;i<=MAX_COUNT;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    totalSelect.appendChild(opt);
  }
}

// ===== day editor =====
let editingDateKey = null;

function openDayEditor(date){
  editingDateKey = toDateKey(date);
  const info = monthData[editingDateKey] || { count:0, memo:"" };

  dayTitle.textContent = `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日（${WEEK[date.getDay()]}）`;
  totalSelect.value = String(Number(info.count||0));
  dayMemo.value = info.memo || "";

  openModal(dayModal);
}

async function saveDay(){
  if(!editingDateKey) return;
  const count = Number(totalSelect.value||0);
  const memo  = (dayMemo.value||"").trim();

  monthData[editingDateKey] = { count, memo };

  await saveMonthData(currentMonthKey, monthData);
  closeModal(dayModal);
  renderMonth();
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
  fillSelect();
  currentMonthKey = toMonthKey(viewDate);
  monthData = await loadMonthData(currentMonthKey);
  renderMonth();
}

btnPrev?.addEventListener("click", async ()=>{
  viewDate = addMonths(viewDate, -1);
  await loadAndRender();
});
btnNext?.addEventListener("click", async ()=>{
  viewDate = addMonths(viewDate, +1);
  await loadAndRender();
});

dayCloseBtn?.addEventListener("click", ()=> closeModal(dayModal));
daySaveBtn?.addEventListener("click", saveDay);

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

// 起動
loadAndRender();
