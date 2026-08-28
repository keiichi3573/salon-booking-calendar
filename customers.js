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

initializeCustomers();
