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

    const customers =
  await loadCustomers();

renderCustomers(customers);

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
      <td>${customer.name ?? "—"}</td>
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

initializeCustomers();
