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
    detailBtn.addEventListener(
      "click",
      () => {

        window.alert(
          `${group.display_name}さんの詳細確認機能は次に追加します。`
        );

      }
    );

    actions.appendChild(
      detailBtn
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
