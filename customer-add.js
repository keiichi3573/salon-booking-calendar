const sb =
  supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

const customerAddApp =
  document.getElementById(
    "customerAddApp"
  );

const customerAddAccessDenied =
  document.getElementById(
    "customerAddAccessDenied"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );

async function initializeCustomerAdd(){

  try{

    const {
      data: {
        session
      }
    } =
      await sb.auth.getSession();

    if(!session){

      window.location.href =
        "index.html";

      return;
    }

    customerAddApp?.classList.remove(
      "hidden"
    );

    logoutBtn?.classList.remove(
      "hidden"
    );

  }catch(error){

    console.error(
      error
    );

    customerAddAccessDenied
      ?.classList.remove(
        "hidden"
      );

  }

}

logoutBtn?.addEventListener(
  "click",
  async () => {

    await sb.auth.signOut();

    window.location.href =
      "index.html";

  }
);

initializeCustomerAdd();
