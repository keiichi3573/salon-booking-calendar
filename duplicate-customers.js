const sb =
  supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

const duplicateCustomersApp =
  document.getElementById(
    "duplicateCustomersApp"
  );

const duplicateCustomersLoading =
  document.getElementById(
    "duplicateCustomersLoading"
  );

const duplicateCustomersEmpty =
  document.getElementById(
    "duplicateCustomersEmpty"
  );

const duplicateCustomersList =
  document.getElementById(
    "duplicateCustomersList"
  );

const duplicateCustomersAccessDenied =
  document.getElementById(
    "duplicateCustomersAccessDenied"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );


/* =========================
   表示用
========================= */

function getReviewStatusLabel(
  status
){

  switch(status){

    case "same_person":
      return "同一人物";

    case "different_person":
      return "別人";

    case "unknown":
      return "分からない";

    default:
      return "未確認";

  }

}


/* =========================
   同名顧客一覧取得
========================= */

async function loadDuplicateCustomerGroups(){

  const {
    data: groups,
    error: groupError
  } =
    await sb.rpc(
      "get_duplicate_customer_groups"
    );

  if(groupError){
    throw groupError;
  }

  const {
    data: reviews,
    error: reviewError
  } =
    await sb
      .from(
        "duplicate_customer_reviews"
      )
      .select(
        "normalized_name,review_status,note,reviewed_at"
      );

  if(reviewError){
    throw reviewError;
  }

  const reviewMap =
    new Map();

  for(
    const review
    of reviews || []
  ){

    reviewMap.set(
      review.normalized_name,
      review
    );

  }

  return (groups || []).map(
    group => {

      const review =
        reviewMap.get(
          group.normalized_name
        );

      return {
        ...group,

        review_status:
          review?.review_status ||
          "pending",

        note:
          review?.note || "",

        reviewed_at:
          review?.reviewed_at ||
          null
      };

    }
  );

}

/* =========================
   同名顧客 詳細取得
========================= */

async function loadDuplicateCustomerDetails(
  normalizedName
){

  const {
    data,
    error
  } =
    await sb.rpc(
      "get_duplicate_customer_details",
      {
        p_normalized_name:
          normalizedName
      }
    );

  if(error){
    throw error;
  }

  return data || [];

}


/* =========================
   スタッフ名
========================= */

function getStaffLabel(
  staffId
){

  if(staffId === "kitamura"){
    return "北村";
  }

  if(staffId === "yamazaki"){
    return "山崎";
  }

  if(staffId === "takeuchi"){
    return "竹内";
  }

  return "—";

}


/* =========================
   同名顧客 詳細表示
========================= */

function renderDuplicateCustomerDetails(
  detailArea,
  rows
){

  detailArea.innerHTML = "";

  const customerMap =
    new Map();

  for(const row of rows){

    if(
      !customerMap.has(
        row.customer_id
      )
    ){

      customerMap.set(
  row.customer_id,
  {
    customerId:
      row.customer_id,

    name:
      row.customer_name,

    phone:
      row.phone,

    birthMonth:
      row.birth_month,

    chartNumber:
      row.chart_number,

    primaryStaffId:
      row.primary_staff_id,

    note:
      row.customer_note,

    appointments:
      []
  }
);

    }

    if(row.appointment_id){

      customerMap
        .get(row.customer_id)
        .appointments
        .push(row);

    }

  }

  for(
    const customer
    of customerMap.values()
  ){

    const box =
      document.createElement(
        "div"
      );

    box.style.marginTop =
      "14px";

    box.style.padding =
      "16px";

    box.style.border =
      "1px solid #eadfda";

    box.style.borderRadius =
      "12px";

    box.style.background =
      "#ffffff";

    const title =
      document.createElement(
        "div"
      );

    title.style.fontWeight =
      "700";

    title.style.fontSize =
      "16px";

    title.style.marginBottom =
      "10px";

    title.textContent =
      `${customer.name || "—"} / 担当 ${
        getStaffLabel(
          customer.primaryStaffId
        )
      }`;

    box.appendChild(
      title
    );

    const editGrid =
  document.createElement(
    "div"
  );

editGrid.style.display =
  "grid";

editGrid.style.gridTemplateColumns =
  "repeat(2, minmax(0, 1fr))";

editGrid.style.gap =
  "10px";

editGrid.style.marginTop =
  "12px";


function createField(
  labelText,
  inputElement
){

  const wrapper =
    document.createElement(
      "label"
    );

  wrapper.style.display =
    "flex";

  wrapper.style.flexDirection =
    "column";

  wrapper.style.gap =
    "5px";

  wrapper.style.fontSize =
    "12px";

  wrapper.style.fontWeight =
    "700";

  wrapper.style.color =
    "#6e5b54";

  const label =
    document.createElement(
      "span"
    );

  label.textContent =
    labelText;

  wrapper.appendChild(
    label
  );

  inputElement.style.minHeight =
    "40px";

  inputElement.style.padding =
    "8px 10px";

  inputElement.style.border =
    "1px solid #d8c7c0";

  inputElement.style.borderRadius =
    "8px";

  inputElement.style.fontSize =
    "14px";

  inputElement.style.boxSizing =
    "border-box";

  wrapper.appendChild(
    inputElement
  );

  return wrapper;
}


const nameInput =
  document.createElement(
    "input"
  );

nameInput.type =
  "text";

nameInput.value =
  customer.name || "";


const phoneInput =
  document.createElement(
    "input"
  );

phoneInput.type =
  "tel";

phoneInput.value =
  customer.phone || "";


const birthMonthSelect =
  document.createElement(
    "select"
  );

const birthEmptyOption =
  document.createElement(
    "option"
  );

birthEmptyOption.value =
  "";

birthEmptyOption.textContent =
  "未登録";

birthMonthSelect.appendChild(
  birthEmptyOption
);

for(
  let month = 1;
  month <= 12;
  month++
){

  const option =
    document.createElement(
      "option"
    );

  option.value =
    String(month);

  option.textContent =
    `${month}月`;

  birthMonthSelect.appendChild(
    option
  );

}

birthMonthSelect.value =
  customer.birthMonth
    ? String(customer.birthMonth)
    : "";


const chartNumberInput =
  document.createElement(
    "input"
  );

chartNumberInput.type =
  "text";

chartNumberInput.value =
  customer.chartNumber || "";


const staffSelect =
  document.createElement(
    "select"
  );

const staffOptions = [
  ["", "未設定"],
  ["kitamura", "北村"],
  ["yamazaki", "山崎"],
  ["takeuchi", "竹内"]
];

for(
  const [
    value,
    label
  ]
  of staffOptions
){

  const option =
    document.createElement(
      "option"
    );

  option.value =
    value;

  option.textContent =
    label;

  staffSelect.appendChild(
    option
  );

}

staffSelect.value =
  customer.primaryStaffId || "";


const noteInput =
  document.createElement(
    "textarea"
  );

noteInput.rows =
  3;

noteInput.value =
  customer.note || "";

noteInput.style.resize =
  "vertical";


editGrid.appendChild(
  createField(
    "お名前",
    nameInput
  )
);

editGrid.appendChild(
  createField(
    "電話番号",
    phoneInput
  )
);

editGrid.appendChild(
  createField(
    "誕生月",
    birthMonthSelect
  )
);

editGrid.appendChild(
  createField(
    "カルテ番号",
    chartNumberInput
  )
);

editGrid.appendChild(
  createField(
    "主担当",
    staffSelect
  )
);

editGrid.appendChild(
  createField(
    "メモ",
    noteInput
  )
);

box.appendChild(
  editGrid
);

    const historyTitle =
      document.createElement(
        "div"
      );

    historyTitle.style.marginTop =
      "12px";

    historyTitle.style.marginBottom =
      "6px";

    historyTitle.style.fontWeight =
      "700";

    historyTitle.textContent =
      "予約履歴";

    box.appendChild(
      historyTitle
    );

    if(
      customer.appointments.length === 0
    ){

      const empty =
        document.createElement(
          "div"
        );

      empty.style.fontSize =
        "13px";

      empty.textContent =
        "予約履歴なし";

      box.appendChild(
        empty
      );

    }else{

      for(
        const appointment
        of customer.appointments
      ){

        const row =
          document.createElement(
            "div"
          );

        row.style.padding =
          "8px 0";

        row.style.borderTop =
          "1px solid #f0e8e5";

        row.style.fontSize =
          "13px";

        const time =
          appointment.start_time
            ? appointment.start_time.slice(
                0,
                5
              )
            : "";

        row.textContent =
          `${appointment.appointment_date} ${time}` +
          ` / 担当 ${
            getStaffLabel(
              appointment.appointment_staff_id
            )
          }` +
          ` / ${
            appointment.appointment_status || "—"
          }`;

        box.appendChild(
          row
        );

      }

    }

    detailArea.appendChild(
      box
    );

  }

}

/* =========================
   確認結果保存
========================= */

async function saveDuplicateCustomerReview(
  normalizedName,
  reviewStatus
){

  const {
    error
  } =
    await sb
      .from(
        "duplicate_customer_reviews"
      )
      .upsert(
        {
          normalized_name:
            normalizedName,

          review_status:
            reviewStatus,

          reviewed_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString()
        },
        {
          onConflict:
            "normalized_name"
        }
      );

  if(error){
    throw error;
  }

}

/* =========================
   同名顧客一覧表示
========================= */

function renderDuplicateCustomerGroups(
  groups
){

  duplicateCustomersLoading
    ?.classList
    .add("hidden");

  if(
    !duplicateCustomersList ||
    !duplicateCustomersEmpty
  ){
    return;
  }

  duplicateCustomersList.innerHTML =
    "";

  if(groups.length === 0){

    duplicateCustomersEmpty
      .classList
      .remove("hidden");

    duplicateCustomersList
      .classList
      .add("hidden");

    return;

  }

  duplicateCustomersEmpty
    .classList
    .add("hidden");

  duplicateCustomersList
    .classList
    .remove("hidden");

  for(
    const group
    of groups
  ){

    const card =
      document.createElement(
        "div"
      );

    card.className =
      "duplicateCard";

    const top =
      document.createElement(
        "div"
      );

    top.className =
      "duplicateCardTop";

    const name =
      document.createElement(
        "div"
      );

    name.className =
      "duplicateName";

    name.textContent =
      group.display_name ||
      group.normalized_name ||
      "—";

    const status =
      document.createElement(
        "span"
      );

    status.className =
      "duplicateStatus";

    status.textContent =
      getReviewStatusLabel(
        group.review_status
      );

    top.appendChild(
      name
    );

    top.appendChild(
      status
    );

    const meta =
      document.createElement(
        "div"
      );

    meta.className =
      "duplicateMeta";

    const customerCount =
      document.createElement(
        "div"
      );

    customerCount.className =
      "duplicateMetaItem";

    customerCount.textContent =
      `顧客登録：${group.customer_count ?? 0}名`;

    const appointmentCount =
      document.createElement(
        "div"
      );

    appointmentCount.className =
      "duplicateMetaItem";

    appointmentCount.textContent =
      `予約履歴：${group.appointment_count ?? 0}件`;

    const staffCount =
      document.createElement(
        "div"
      );

    staffCount.className =
      "duplicateMetaItem";

    staffCount.textContent =
      `担当スタッフ：${group.staff_count ?? 0}名`;

    meta.appendChild(
      customerCount
    );

    meta.appendChild(
      appointmentCount
    );

    meta.appendChild(
      staffCount
    );

    const actions =
      document.createElement(
        "div"
      );

    actions.className =
      "duplicateActions";

    const detailBtn =
      document.createElement(
        "button"
      );

    detailBtn.type =
      "button";

    detailBtn.className =
      "duplicateBtn duplicateBtnPrimary";

    detailBtn.textContent =
      "確認する";

    /*
      詳細確認機能は次の工程で実装
    */
    const detailArea =
  document.createElement(
    "div"
  );

detailArea.style.marginTop =
  "12px";

detailArea.classList.add(
  "hidden"
);

detailBtn.addEventListener(
  "click",
  async () => {

    if(
      !detailArea.classList.contains(
        "hidden"
      )
    ){

      detailArea.classList.add(
        "hidden"
      );

      detailBtn.textContent =
        "確認する";

      return;
    }

    detailBtn.disabled =
      true;

    detailBtn.textContent =
      "読み込み中…";

    try{

      const rows =
        await loadDuplicateCustomerDetails(
          group.normalized_name
        );

      renderDuplicateCustomerDetails(
        detailArea,
        rows
      );

      detailArea.classList.remove(
        "hidden"
      );

      detailBtn.textContent =
        "閉じる";

    }catch(error){

      console.error(
        "同名顧客詳細取得エラー:",
        error
      );

      window.alert(
        "詳細情報を読み込めませんでした。"
      );

      detailBtn.textContent =
        "確認する";

    }finally{

      detailBtn.disabled =
        false;

    }

  }
);

    actions.appendChild(
      detailBtn
    );

    const samePersonBtn =
  document.createElement(
    "button"
  );

samePersonBtn.type =
  "button";

samePersonBtn.className =
  "duplicateBtn";

samePersonBtn.textContent =
  "同一人物";


const differentPersonBtn =
  document.createElement(
    "button"
  );

differentPersonBtn.type =
  "button";

differentPersonBtn.className =
  "duplicateBtn";

differentPersonBtn.textContent =
  "別人";


const unknownBtn =
  document.createElement(
    "button"
  );

unknownBtn.type =
  "button";

unknownBtn.className =
  "duplicateBtn";

unknownBtn.textContent =
  "分からない";


async function saveReview(
  reviewStatus
){

  samePersonBtn.disabled =
    true;

  differentPersonBtn.disabled =
    true;

  unknownBtn.disabled =
    true;

  try{

    await saveDuplicateCustomerReview(
      group.normalized_name,
      reviewStatus
    );

    group.review_status =
      reviewStatus;

    status.textContent =
      getReviewStatusLabel(
        reviewStatus
      );

    window.alert(
      "確認結果を保存しました。"
    );

  }catch(error){

    console.error(
      "確認結果保存エラー:",
      error
    );

    window.alert(
      "確認結果を保存できませんでした。"
    );

  }finally{

    samePersonBtn.disabled =
      false;

    differentPersonBtn.disabled =
      false;

    unknownBtn.disabled =
      false;

  }

}


samePersonBtn.addEventListener(
  "click",
  () => {

    saveReview(
      "same_person"
    );

  }
);


differentPersonBtn.addEventListener(
  "click",
  () => {

    saveReview(
      "different_person"
    );

  }
);


unknownBtn.addEventListener(
  "click",
  () => {

    saveReview(
      "unknown"
    );

  }
);


actions.appendChild(
  samePersonBtn
);

actions.appendChild(
  differentPersonBtn
);

actions.appendChild(
  unknownBtn
);

    card.appendChild(
      top
    );

    card.appendChild(
      meta
    );

    card.appendChild(
      actions
    );

    card.appendChild(
  detailArea
);

    duplicateCustomersList
      .appendChild(
        card
      );

  }

}


/* =========================
   初期化
========================= */

async function initializeDuplicateCustomers(){

  try{

    const {
      data: sessionData,
      error: sessionError
    } =
      await sb.auth.getSession();

    if(sessionError){
      throw sessionError;
    }

    if(!sessionData.session){

      window.location.href =
        "index.html";

      return;

    }

    const {
      data: canAccess,
      error: accessError
    } =
      await sb.rpc(
        "can_access_customers"
      );

    if(accessError){
      throw accessError;
    }

    if(canAccess !== true){

      duplicateCustomersAccessDenied
        ?.classList
        .remove("hidden");

      return;

    }

    const groups =
      await loadDuplicateCustomerGroups();

    renderDuplicateCustomerGroups(
      groups
    );

    duplicateCustomersApp
      ?.classList
      .remove("hidden");

    logoutBtn
      ?.classList
      .remove("hidden");

}catch(error){

  console.error(
    "同名顧客確認初期化エラー:",
    error
  );

  window.alert(
    error?.message ||
    "同名顧客確認ページの読み込み中にエラーが発生しました。"
  );

  duplicateCustomersLoading
    ?.classList
    .add("hidden");

  duplicateCustomersAccessDenied
    ?.classList
    .remove("hidden");

}

}


/* =========================
   ログアウト
========================= */

if(logoutBtn){

  logoutBtn.addEventListener(
    "click",
    async () => {

      const {
        error
      } =
        await sb.auth.signOut();

      if(error){

        console.error(
          "ログアウトエラー:",
          error
        );

        return;

      }

      window.location.href =
        "index.html";

    }
  );

}


initializeDuplicateCustomers();
