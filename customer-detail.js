const sb =
  supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

const customerDetailApp =
  document.getElementById(
    "customerDetailApp"
  );

const customerDetailAccessDenied =
  document.getElementById(
    "customerDetailAccessDenied"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );

/* =========================
   URLから顧客ID取得
========================= */

function getCustomerId(){

  const params =
    new URLSearchParams(
      window.location.search
    );

  return params.get("id");

}

/* =========================
   顧客情報取得
========================= */

async function loadCustomer(
  customerId
){

  const {
    data,
    error
  } =
    await sb
      .from("customers")
      .select(`
id,
chart_number,
name,
phone,
postal_code,
address,
birth_month,
first_visit_date,
last_visit_date,
visit_count,
primary_staff_id,
first_source,
note
`)
      .eq(
        "id",
        customerId
      )
      .single();

  if(error){
    throw error;
  }

  return data;

}

/* =========================
   顧客情報表示
========================= */

function renderCustomer(
  customer
){

  const staffName =
    customer.primary_staff_id ===
    "kitamura"
      ? "北村"
      :
    customer.primary_staff_id ===
    "yamazaki"
      ? "山崎"
      :
    customer.primary_staff_id ===
    "takeuchi"
      ? "竹内"
      : "—";

  const setText =
    (
      id,
      value
    ) => {

      const el =
        document.getElementById(
          id
        );

      if(el){
        el.textContent = value;
      }

    };

  setText(
    "customerDetailName",
    customer.name ?? "顧客詳細"
  );

  setText(
    "customerDetailPhone",
    customer.phone ?? "—"
  );

const chartNumberInput =
  document.getElementById(
    "customerDetailChartNumberInput"
  );
  
const phoneInput =
  document.getElementById(
    "customerDetailPhoneInput"
  );

const postalCodeInput =
  document.getElementById(
    "customerDetailPostalCodeInput"
  );

const addressInput =
  document.getElementById(
    "customerDetailAddressInput"
  );

const birthMonthSelect =
  document.getElementById(
    "customerDetailBirthMonthSelect"
  );

const staffSelect =
  document.getElementById(
    "customerDetailStaffSelect"
  );

const noteInput =
  document.getElementById(
    "customerDetailNoteInput"
  );

const chartNumberInput =
  document.getElementById(
    "customerDetailChartNumberInput"
  );

if(chartNumberInput){
  chartNumberInput.value =
    customer.chart_number ?? "";
}
  
if(phoneInput){
  phoneInput.value =
    customer.phone ?? "";
}

if(postalCodeInput){
  postalCodeInput.value =
    customer.postal_code ?? "";
}

if(addressInput){
  addressInput.value =
    customer.address ?? "";
}

if(birthMonthSelect){
  birthMonthSelect.value =
    customer.birth_month
      ? String(customer.birth_month)
      : "";
}

if(staffSelect){
  staffSelect.value =
    customer.primary_staff_id ?? "";
}

if(noteInput){
  noteInput.value =
    customer.note ?? "";
}
  
  setText(
    "customerDetailBirthMonth",
    customer.birth_month
      ? `${customer.birth_month}月`
      : "—"
  );

  setText(
    "customerDetailStaff",
    staffName
  );

  setText(
    "customerDetailFirstVisit",
    customer.first_visit_date ?? "—"
  );

  setText(
    "customerDetailLastVisit",
    customer.last_visit_date ?? "—"
  );

  setText(
    "customerDetailVisitCount",
    customer.visit_count ?? 0
  );

  setText(
    "customerDetailFirstSource",
    customer.first_source ?? "—"
  );

}

/* =========================
   予約履歴取得
========================= */

async function loadCustomerHistory(
  customerId
){

  const {
    data,
    error
  } =
    await sb
      .from("appointments")
      .select(`
        id,
        appointment_date,
        start_time,
        staff_id,
        menu_labels,
        status,
        source,
        note
      `)
      .eq(
        "customer_id",
        customerId
      )
      .order(
        "appointment_date",
        {
          ascending: false
        }
      )
      .order(
        "start_time",
        {
          ascending: false
        }
      );

  if(error){
    throw error;
  }

  return data ?? [];

}

/* =========================
   予約履歴表示
========================= */

function renderCustomerHistory(
  history
){

  const loading =
    document.getElementById(
      "customerHistoryLoading"
    );

  const empty =
    document.getElementById(
      "customerHistoryEmpty"
    );

  const list =
    document.getElementById(
      "customerHistoryList"
    );

  loading
    ?.classList
    .add("hidden");

  if(!empty || !list){
    return;
  }

  list.innerHTML = "";

  if(history.length === 0){

    empty
      .classList
      .remove("hidden");

    list
      .classList
      .add("hidden");

    return;

  }

  empty
    .classList
    .add("hidden");

  list
    .classList
    .remove("hidden");

  for(
    const appointment
    of history
  ){

    const staffName =
      appointment.staff_id ===
      "kitamura"
        ? "北村"
        :
      appointment.staff_id ===
      "yamazaki"
        ? "山崎"
        :
      appointment.staff_id ===
      "takeuchi"
        ? "竹内"
        : "—";

    const menu =
      Array.isArray(
        appointment.menu_labels
      )
        ? appointment.menu_labels.join("・")
        : "—";

    const item =
      document.createElement(
        "div"
      );

    item.style.marginBottom =
      "16px";

    item.style.padding =
      "14px";

    item.style.border =
      "1px solid #ddd";

    item.style.borderRadius =
      "10px";

    item.innerHTML = `
      <div>
        <strong>
          ${appointment.appointment_date}
          ${appointment.start_time?.slice(0, 5) ?? ""}
        </strong>
      </div>

      <div>
        担当：${staffName}
      </div>

      <div>
        メニュー：${menu}
      </div>

      <div>
        状態：${appointment.status ?? "—"}
      </div>

      <div>
        予約経路：${appointment.source ?? "—"}
      </div>
    `;

    list.appendChild(
      item
    );

  }

}

/* =========================
   初期化
========================= */

async function initializeCustomerDetail(){

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

      customerDetailAccessDenied
        ?.classList
        .remove("hidden");

      return;

    }

    const customerId =
      getCustomerId();

    if(!customerId){
      throw new Error(
        "customer id is missing"
      );
    }

    const customer =
      await loadCustomer(
        customerId
      );

    renderCustomer(
      customer
    );

    const history =
      await loadCustomerHistory(
        customerId
      );

    renderCustomerHistory(
      history
    );

    customerDetailApp
      ?.classList
      .remove("hidden");

    logoutBtn
      ?.classList
      .remove("hidden");

  }catch(error){

    console.error(
      "顧客詳細初期化エラー:",
      error
    );

    customerDetailAccessDenied
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

/* =========================
   顧客情報保存
========================= */

const saveCustomerInfoBtn =
  document.getElementById(
    "saveCustomerInfoBtn"
  );

const deleteCustomerBtn =
  document.getElementById(
    "deleteCustomerBtn"
  );

async function saveCustomerInfo(){

  const customerId =
    getCustomerId();

  if(!customerId){
    return;
  }

  const phoneInput =
    document.getElementById(
      "customerDetailPhoneInput"
    );

  const postalCodeInput =
    document.getElementById(
      "customerDetailPostalCodeInput"
    );

  const addressInput =
    document.getElementById(
      "customerDetailAddressInput"
    );

  const birthMonthSelect =
    document.getElementById(
      "customerDetailBirthMonthSelect"
    );

  const staffSelect =
    document.getElementById(
      "customerDetailStaffSelect"
    );

  const noteInput =
    document.getElementById(
      "customerDetailNoteInput"
    );

  if(
  !chartNumberInput ||
  !phoneInput ||
  !postalCodeInput ||
  !addressInput ||
  !birthMonthSelect ||
  !staffSelect ||
  !noteInput
){
  return;
}

  const phone =
    phoneInput.value
      .replace(/\D/g, "");

  if(
    phone &&
    !/^[0-9]{10,11}$/.test(phone)
  ){

    window.alert(
      "電話番号は10～11桁の数字で入力してください。"
    );

    return;

  }

  const birthMonth =
    birthMonthSelect.value
      ? Number(
          birthMonthSelect.value
        )
      : null;

  saveCustomerInfoBtn.disabled =
    true;

  saveCustomerInfoBtn.textContent =
    "保存中…";

  try{

    const {
      error
    } =
      await sb
        .from("customers")
        .update({
          chart_number:
  chartNumberInput.value.trim() || null,
          
          phone:
            phone || null,

          postal_code:
            postalCodeInput.value.trim() || null,

          address:
            addressInput.value.trim() || null,

          birth_month:
            birthMonth,

          primary_staff_id:
            staffSelect.value || null,

          note:
            noteInput.value.trim() || null,

          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          customerId
        );

    if(error){
      throw error;
    }

    window.alert(
      "顧客情報を保存しました。"
    );

  }catch(error){

    console.error(
      "顧客情報保存エラー:",
      error
    );

    window.alert(
      "顧客情報を保存できませんでした。"
    );

  }finally{

    saveCustomerInfoBtn.disabled =
      false;

    saveCustomerInfoBtn.textContent =
      "顧客情報を保存";

  }

}

if(saveCustomerInfoBtn){

  saveCustomerInfoBtn
    .addEventListener(
      "click",
      saveCustomerInfo
    );

}

async function deleteCustomer(){

  const customerId =
    getCustomerId();

  if(!customerId){
    return;
  }

  const confirmed =
    window.confirm(
      "この顧客を削除しますか？\n過去の予約履歴は残ります。"
    );

  if(!confirmed){
    return;
  }

  deleteCustomerBtn.disabled =
    true;

  deleteCustomerBtn.textContent =
    "削除中…";

  try{

    const {
      error
    } =
      await sb
        .from("customers")
        .delete()
        .eq(
          "id",
          customerId
        );

    if(error){
      throw error;
    }

    window.alert(
      "顧客を削除しました。"
    );

    window.location.href =
      "customers.html";

  }catch(error){

    console.error(
      "顧客削除エラー:",
      error
    );

    window.alert(
      "顧客を削除できませんでした。"
    );

    deleteCustomerBtn.disabled =
      false;

    deleteCustomerBtn.textContent =
      "顧客を削除";

  }

}

if(deleteCustomerBtn){

  deleteCustomerBtn
    .addEventListener(
      "click",
      deleteCustomer
    );

}

initializeCustomerDetail();
