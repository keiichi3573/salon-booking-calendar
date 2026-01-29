// ====== Storage ======
const KEY = "salonBooking_v1";
const KEY_PIN = "salonBooking_pin";

// ====== Defaults ======
const DEFAULT_PIN = "4043";
const DEFAULT_STAFFS = [
  { id: crypto.randomUUID(), name: "けい", sort: 1, active: true },
  { id: crypto.randomUUID(), name: "スタッフA", sort: 2, active: true },
  { id: crypto.randomUUID(), name: "スタッフB", sort: 3, active: true },
];

const WEEKDAYS = ["日","月","火","水","木","金","土"];

// ====== Utils ======
const pad2 = n => String(n).padStart(2,"0");
const toKey = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const fromKey = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };

function hashPin(pin){
  let h=0; for(const c of pin) h=(h*31+c.charCodeAt(0))>>>0;
  return String(h);
}

// ====== 定休日：毎週月曜＋第1・第3火曜 ======
function isClosed(d){
  if(d.getDay()===1) return true;
  if(d.getDay()===2){
    let c=0;
    for(let i=1;i<=d.getDate();i++){
      const t=new Date(d.getFullYear(),d.getMonth(),i);
      if(t.getDay()===2) c++;
    }
    return c===1||c===3;
  }
  return false;
}

// ====== State ======
function load(){
  const raw=localStorage.getItem(KEY);
  if(!raw){
    const init={ staffs:DEFAULT_STAFFS, daily:{} };
    localStorage.setItem(KEY,JSON.stringify(init));
    localStorage.setItem(KEY_PIN,hashPin(DEFAULT_PIN));
    return init;
  }
  return JSON.parse(raw);
}
function save(){ localStorage.setItem(KEY,JSON.stringify(state)); }

let state = load();
let view = new Date(new Date().getFullYear(),new Date().getMonth(),1);

// ====== DOM ======
const cal=document.getElementById("calendar");
const title=document.getElementById("monthTitle");

// ====== Render ======
function render(){
  const y=view.getFullYear(), m=view.getMonth();
  title.textContent=`${y}年 ${m+1}月`;
  cal.innerHTML="";

  WEEKDAYS.forEach(w=>{
    const d=document.createElement("div");
    d.className="dow"; d.textContent=w; cal.appendChild(d);
  });

  const first=new Date(y,m,1);
  for(let i=0;i<first.getDay();i++){
    const e=document.createElement("div");
    e.style.visibility="hidden"; cal.appendChild(e);
  }

  const last=new Date(y,m+1,0).getDate();
  for(let day=1;day<=last;day++){
    const d=new Date(y,m,day);
    const key=toKey(d);
    const cell=document.createElement("div");
    cell.className="cell clickable"+(isClosed(d)?" closed":"");
    cell.onclick=()=>alert("ここに編集画面が出ます（完成後）");

    cell.innerHTML=`<div class="date">${day}</div>`;
    cal.appendChild(cell);
  }
}

// ====== Nav ======
document.getElementById("prevBtn").onclick=()=>{ view=new Date(view.getFullYear(),view.getMonth()-1,1); render(); }
document.getElementById("nextBtn").onclick=()=>{ view=new Date(view.getFullYear(),view.getMonth()+1,1); render(); }

render();
