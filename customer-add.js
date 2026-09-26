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

const saveCustomerBtn =
  document.getElementById(
    "saveCustomerBtn"
  );

const customerTypeSelect =
  document.getElementById(
    "customerTypeSelect"
  );

const customerNameInput =
  document.getElementById(
    "customerNameInput"
  );

const customerNameKanaInput =
  document.getElementById(
    "customerNameKanaInput"
  );

const customerPhoneInput =
  document.getElementById(
    "customerPhoneInput"
  );

const customerBirthMonthSelect =
  document.getElementById(
    "customerBirthMonthSelect"
  );

const customerChartNumberInput =
  document.getElementById(
    "customerChartNumberInput"
  );

const customerStaffSelect =
  document.getElementById(
    "customerStaffSelect"
  );

const customerNoteInput =
  document.getElementById(
    "customerNoteInput"
  );

const customerAddMessage =
  document.getElementById(
    "customerAddMessage"
  );

saveCustomerBtn?.addEventListener(
  "click",
  async () => {

    const customerType =
      customerTypeSelect?.value || "repeat";

    const name =
      customerNameInput?.value.trim() || "";

    const nameKana =
      customerNameKanaInput?.value.trim() || "";

    const phone =
      customerPhoneInput?.value.trim() || "";

    const birthMonthValue =
      customerBirthMonthSelect?.value || "";

    const chartNumber =
      customerChartNumberInput?.value.trim() || "";

    const primaryStaffId =
      customerStaffSelect?.value || "";

    const note =
      customerNoteInput?.value.trim() || "";

    if(!name){

      customerAddMessage.textContent =
        "お名前を入力してください。";

      return;
    }

    if(
      phone &&
      !/^\d{10,11}$/.test(phone)
    ){

      customerAddMessage.textContent =
        "電話番号は10桁または11桁の数字で入力してください。";

      return;
    }

    customerAddMessage.textContent =
      "登録中です...";

    saveCustomerBtn.disabled =
      true;

    try{

      const birthMonth =
        birthMonthValue
          ? Number(birthMonthValue)
          : null;

      const {
        data,
        error
      } =
        await sb
          .from("customers")
          .insert({
            name: name,
            name_kana: nameKana || null,
            phone: phone || null,
            birth_month: birthMonth,
            chart_number: chartNumber || null,
            primary_staff_id:
              primaryStaffId || null,
            note: note || null,
            visit_count:
              customerType === "new"
                ? 0
                : 0
          })
          .select("id")
          .single();

      if(error){
        throw error;
      }

      window.location.href =
        `customer-detail.html?id=${encodeURIComponent(data.id)}`;

    }catch(error){

      console.error(error);

      if(
        String(error?.message || "")
          .includes("customers_chart_number_unique")
      ){

        customerAddMessage.textContent =
          "このカルテ番号はすでに登録されています。";

      }else{

        customerAddMessage.textContent =
          "顧客を登録できませんでした。";

      }

      saveCustomerBtn.disabled =
        false;

    }

  }
);

initializeCustomerAdd();
