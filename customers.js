const sb =
  supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

const customersApp =
  document.getElementById(
    "customersApp"
  );

const customersAccessDenied =
  document.getElementById(
    "customersAccessDenied"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );

/* =========================
   顧客管理 初期化
========================= */

async function initializeCustomers(){

  try{

    /*
      ログイン確認
    */
    const {
      data: sessionData,
      error: sessionError
    } =
      await sb.auth.getSession();

    if(sessionError){
      throw sessionError;
    }

    /*
      未ログインなら
      トップ画面へ戻す
    */
    if(!sessionData.session){

      window.location.href =
        "index.html";

      return;
    }

    /*
      顧客管理の利用権限確認
    */
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

    /*
      権限なし
    */
    if(canAccess !== true){

      customersAccessDenied
        ?.classList
        .remove("hidden");

      return;
    }

    /*
      権限あり
      この段階で初めて画面を表示
    */
    customersApp
      ?.classList
      .remove("hidden");

    logoutBtn
      ?.classList
      .remove("hidden");

    allCustomers =
  await loadCustomers();

renderCustomers(
  allCustomers
);

  }catch(error){

    console.error(
      "顧客管理初期化エラー:",
      error
    );

    customersAccessDenied
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
   顧客一覧読み込み
========================= */

async function loadCustomers(){

  const {
    data,
    error
  } =
    await sb
      .from("customers")
      .select(`
        id,
        name,
        phone,
        birth_month,
        last_visit_date,
        visit_count,
        primary_staff_id
      `)
      .order(
        "created_at",
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
   顧客一覧表示
========================= */

function renderCustomers(customers){

  const customerCount =
    document.getElementById(
      "customerCount"
    );

  const customersLoading =
    document.getElementById(
      "customersLoading"
    );

  const customersEmpty =
    document.getElementById(
      "customersEmpty"
    );

  const customersList =
    document.getElementById(
      "customersList"
    );

  const customersTableBody =
    document.getElementById(
      "customersTableBody"
    );

  if(customerCount){

    customerCount.textContent =
      `顧客 ${customers.length}名`;

  }

  customersLoading
    ?.classList
    .add("hidden");

  if(
    !customersTableBody ||
    !customersList ||
    !customersEmpty
  ){
    return;
  }

  customersTableBody.innerHTML =
    "";

  if(customers.length === 0){

    customersEmpty
      .classList
      .remove("hidden");

    customersList
      .classList
      .add("hidden");

    return;

  }

  customersEmpty
    .classList
    .add("hidden");

  customersList
    .classList
    .remove("hidden");

  for(
    const customer
    of customers
  ){

    const row =
      document.createElement(
        "tr"
      );

    const staffName =
      customer.primary_staff_id ===
      "kitamura"
        ? "北村"
        :
      customer.primary_staff_id ===
      "yamazaki"
        ? "山崎"
        : "—";

    const lastVisit =
      customer.last_visit_date
        ? customer.last_visit_date
        : "—";

    const birthMonth =
      customer.birth_month
        ? `${customer.birth_month}月`
        : "—";

    row.innerHTML = `
  <td>
    <a
      href="customer-detail.html?id=${encodeURIComponent(customer.id)}"
    >
      ${customer.name ?? "—"}
    </a>
  </td>
  <td>${customer.phone ?? "—"}</td>
  <td>${staffName}</td>
  <td>${lastVisit}</td>
  <td>${customer.visit_count ?? 0}</td>
  <td>${birthMonth}</td>
`;

    customersTableBody
      .appendChild(row);

  }

}

/* =========================
   顧客検索
========================= */

const customerSearchInput =
  document.getElementById(
    "customerSearchInput"
  );

let allCustomers = [];

function filterCustomers(){

  const staffFilter =
    document.getElementById(
      "customerStaffFilter"
    );

  const birthMonthFilter =
    document.getElementById(
      "customerBirthMonthFilter"
    );

  const lastVisitFilter =
    document.getElementById(
      "customerLastVisitFilter"
    );

  const visitStatusFilter =
    document.getElementById(
      "customerVisitStatusFilter"
    );

  const keyword =
    customerSearchInput
      ? customerSearchInput.value
          .trim()
          .toLowerCase()
      : "";

  const selectedStaff =
    staffFilter?.value || "";

  const selectedBirthMonth =
    birthMonthFilter?.value || "";

  const selectedLastVisit =
    lastVisitFilter?.value || "";

  const selectedVisitStatus =
    visitStatusFilter?.value || "";

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const filtered =
    allCustomers.filter(
      customer => {

        /* =========================
           名前・電話番号
        ========================= */

        const name =
          String(
            customer.name ?? ""
          )
          .toLowerCase();

        const phone =
          String(
            customer.phone ?? ""
          );

        const matchesKeyword =
          keyword === "" ||
          name.includes(keyword) ||
          phone.includes(keyword);

        if(!matchesKeyword){
          return false;
        }

        /* =========================
           主担当
        ========================= */

        if(selectedStaff){

          if(
            selectedStaff === "none"
          ){

            if(
              customer.primary_staff_id
            ){
              return false;
            }

          }else if(
            customer.primary_staff_id !==
            selectedStaff
          ){

            return false;

          }

        }

        /* =========================
           誕生月
        ========================= */

        if(selectedBirthMonth){

          if(
            selectedBirthMonth ===
            "none"
          ){

            if(customer.birth_month){
              return false;
            }

          }else if(
            Number(
              customer.birth_month
            ) !==
            Number(
              selectedBirthMonth
            )
          ){

            return false;

          }

        }

        /* =========================
           最終来店日
        ========================= */

        let daysSinceLastVisit =
          null;

        if(customer.last_visit_date){

          const lastVisitDate =
            new Date(
              `${customer.last_visit_date}T00:00:00`
            );

          daysSinceLastVisit =
            Math.floor(
              (
                today -
                lastVisitDate
              ) /
              (
                1000 *
                60 *
                60 *
                24
              )
            );

        }

        if(selectedLastVisit){

          const requiredDays =
            Number(
              selectedLastVisit
            );

          if(
            daysSinceLastVisit === null ||
            daysSinceLastVisit <
            requiredDays
          ){

            return false;

          }

        }

        /* =========================
           来店状況
        ========================= */

        if(
          selectedVisitStatus ===
          "inactive90"
        ){

          if(
            daysSinceLastVisit === null ||
            daysSinceLastVisit < 90
          ){

            return false;

          }

        }

        if(
          selectedVisitStatus ===
          "never"
        ){

          if(
            Number(
              customer.visit_count || 0
            ) !== 0
          ){

            return false;

          }

        }

        return true;

      }
    );

  renderCustomers(
    filtered
  );

}

if(customerSearchInput){

  customerSearchInput
    .addEventListener(
      "input",
      filterCustomers
    );

}

[
  "customerStaffFilter",
  "customerBirthMonthFilter",
  "customerLastVisitFilter",
  "customerVisitStatusFilter"
].forEach(
  id => {

    const filter =
      document.getElementById(id);

    filter
      ?.addEventListener(
        "change",
        filterCustomers
      );

  }
);

initializeCustomers();
