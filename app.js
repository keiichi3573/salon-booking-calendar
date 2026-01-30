// ========= Storage Keys =========
const KEY = "salonBooking_v1";
const KEY_PIN = "salonBooking_pin";

// ========= Defaults =========
const DEFAULT_PIN = "4043";
const DEFAULT_STAFFS = [
  { id: crypto.randomUUID(), name: "けい", sort: 1, active: true },
  { id: crypto.randomUUID(), name: "スタッフA", sort: 2, active: true },
  { id: crypto.randomUUID(), name: "スタッフB", sort: 3, active: true },
];

const WEEKDAYS = ["日","月","火","水","木","金","土"];

// ========= Utils =========
function pad2(n){ return String(n).padStart(2,"0"); }
function toDateKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function fromDateKey(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y, m-1, d); }
function endOfMonth(y,m){ return new Date(y, m+1, 0); }
function addMonths(d, delta){ return new Date(d.getFullYear(), d.getMonth()+delta, 1); }

function hashPin(pin){
  let h = 0;
  for (let i=0;i<pin.length;i++) h = (h*31 + pin.charCodeAt(i)) >>> 0;
  return String(h);
}

// ========= Closing Days =========
// Closed: every Monday + 1st/3rd Tuesday
function isClosedDay(date){
  const day = date.getDay();
  if (day === 1) return true;
  if (day === 2) {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    let c = 0;
    for (let i=1;i<=d;i++){
      const t = new Date(y,m,i);
      if (t.getDay() === 2) c++;
    }
    return c === 1 || c === 3;
  }
  return false;
}

// ========= State =========
function loadState(){
  const raw = localStorage.getItem(KEY);
  if (!raw){
    const init = { staffs: DEFAULT_STAFFS, daily: {} };
    localStorage.setItem(KEY, JSON.stringify(init));
    if (!localStorage.getItem(KEY_PIN)) localStorage.setItem(KEY_PIN, hashPin(DEFAULT_PIN));
    return init;
  }
  try{
    const obj = JSON.parse(raw);
    if (!obj.staffs) obj.staffs = DEFAULT_STAFFS;
    if (!obj.daily) obj.daily = {};
    if (!localStorage.getItem(KEY_PIN)) localStorage.setItem(KEY_PIN, hashPin(DEFAULT_PIN));
    return obj;
  }catch{
    const init = { staffs: DEFAULT_STAFFS, daily: {} };
    localStorage.setItem(KEY, JSON.stringify(init));
    localStorage.setItem(KEY_PIN, hashPin(DEFAULT_PIN));
    return init;
  }
}
function saveState(){ localStorage.setItem(KEY, JSON.stringify(state)); }

let state = loadState();
let viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDateKey = null;
let pinUnlocked = false;

// ========= DOM =========
const monthTitle = document.getElementById("monthTitle");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const calendarEl = document.getElementById("calendar");

const dayModal = document.getElementById("dayModal");
const dayTitle = document.getElementById("dayTitle");
const daySub = document.getElementById("daySub");
const dayCloseBtn = document.getElementById("dayCloseBtn");
const staffRows = document.getElementById("staffRows");
const dayMemo = document.getElementById("dayMemo");
const saveDayBtn = document.getElementById("saveDayBtn");

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");

const pinGate = document.getElementById("pinGate");
const pinInput = document.getElementById("pinInput");
const pinEnterBtn = document.getElementById("pinEnterBtn");
const pinError = document.getElementById("pinError");

const settingsBody = document.getElementById("settingsBody");
const staffList = document.getElementById("staffList");
const newStaffName = document.getElementById("newStaffName");
const addStaffBtn = document.getElementById("addStaffBtn");
const newPin = document.getElementById("newPin");
const changePinBtn = document.getElementById("changePinBtn");
const pinOk = document.getElementById("pinOk");

const exportCsvBtn = document.getElementById("exportCsvBtn");

// ========= Helpers =========
function getActiveStaffs(){
  return [...state.staffs]
    .filter(s => s.active !== false)
    .sort((a,b)=> (a.sort||0)-(b.sort||0));
}

// ========= Render Calendar =========
function render(){
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  monthTitle.textContent = `${y}年 ${m+1}月`;

  calendarEl.innerHTML = "";

  // DOW header
  for (let i=0;i<7;i++){
    const dow = document.createElement("div");
    dow.className = "dow";
    dow.textContent = WEEKDAYS[i];
    calendarEl.appendChild(dow);
  }

  const first = new Date(y,m,1);
  const last = endOfMonth(y,m);
  const startWeekday = first.getDay();
  const totalDays = last.getDate();

  for (let i=0;i<startWeekday;i++){
    const empty = document.createElement("div");
    empty.className = "cell";
    empty.style.visibility = "hidden";
    calendarEl.appendChild(empty);
  }

  const activeStaffs = getActiveStaffs();

  for (let day=1; day<=totalDays; day++){
    const d = new Date(y,m,day);
    const key = toDateKey(d);
    const closed = isClosedDay(d);

    const cell = document.createElement("div");
    cell.className = "cell clickable" + (closed ? " closed" : "");
    cell.addEventListener("click", ()=> openDay(key));

    const dateEl = document.createElement("div");
    dateEl.className = "date";
    dateEl.textContent = String(day);
    cell.appendChild(dateEl);

    const dayData = state.daily[key] || {};
    let sum = 0;
    for (const s of activeStaffs){
      const v = dayData.staff?.[s.id]?.count ?? 0;
      sum += Number(v || 0);
    }

    const sumEl = document.createElement("div");
    sumEl.className = "sum";
    sumEl.textContent = String(sum); // ← 合計のみ大きく表示
    cell.appendChild(sumEl);

    calendarEl.appendChild(cell);
  }
}

// ========= Day Modal =========
function openDay(dateKey){
  selectedDateKey = dateKey;
  const d = fromDateKey(dateKey);

  dayTitle.textContent = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
  daySub.textContent = isClosedDay(d) ? "定休日（必要なら入力可）" : "";

  const dayData = state.daily[dateKey] || { memo:"", staff:{} };
  dayMemo.value = dayData.memo || "";

  staffRows.innerHTML = "";
  const staffs = getActiveStaffs();

  for (const s of staffs){
    const row = document.createElement("div");
    row.className = "staffRow";
    row.dataset.staffId = s.id;

    const top = document.createElement("div");
    top.className = "staffRowTop";

    const name = document.createElement("div");
    name.className = "staffName";
    name.textContent = s.name;

    const select = document.createElement("select");
    for (let i=0;i<=20;i++){
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      select.appendChild(opt);
    }
    const current = dayData.staff?.[s.id]?.count ?? 0;
    select.value = String(current);

    top.appendChild(name);
    top.appendChild(select);

    const memo = document.createElement("textarea");
    memo.rows = 2;
    memo.placeholder = "スタッフ別メモ（任意）";
    memo.value = dayData.staff?.[s.id]?.memo || "";

    row.appendChild(top);
    row.appendChild(memo);
    staffRows.appendChild(row);
  }

  dayModal.setAttribute("aria-hidden","false");
}

function closeDay(){
  dayModal.setAttribute("aria-hidden","true");
  selectedDateKey = null;
}

function saveDay(){
  if (!selectedDateKey) return;

  const dayData = state.daily[selectedDateKey] || { memo:"", staff:{} };
  dayData.memo = dayMemo.value || "";
  if (!dayData.staff) dayData.staff = {};

  const rows = [...staffRows.querySelectorAll(".staffRow")];
  for (const r of rows){
    const staffId = r.dataset.staffId;
    const select = r.querySelector("select");
    const memo = r.querySelector("textarea");
    dayData.staff[staffId] = {
      count: Number(select.value),
      memo: memo.value || ""
    };
  }

  state.daily[selectedDateKey] = dayData;
  saveState();
  closeDay();
  render();
}

// ========= Settings =========
function openSettings(){
  pinError.textContent = "";
  pinOk.textContent = "";
  pinInput.value = "";

  if (pinUnlocked){
    pinGate.classList.add("hidden");
    settingsBody.classList.remove("hidden");
    renderStaffList();
  }else{
    pinGate.classList.remove("hidden");
    settingsBody.classList.add("hidden");
  }
  settingsModal.setAttribute("aria-hidden","false");
}
function closeSettings(){ settingsModal.setAttribute("aria-hidden","true"); }

function enterPin(){
  pinError.textContent = "";
  const pin = (pinInput.value || "").trim();
  if (hashPin(pin) === localStorage.getItem(KEY_PIN)){
    pinUnlocked = true;
    pinGate.classList.add("hidden");
    settingsBody.classList.remove("hidden");
    renderStaffList();
  }else{
    pinError.textContent = "PINが違います。";
  }
}

function normalizeSort(){
  state.staffs.sort((a,b)=> (a.sort||0)-(b.sort||0)).forEach((s,idx)=> s.sort = idx+1);
}

function renderStaffList(){
  staffList.innerHTML = "";
  const staffs = [...state.staffs].sort((a,b)=> (a.sort||0)-(b.sort||0));

  for (const s of staffs){
    const item = document.createElement("div");
    item.className = "staffItem";

    const left = document.createElement("div");
    left.className = "left";

    const nameInput = document.createElement("input");
    nameInput.value = s.name;
    nameInput.style.maxWidth = "220px";
    nameInput.addEventListener("change", ()=>{
      s.name = nameInput.value.trim() || s.name;
      saveState(); render();
    });

    const status = document.createElement("div");
    status.className = s.active === false ? "tagOff" : "";
    status.textContent = s.active === false ? "無効" : "";

    left.appendChild(nameInput);
    left.appendChild(status);

    const right = document.createElement("div");
    right.style.display="flex";
    right.style.gap="6px";

    const up = document.createElement("button");
    up.className="smallBtn";
    up.textContent="↑";
    up.addEventListener("click", ()=>{
      s.sort = (s.sort||0) - 1;
      normalizeSort();
      saveState(); renderStaffList(); render();
    });

    const down = document.createElement("button");
    down.className="smallBtn";
    down.textContent="↓";
    down.addEventListener("click", ()=>{
      s.sort = (s.sort||0) + 1;
      normalizeSort();
      saveState(); renderStaffList(); render();
    });

    const toggle = document.createElement("button");
    toggle.className="smallBtn";
    toggle.textContent = (s.active === false) ? "有効化" : "無効化";
    toggle.addEventListener("click", ()=>{
      s.active = (s.active === false) ? true : false;
      saveState(); renderStaffList(); render();
    });

    right.appendChild(up);
    right.appendChild(down);
    right.appendChild(toggle);

    item.appendChild(left);
    item.appendChild(right);
    staffList.appendChild(item);
  }
}

function addStaff(){
  const name = (newStaffName.value || "").trim();
  if (!name) return;
  const maxSort = Math.max(0, ...state.staffs.map(s=>s.sort||0));
  state.staffs.push({ id: crypto.randomUUID(), name, sort: maxSort+1, active: true });
  newStaffName.value = "";
  saveState();
  renderStaffList();
  render();
}

function changePin(){
  pinOk.textContent = "";
  const p = (newPin.value || "").trim();
  if (p.length < 4){
    pinError.textContent = "PINは4桁以上をおすすめします。";
    return;
  }
  localStorage.setItem(KEY_PIN, hashPin(p));
  newPin.value = "";
  pinOk.textContent = "PINを変更しました。";
  pinError.textContent = "";
}

// ========= CSV =========
function exportCsv(){
  const staffs = [...state.staffs].sort((a,b)=> (a.sort||0)-(b.sort||0));
  const header = ["date","weekday","closed","memo", ...staffs.map(s=>`${s.name}_count`), ...staffs.map(s=>`${s.name}_memo`)];
  const rows = [header];

  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const last = endOfMonth(y,m).getDate();

  for (let day=1; day<=last; day++){
    const d = new Date(y,m,day);
    const key = toDateKey(d);
    const dd = state.daily[key] || { memo:"", staff:{} };
    const closed = isClosedDay(d) ? "1" : "0";
    const base = [key, WEEKDAYS[d.getDay()], closed, (dd.memo||"").replaceAll("\n"," ")];

    const counts = staffs.map(s => String(dd.staff?.[s.id]?.count ?? 0));
    const memos  = staffs.map(s => (dd.staff?.[s.id]?.memo ?? "").replaceAll("\n"," "));
    rows.push([...base, ...counts, ...memos]);
  }

  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booking_${viewDate.getFullYear()}_${pad2(viewDate.getMonth()+1)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ========= Events =========
prevBtn.addEventListener("click", ()=> { viewDate = addMonths(viewDate,-1); render(); });
nextBtn.addEventListener("click", ()=> { viewDate = addMonths(viewDate, 1); render(); });

dayCloseBtn.addEventListener("click", closeDay);
dayModal.addEventListener("click", (e)=> { if (e.target === dayModal) closeDay(); });
saveDayBtn.addEventListener("click", saveDay);

settingsBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsModal.addEventListener("click", (e)=> { if (e.target === settingsModal) closeSettings(); });

pinEnterBtn.addEventListener("click", enterPin);
pinInput.addEventListener("keydown", (e)=> { if (e.key==="Enter") enterPin(); });

addStaffBtn.addEventListener("click", addStaff);
newStaffName.addEventListener("keydown", (e)=> { if (e.key==="Enter") addStaff(); });

changePinBtn.addEventListener("click", changePin);

exportCsvBtn.addEventListener("click", exportCsv);

// ========= Init =========
render();
