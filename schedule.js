/* =========================
  COMFORT 予約表
========================= */

/* =========================
   Supabase接続
========================= */

const SUPABASE_URL =
  window.APP_CONFIG
    ?.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  window.APP_CONFIG
    ?.SUPABASE_ANON_KEY;

if(
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY
){
  throw new Error(
    "Supabase設定が読み込めていません。config.jsを確認してください。"
  );
}

const sb =
  window.supabase
    .createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

/* =========================
   基本設定
========================= */

const SLOT_MINUTES = 15;

const START_MINUTES =
  9 * 60 + 30;

const END_MINUTES =
  18 * 60;

const SLOT_COUNT =
  Math.floor(
    (END_MINUTES - START_MINUTES) /
    SLOT_MINUTES
  ) + 1;

const STORAGE_KEY =
  "comfort_schedule_prototype_v1";

/* =========================
   スタッフ
========================= */

const STAFFS = [
  {
    id: "kitamura",
    name: "北村 美穂",
    hours: "9:30〜18:00"
  },
  {
    id: "yamazaki",
    name: "山崎 錦子",
    hours: "9:30〜18:00"
  },
  {
    id: "takeuchi",
    name: "竹内 いずみ",
    hours: "予約が入った場合に出勤"
  }
];

/* =========================
   よく使う組み合わせ
========================= */

const COMBINATION_MENUS = [
  {
    id: "cut_color",
    label: "カット＋カラー",
    icon: "✂️🎨",
    minutes: 150,
    includesColor: true
  },
  {
    id: "cut_perm",
    label: "カット＋パーマ",
    icon: "✂️〰️",
    minutes: 150
  },
  {
    id: "cut_color_basic",
    label:
      "カット＋カラー＋ベーシックT",
    icon: "✂️🎨✨",
    minutes: 165,
    includesColor: true
  },
  {
    id: "cut_perm_basic",
    label:
      "カット＋パーマ＋ベーシックT",
    icon: "✂️〰️✨",
    minutes: 165
  },
  {
    id: "color_treatment",
    label: "カラー＋トリートメント",
    icon: "🎨✨",
    minutes: 135,
    includesColor: true
  }
];

/* =========================
   単品・追加メニュー
========================= */

const SINGLE_MENUS = [
  {
    id: "cut",
    label: "カット",
    icon: "✂️",
    minutes: 75
  },
  {
    id: "perm",
    label: "パーマ",
    icon: "〰️",
    minutes: 150
  },
  {
    id: "color",
    label: "カラー",
    icon: "🎨",
    minutes: 105,
    includesColor: true
  },
  {
    id: "spa",
    label: "ヘッドスパ",
    icon: "🌿",
    minutes: 15
  },
  {
    id: "m",
    label: "M",
    icon: "Ⓜ️",
    minutes: 15,
    onlyStaff: "yamazaki"
  },
  {
    id: "basic_treatment",
    label: "ベーシックT",
    icon: "✨",
    minutes: 15
  },
  {
    id: "placenta_treatment",
    label: "プラセンタT",
    icon: "💧",
    minutes: 15,
    disabledStaffs: [
      "takeuchi"
    ]
  },
  {
    id: "tsuyakoi_treatment",
    label: "ツヤ恋T",
    icon: "💎",
    minutes: 45,
    disabledStaffs: [
      "takeuchi"
    ]
  },
  {
    id: "soda",
    label: "炭酸シャンプー",
    icon: "🫧",
    minutes: 15,
    disabledStaffs: [
      "takeuchi"
    ]
  },
  {
    id: "straight",
    label: "縮毛矯正",
    icon: "➖",
    minutes: 195,
    disabledStaffs: [
      "takeuchi"
    ]
  }
];

/* =========================
   カラー種類
========================= */

const COLOR_TYPES = [
  {
    id: "gray",
    label: "白髪染め"
  },
  {
    id: "fashion",
    label: "通常カラー"
  },
  {
    id: "herbal",
    label: "香草カラー"
  },
  {
    id: "manicure",
    label: "マニキュア"
  },
  {
    id: "henna",
    label: "ヘナ"
  }
];

const MENU_DISPLAY_ORDER = [
  "cut",
  "color",
  "cut_color",

  "perm",
  "straight",
  "placenta_treatment",

  "tsuyakoi_treatment",
  "spa",
  "basic_treatment",

  "soda",
  "m",
  "cut_perm",

  "cut_color_basic",
  "cut_perm_basic",
  "color_treatment"
];

/* =========================
   DOM
========================= */

const dateTitle =
  document.getElementById(
    "dateTitle"
  );

const daySummary =
  document.getElementById(
    "daySummary"
  );

const scheduleGrid =
  document.getElementById(
    "scheduleGrid"
  );

const prevDayBtn =
  document.getElementById(
    "prevDayBtn"
  );

const nextDayBtn =
  document.getElementById(
    "nextDayBtn"
  );

const todayBtn =
  document.getElementById(
    "todayBtn"
  );

const newBookingBtn =
  document.getElementById(
    "newBookingBtn"
  );

const bookingModal =
  document.getElementById(
    "bookingModal"
  );

const bookingModalTitle =
  document.getElementById(
    "bookingModalTitle"
  );

const modalCloseBtn =
  document.getElementById(
    "modalCloseBtn"
  );

const modalCancelBtn =
  document.getElementById(
    "modalCancelBtn"
  );

const customerNameInput =
  document.getElementById(
    "customerNameInput"
  );

const staffSelect =
  document.getElementById(
    "staffSelect"
  );

const startTimeSelect =
  document.getElementById(
    "startTimeSelect"
  );

const endTimeDisplay =
  document.getElementById(
    "endTimeDisplay"
  );

const menuButtons =
  document.getElementById(
    "menuButtons"
  );

const colorOptionsSection =
  document.getElementById(
    "colorOptionsSection"
  );

const colorTypeButtons =
  document.getElementById(
    "colorTypeButtons"
  );

const placentaChoice =
  document.getElementById(
    "placentaChoice"
  );

const sourceSelect =
  document.getElementById(
    "sourceSelect"
  );

const noteInput =
  document.getElementById(
    "noteInput"
  );

const formMessage =
  document.getElementById(
    "formMessage"
  );

const saveBookingBtn =
  document.getElementById(
    "saveBookingBtn"
  );

const cancelBookingBtn =
  document.getElementById(
    "cancelBookingBtn"
  );

/* =========================
   状態
========================= */

const now = new Date();

let viewDate =
  new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

let bookings =
  loadBookings();

let editingBookingId = null;

let selectedMenus =
  new Set();

let selectedCustomerType =
  "repeat";

let selectedNomination =
  "nomination";

let selectedColorType = "";

let selectedPlacentaMode =
  "normal";

/* =========================
   共通関数
========================= */

function pad2(number){
  return String(number)
    .padStart(2, "0");
}

function toDateKey(date){
  return (
    `${date.getFullYear()}-` +
    `${pad2(date.getMonth() + 1)}-` +
    `${pad2(date.getDate())}`
  );
}

function minutesToTime(minutes){
  const hour =
    Math.floor(minutes / 60);

  const minute =
    minutes % 60;

  return (
    `${pad2(hour)}:` +
    `${pad2(minute)}`
  );
}

function timeToMinutes(time){
  const [
    hour,
    minute
  ] = time
    .split(":")
    .map(Number);

  return (
    hour * 60 +
    minute
  );
}

function addDays(date, diff){
  const result =
    new Date(date);

  result.setDate(
    result.getDate() + diff
  );

  return result;
}

function formatDateTitle(date){
  const weeks = [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
  ];

  return (
    `${date.getFullYear()}年` +
    `${date.getMonth() + 1}月` +
    `${date.getDate()}日` +
    `（${weeks[date.getDay()]}）`
  );
}

function createId(){
  if (
    window.crypto &&
    typeof window.crypto.randomUUID
      === "function"
  ){
    return window.crypto.randomUUID();
  }

  return (
    `${Date.now()}-` +
    `${Math.random()
      .toString(16)
      .slice(2)}`
  );
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      character => {
        const map = {
          "&":"&amp;",
          "<":"&lt;",
          ">":"&gt;",
          '"':"&quot;",
          "'":"&#039;"
        };

        return map[character];
      }
    );
}

function roundUpToSlot(minutes){
  return (
    Math.ceil(
      minutes / SLOT_MINUTES
    ) * SLOT_MINUTES
  );
}

/* =========================
   仮保存
========================= */

function loadBookings(){
  try{
    const value =
      localStorage.getItem(
        STORAGE_KEY
      );

    const parsed =
      JSON.parse(
        value || "[]"
      );

    return Array.isArray(parsed)
      ? parsed
      : [];
  }catch(error){
    console.error(
      "予約データ読込エラー:",
      error
    );

    return [];
  }
}

function saveBookings(){
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(bookings)
  );
}

/* =========================
   メニュー取得
========================= */

function getAllMenus(){
  return [
    ...COMBINATION_MENUS,
    ...SINGLE_MENUS
  ];
}

function getMenuById(menuId){
  return getAllMenus()
    .find(
      menu =>
        menu.id === menuId
    );
}

function hasSelectedColorMenu(){
  return [
    ...selectedMenus
  ].some(
    menuId =>
      getMenuById(menuId)
        ?.includesColor
  );
}

function getSelectedMenuLabels(){
  return [
    ...selectedMenus
  ]
    .map(
      menuId =>
        getMenuById(menuId)
          ?.label
    )
    .filter(Boolean);
}

function getSelectedDuration(){
  let totalMinutes = 0;

  selectedMenus.forEach(
    menuId => {
      const menu =
        getMenuById(menuId);

      totalMinutes +=
        Number(
          menu?.minutes || 0
        );
    }
  );

  return roundUpToSlot(
    totalMinutes
  );
}

/* =========================
   初期選択肢作成
========================= */

function renderStaffOptions(){
  staffSelect.innerHTML =
    STAFFS
      .map(
        staff => (
          `<option value="${staff.id}">` +
          `${staff.name}` +
          `</option>`
        )
      )
      .join("");
}

function renderTimeOptions(){
  const options = [];

  for(
    let minutes = START_MINUTES;
    minutes <= END_MINUTES;
    minutes += SLOT_MINUTES
  ){
    const time =
      minutesToTime(minutes);

    options.push(
      `<option value="${time}">` +
      `${time}` +
      `</option>`
    );
  }

  startTimeSelect.innerHTML =
    options.join("");
}

function getMenuIconHtml(menu){
  const cutIcon =
    `<img src="icon-cut.png" alt="" class="scheduleMenuImage">`;

  const permIcon =
    `<img src="icon-perm.png" alt="" class="scheduleMenuImage">`;

  const colorIcon =
    `<img src="icon-color.png" alt="" class="scheduleMenuImage">`;

  switch(menu.id){

    case "cut":
      return (
        `<span class="scheduleMenuIconWrap">` +
          `${cutIcon}` +
        `</span>`
      );

    case "color":
      return (
        `<span class="scheduleMenuIconWrap">` +
          `${colorIcon}` +
        `</span>`
      );

    case "perm":
      return (
        `<span class="scheduleMenuIconWrap">` +
          `${permIcon}` +
        `</span>`
      );

    case "cut_color":
    case "cut_color_basic":
      return (
        `<span class="scheduleMenuIconGroup">` +
          `${cutIcon}` +
          `${colorIcon}` +
        `</span>`
      );

    case "cut_perm":
    case "cut_perm_basic":
      return (
        `<span class="scheduleMenuIconGroup">` +
          `${cutIcon}` +
          `${permIcon}` +
        `</span>`
      );

    default:
      return "";
  }
}

function createMenuButtonHtml(menu){
  const iconHtml =
    getMenuIconHtml(menu);

  const hasIcon =
    iconHtml !== "";

  return (
    `<button ` +
    `type="button" ` +
    `class="scheduleMenuBtn ${hasIcon ? "scheduleMenuBtnWithIcon" : "scheduleMenuBtnTextOnly"}" ` +
    `data-menu-id="${menu.id}">` +

      `${iconHtml}` +

      `<span class="scheduleMenuLabelWrap">` +
        `<span class="scheduleMenuLabel">` +
          `${menu.label}` +
        `</span>` +

        `<span class="scheduleMenuMinutes">` +
          `${menu.minutes}分` +
        `</span>` +
      `</span>` +

    `</button>`
  );
}

function renderMenuButtons(){
  const orderedMenus =
    MENU_DISPLAY_ORDER
      .map(
        menuId =>
          getMenuById(menuId)
      )
      .filter(Boolean);

  menuButtons.innerHTML =
    orderedMenus
      .map(
        createMenuButtonHtml
      )
      .join("");
}

function renderColorTypeButtons(){
  colorTypeButtons.innerHTML =
    COLOR_TYPES
      .map(
        color => (
          `<button ` +
          `type="button" ` +
          `class="scheduleMenuBtn" ` +
          `data-color-type="${color.id}">` +
            `<span>${color.label}</span>` +
          `</button>`
        )
      )
      .join("");
}

/* =========================
   サンプル予約
========================= */

function createDemoBookings(){
  if(bookings.length > 0){
    return;
  }

  const todayKey =
    toDateKey(viewDate);

  bookings = [
    {
      id:createId(),
      date:todayKey,
      staffId:"kitamura",
      customerName:"山田 花子",
      start:"10:00",
      end:"12:30",
      customerType:"repeat",
      nomination:"nomination",
      menus:[
        "cut_color"
      ],
      menuLabels:[
        "カット＋カラー"
      ],
      colorType:"gray",
      placentaMode:"placenta",
      source:"referral",
      note:"",
      status:"reserved"
    },
    {
      id:createId(),
      date:todayKey,
      staffId:"yamazaki",
      customerName:"鈴木 結衣",
      start:"09:30",
      end:"10:45",
      customerType:"new",
      nomination:"free",
      menus:[
        "cut"
      ],
      menuLabels:[
        "カット"
      ],
      colorType:"",
      placentaMode:"normal",
      source:"web",
      note:"",
      status:"reserved"
    }
  ];

  saveBookings();
}

/* =========================
   予約表表示
========================= */

function renderSchedule(){
  dateTitle.textContent =
    formatDateTitle(viewDate);

  const currentDateKey =
    toDateKey(viewDate);

  const currentBookings =
    bookings.filter(
      booking =>
        booking.date ===
          currentDateKey &&
        booking.status !==
          "cancelled"
    );

  daySummary.textContent =
    `予約 ${currentBookings.length}件`;

  scheduleGrid.innerHTML = "";

  const cornerCell =
    document.createElement("div");

  cornerCell.className =
    "scheduleCornerCell";

  cornerCell.textContent =
    "スタッフ";

  scheduleGrid.appendChild(
    cornerCell
  );

  for(
    let slotIndex = 0;
    slotIndex < SLOT_COUNT;
    slotIndex++
  ){
    const minutes =
      START_MINUTES +
      slotIndex * SLOT_MINUTES;

    const timeCell =
      document.createElement("div");

    timeCell.className =
      "scheduleTimeCell";

    if(minutes % 60 === 0){
      timeCell.classList.add(
        "scheduleTimeCellMajor"
      );
    }

    if(minutes % 30 === 0){
      timeCell.textContent =
        minutesToTime(minutes);
    }

    scheduleGrid.appendChild(
      timeCell
    );
  }

  STAFFS.forEach(
    staff => {
      renderStaffRow(
        staff,
        currentBookings
      );
    }
  );
}

/* =========================
   重複予約の表示位置を計算
========================= */

function createBookingLaneData(
  staffBookings
){
  const sortedBookings = [
    ...staffBookings
  ].sort(
    (bookingA, bookingB) => {
      const startDifference =
        timeToMinutes(
          bookingA.start
        ) -
        timeToMinutes(
          bookingB.start
        );

      if(startDifference !== 0){
        return startDifference;
      }

      return (
        timeToMinutes(
          bookingA.end
        ) -
        timeToMinutes(
          bookingB.end
        )
      );
    }
  );

  const laneEndTimes = [];

  const laneMap =
    new Map();

  sortedBookings.forEach(
    booking => {
      const bookingStart =
        timeToMinutes(
          booking.start
        );

      const bookingEnd =
        timeToMinutes(
          booking.end
        );

      let laneIndex =
        laneEndTimes.findIndex(
          laneEndTime =>
            bookingStart >=
            laneEndTime
        );

      if(laneIndex === -1){
        laneIndex =
          laneEndTimes.length;

        laneEndTimes.push(
          bookingEnd
        );
      }else{
        laneEndTimes[
          laneIndex
        ] = bookingEnd;
      }

      laneMap.set(
        booking.id,
        laneIndex
      );
    }
  );

  return {
    laneMap,

    laneCount:
      Math.max(
        1,
        laneEndTimes.length
      )
  };
}

function getScheduleSlotWidth(){
  const rootStyle =
    getComputedStyle(
      document.documentElement
    );

  const cssValue =
    rootStyle.getPropertyValue(
      "--schedule-slot-width"
    );

  return (
    parseFloat(cssValue) ||
    46
  );
}

function renderStaffRow(
  staff,
  currentBookings
){
  const staffBookings =
    currentBookings.filter(
      booking =>
        booking.staffId ===
          staff.id
    );

  const {
    laneMap,
    laneCount
  } =
    createBookingLaneData(
      staffBookings
    );

  /*
    予約1段：104px
    重複するたびに96pxずつ追加
  */
  const rowHeight =
    104 +
    (
      laneCount - 1
    ) * 96;

  const staffCell =
    document.createElement("div");

  staffCell.className =
    "scheduleStaffCell";

  staffCell.style.height =
    `${rowHeight}px`;

  staffCell.innerHTML =
    `<div class="scheduleStaffName">` +
      `${escapeHtml(staff.name)}` +
    `</div>` +

    `<div class="scheduleStaffMeta">` +
      `${escapeHtml(staff.hours)}` +
    `</div>` +

    `<span class="scheduleStaffBadge">` +
      `予約 ${staffBookings.length}件` +
    `</span>`;

  scheduleGrid.appendChild(
    staffCell
  );

  for(
    let slotIndex = 0;
    slotIndex < SLOT_COUNT;
    slotIndex++
  ){
    const minutes =
      START_MINUTES +
      slotIndex * SLOT_MINUTES;

    const time =
      minutesToTime(minutes);

    const slotCell =
      document.createElement("div");

    slotCell.className =
      "scheduleSlotCell";

    slotCell.style.height =
      `${rowHeight}px`;

    if(minutes % 60 === 0){
      slotCell.classList.add(
        "scheduleSlotCellHour"
      );
    }

    slotCell.dataset.staffId =
      staff.id;

    slotCell.dataset.time =
      time;

    if(minutes === END_MINUTES){
      slotCell.classList.add(
        "scheduleSlotCellClosed"
      );
    }else{
      slotCell.addEventListener(
        "click",
        () => {
          openNewBooking(
            staff.id,
            time
          );
        }
      );
    }

    const startingBookings =
      staffBookings.filter(
        booking =>
          booking.start === time
      );

    startingBookings.forEach(
      booking => {
        const laneIndex =
          laneMap.get(
            booking.id
          ) || 0;

        const bookingBlock =
          createBookingBlock(
            booking,
            laneIndex
          );

        slotCell.appendChild(
          bookingBlock
        );
      }
    );

    scheduleGrid.appendChild(
      slotCell
    );
  }
}

/* =========================
   予約ブロック
========================= */

function createBookingBlock(
  booking,
  laneIndex = 0
){
  const startMinutes =
    timeToMinutes(
      booking.start
    );

  const endMinutes =
    timeToMinutes(
      booking.end
    );

  const duration =
    Math.max(
      SLOT_MINUTES,
      endMinutes -
      startMinutes
    );

  const slotWidth =
    getScheduleSlotWidth();

  const blockWidth =
    duration /
    SLOT_MINUTES *
    slotWidth -
    4;

  const blockTop =
    8 +
    laneIndex * 96;

  const bookingBlock =
    document.createElement(
      "article"
    );

  bookingBlock.className =
    "scheduleBookingBlock";

  bookingBlock.style.width =
    `${blockWidth}px`;

  bookingBlock.style.top =
    `${blockTop}px`;

  if(
    booking.customerType ===
    "new"
  ){
    bookingBlock.classList.add(
      "scheduleBookingBlockNew"
    );
  }else{
    bookingBlock.classList.add(
      "scheduleBookingBlockRepeat"
    );
  }

  if(
    booking.status ===
    "visited"
  ){
    bookingBlock.classList.add(
      "scheduleBookingBlockVisited"
    );
  }

  if(
    booking.status ===
    "cancelled"
  ){
    bookingBlock.classList.add(
      "scheduleBookingBlockCancelled"
    );
  }

  bookingBlock.innerHTML =
    `<div class="scheduleBookingTop">` +

      `<div class="scheduleBookingName">` +
        `${escapeHtml(
          booking.customerName
        )} 様` +
      `</div>` +

      `<div class="scheduleBookingTime">` +
        `${booking.start}〜${booking.end}` +
      `</div>` +

    `</div>` +

    `<div class="scheduleBookingMenu">` +
      `${escapeHtml(
        booking.menuLabels.join("＋")
      )}` +
    `</div>` +

    `<div class="scheduleBookingTags">` +

      `${
        booking.customerType ===
        "new"
          ? `<span class="scheduleTag">新規</span>`
          : ""
      }` +

      `${
        booking.nomination ===
        "free"
          ? `<span class="scheduleTag">フリー</span>`
          : `<span class="scheduleTag">指名</span>`
      }` +

      `${
        booking.placentaMode ===
        "placenta"
          ? `<span class="scheduleTag">プラセンタカラー</span>`
          : ""
      }` +

    `</div>`;

  bookingBlock.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      openEditBooking(
        booking.id
      );
    }
  );

  return bookingBlock;
}

/* =========================
   入力画面
========================= */

function resetBookingForm(){
  editingBookingId = null;

  selectedMenus =
    new Set();

  selectedCustomerType =
    "repeat";

  selectedNomination =
    "nomination";

  selectedColorType = "";

  selectedPlacentaMode =
    "normal";

  bookingModalTitle.textContent =
    "予約入力";

  customerNameInput.value = "";

  staffSelect.value =
    STAFFS[0].id;

  startTimeSelect.value =
    "09:30";

  sourceSelect.value = "";

  noteInput.value = "";

  formMessage.textContent = "";

  cancelBookingBtn
    .classList
    .add("hidden");

  updateFormDisplay();
}

function openNewBooking(
  staffId,
  startTime
){
  resetBookingForm();

  staffSelect.value =
    staffId ||
    STAFFS[0].id;

  startTimeSelect.value =
    startTime ||
    "09:30";

  updateFormDisplay();

  openBookingModal();
}

function openEditBooking(
  bookingId
){
  const booking =
    bookings.find(
      row =>
        row.id === bookingId
    );

  if(!booking){
    return;
  }

  resetBookingForm();

  editingBookingId =
    bookingId;

  bookingModalTitle.textContent =
    "予約内容の編集";

  customerNameInput.value =
    booking.customerName || "";

  staffSelect.value =
    booking.staffId;

  startTimeSelect.value =
    booking.start;

  sourceSelect.value =
    booking.source || "";

  noteInput.value =
    booking.note || "";

  selectedCustomerType =
    booking.customerType ||
    "repeat";

  selectedNomination =
    booking.nomination ||
    "nomination";

  selectedMenus =
    new Set(
      booking.menus || []
    );

  selectedColorType =
    booking.colorType || "";

  selectedPlacentaMode =
    booking.placentaMode ||
    "normal";

  cancelBookingBtn
    .classList
    .remove("hidden");

  updateFormDisplay();

  openBookingModal();
}

function openBookingModal(){
  bookingModal
    .classList
    .remove("hidden");

  bookingModal.setAttribute(
    "aria-hidden",
    "false"
  );

  setTimeout(
    () => {
      customerNameInput.focus();
    },
    30
  );
}

function closeBookingModal(){
  bookingModal
    .classList
    .add("hidden");

  bookingModal.setAttribute(
    "aria-hidden",
    "true"
  );
}

/* =========================
   入力画面の表示更新
========================= */

function updateFormDisplay(){
  document
    .querySelectorAll(
      "[data-customer-type]"
    )
    .forEach(
      button => {
        button.classList.toggle(
          "active",
          button.dataset
            .customerType ===
            selectedCustomerType
        );
      }
    );

  document
    .querySelectorAll(
      "[data-nomination]"
    )
    .forEach(
      button => {
        button.classList.toggle(
          "active",
          button.dataset
            .nomination ===
            selectedNomination
        );
      }
    );

  document
    .querySelectorAll(
      "[data-placenta]"
    )
    .forEach(
      button => {
        button.classList.toggle(
          "active",
          button.dataset
            .placenta ===
            selectedPlacentaMode
        );
      }
    );

  updateMenuAvailability();

  updateColorDisplay();

  updateEndTimeDisplay();
}

function updateMenuAvailability(){
  const selectedStaffId =
    staffSelect.value;

  document
    .querySelectorAll(
      "[data-menu-id]"
    )
    .forEach(
      button => {
        const menuId =
          button.dataset.menuId;

        const menu =
          getMenuById(menuId);

        const onlyStaffDisabled =
          menu.onlyStaff &&
          menu.onlyStaff !==
            selectedStaffId;

        const disabledForStaff =
          (
            menu.disabledStaffs ||
            []
          ).includes(
            selectedStaffId
          );

        const disabled =
          onlyStaffDisabled ||
          disabledForStaff;

        button.disabled =
          disabled;

        button.classList.toggle(
          "disabled",
          disabled
        );

        if(
          disabled &&
          selectedMenus.has(
            menuId
          )
        ){
          selectedMenus.delete(
            menuId
          );
        }

        button.classList.toggle(
          "active",
          selectedMenus.has(
            menuId
          )
        );
      }
    );
}

function updateColorDisplay(){
  const colorSelected =
    hasSelectedColorMenu();

  colorOptionsSection
    .classList
    .toggle(
      "hidden",
      !colorSelected
    );

  document
    .querySelectorAll(
      "[data-color-type]"
    )
    .forEach(
      button => {
        button.classList.toggle(
          "active",
          button.dataset
            .colorType ===
            selectedColorType
        );
      }
    );

  const placentaAvailable =
    selectedColorType ===
      "gray" ||
    selectedColorType ===
      "fashion";

  placentaChoice
    .classList
    .toggle(
      "hidden",
      !placentaAvailable
    );

  if(!placentaAvailable){
    selectedPlacentaMode =
      "normal";
  }
}

function calculateEndTime(){
  const duration =
    getSelectedDuration();

  if(duration <= 0){
    return "—";
  }

  const startMinutes =
    timeToMinutes(
      startTimeSelect.value
    );

  return minutesToTime(
    startMinutes +
    duration
  );
}

function updateEndTimeDisplay(){
  endTimeDisplay.textContent =
    calculateEndTime();
}

/* =========================
   メニュー選択
========================= */

function toggleMenu(menuId){
  const menu =
    getMenuById(menuId);

  if(!menu){
    return;
  }

  if(
    selectedMenus.has(
      menuId
    )
  ){
    selectedMenus.delete(
      menuId
    );
  }else{
    const combinationSelected =
      COMBINATION_MENUS.some(
        item =>
          item.id === menuId
      );

    if(combinationSelected){
      COMBINATION_MENUS
        .forEach(
          item => {
            selectedMenus.delete(
              item.id
            );
          }
        );
    }

    selectedMenus.add(
      menuId
    );
  }

  updateFormDisplay();
}

/* =========================
   重複確認
========================= */

function hasBookingOverlap(
  candidate
){
  return bookings.some(
    booking => {
      if(
        booking.id ===
          editingBookingId ||
        booking.status ===
          "cancelled"
      ){
        return false;
      }

      if(
        booking.date !==
          candidate.date ||
        booking.staffId !==
          candidate.staffId
      ){
        return false;
      }

      const candidateStart =
        timeToMinutes(
          candidate.start
        );

      const candidateEnd =
        timeToMinutes(
          candidate.end
        );

      const bookingStart =
        timeToMinutes(
          booking.start
        );

      const bookingEnd =
        timeToMinutes(
          booking.end
        );

      return (
        candidateStart <
          bookingEnd &&
        candidateEnd >
          bookingStart
      );
    }
  );
}

/* =========================
   保存
========================= */

function saveBooking(){
  formMessage.textContent = "";

  const customerName =
    customerNameInput
      .value
      .trim();

  if(!customerName){
    formMessage.textContent =
      "お客様名を入力してください。";

    customerNameInput.focus();

    return;
  }

  if(selectedMenus.size === 0){
    formMessage.textContent =
      "メニューを1つ以上選んでください。";

    return;
  }

  if(
    hasSelectedColorMenu() &&
    !selectedColorType
  ){
    formMessage.textContent =
      "カラーの種類を選んでください。";

    return;
  }

  const endTime =
    calculateEndTime();

  if(endTime === "—"){
    formMessage.textContent =
      "終了時間を計算できませんでした。";

    return;
  }

  if(
    timeToMinutes(endTime) >
    END_MINUTES
  ){
    formMessage.textContent =
      "終了予定が18:00を超えています。開始時間かメニューを変更してください。";

    return;
  }

  const bookingData = {
    id:
      editingBookingId ||
      createId(),

    date:
      toDateKey(viewDate),

    staffId:
      staffSelect.value,

    customerName,

    start:
      startTimeSelect.value,

    end:
      endTime,

    customerType:
      selectedCustomerType,

    nomination:
      selectedNomination,

    menus:[
      ...selectedMenus
    ],

    menuLabels:
      getSelectedMenuLabels(),

    colorType:
      hasSelectedColorMenu()
        ? selectedColorType
        : "",

    placentaMode:
      hasSelectedColorMenu()
        ? selectedPlacentaMode
        : "normal",

    source:
      sourceSelect.value,

    note:
      noteInput.value.trim(),

    status:
      "reserved"
  };

  if(
    hasBookingOverlap(
      bookingData
    )
  ){
    const continueSaving =
      window.confirm(
        "この時間には別の予約があります。\n重ねて予約しますか？"
      );

    if(!continueSaving){
      return;
    }
  }

  if(editingBookingId){
    bookings =
      bookings.map(
        booking =>
          booking.id ===
            editingBookingId
            ? bookingData
            : booking
      );
  }else{
    bookings.push(
      bookingData
    );
  }

  saveBookings();

  closeBookingModal();

  renderSchedule();
}

/* =========================
   キャンセル
========================= */

function cancelBooking(){
  if(!editingBookingId){
    return;
  }

  const booking =
    bookings.find(
      row =>
        row.id ===
        editingBookingId
    );

  if(!booking){
    return;
  }

  const confirmed =
    window.confirm(
      `${booking.customerName} 様の予約をキャンセルしますか？`
    );

  if(!confirmed){
    return;
  }

  booking.status =
    "cancelled";

  saveBookings();

  closeBookingModal();

  renderSchedule();
}

/* =========================
   イベント
========================= */

function setupEvents(){
  prevDayBtn.addEventListener(
    "click",
    () => {
      viewDate =
        addDays(
          viewDate,
          -1
        );

      renderSchedule();
    }
  );

  nextDayBtn.addEventListener(
    "click",
    () => {
      viewDate =
        addDays(
          viewDate,
          1
        );

      renderSchedule();
    }
  );

  todayBtn.addEventListener(
    "click",
    () => {
      const today =
        new Date();

      viewDate =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

      renderSchedule();
    }
  );

  newBookingBtn.addEventListener(
    "click",
    () => {
      openNewBooking(
        STAFFS[0].id,
        "09:30"
      );
    }
  );

  modalCloseBtn.addEventListener(
    "click",
    closeBookingModal
  );

  modalCancelBtn.addEventListener(
    "click",
    closeBookingModal
  );

  const modalBackdrop =
    document.querySelector(
      "[data-close='true']"
    );

  modalBackdrop
    ?.addEventListener(
      "click",
      closeBookingModal
    );

  staffSelect.addEventListener(
    "change",
    updateFormDisplay
  );

  startTimeSelect.addEventListener(
    "change",
    updateEndTimeDisplay
  );

  document.addEventListener(
    "click",
    event => {
      const menuButton =
        event.target.closest(
          "[data-menu-id]"
        );

      if(menuButton){
        toggleMenu(
          menuButton.dataset
            .menuId
        );

        return;
      }

      const colorButton =
        event.target.closest(
          "[data-color-type]"
        );

      if(colorButton){
        selectedColorType =
          colorButton.dataset
            .colorType;

        updateFormDisplay();

        return;
      }

      const customerTypeButton =
        event.target.closest(
          "[data-customer-type]"
        );

      if(customerTypeButton){
        selectedCustomerType =
          customerTypeButton
            .dataset
            .customerType;

        updateFormDisplay();

        return;
      }

      const nominationButton =
        event.target.closest(
          "[data-nomination]"
        );

      if(nominationButton){
        selectedNomination =
          nominationButton
            .dataset
            .nomination;

        updateFormDisplay();

        return;
      }

      const placentaButton =
        event.target.closest(
          "[data-placenta]"
        );

      if(placentaButton){
        selectedPlacentaMode =
          placentaButton
            .dataset
            .placenta;

        updateFormDisplay();
      }
    }
  );

  saveBookingBtn.addEventListener(
    "click",
    saveBooking
  );

  cancelBookingBtn.addEventListener(
    "click",
    cancelBooking
  );

  document.addEventListener(
    "keydown",
    event => {
      if(
        event.key === "Escape" &&
        !bookingModal
          .classList
          .contains("hidden")
      ){
        closeBookingModal();
      }
    }
  );
}

/* =========================
   開始
========================= */

renderStaffOptions();

renderTimeOptions();

renderMenuButtons();

renderColorTypeButtons();

setupEvents();

createDemoBookings();

renderSchedule();
