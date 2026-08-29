const sb =
  supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );


/* =========================
   DOM
========================= */

const settingsLogoutBtn =
  document.getElementById(
    "settingsLogoutBtn"
  );

const pinInput =
  document.getElementById(
    "pinInput"
  );

const pinEnterBtn =
  document.getElementById(
    "pinEnterBtn"
  );

const staffNameInput =
  document.getElementById(
    "staffNameInput"
  );

const staffAddBtn =
  document.getElementById(
    "staffAddBtn"
  );

const staffList =
  document.getElementById(
    "staffList"
  );

const newPinInput =
  document.getElementById(
    "newPinInput"
  );

const pinChangeBtn =
  document.getElementById(
    "pinChangeBtn"
  );


/* =========================
   PIN設定
========================= */

const KEY_LOCAL_PIN =
  "comfort_admin_pin";

const DEFAULT_PIN =
  "4043";

let pinOk = false;

let staffsAll = [];


async function loadPin(){
  return (
    localStorage.getItem(
      KEY_LOCAL_PIN
    ) ||
    DEFAULT_PIN
  );
}


async function savePin(pin){
  localStorage.setItem(
    KEY_LOCAL_PIN,
    pin
  );
}


/* =========================
   スタッフDB
========================= */

async function fetchStaffsAll(){

  const tryOrder =
    async (col) => {

      return await sb
        .from("staffs")
        .select(
          "id,name,active,sort_order,sort"
        )
        .order(
          col,
          {
            ascending:true
          }
        );
    };


  let res =
    await tryOrder(
      "sort_order"
    );


  if(res.error){
    res =
      await tryOrder(
        "sort"
      );
  }


  if(res.error){
    throw res.error;
  }


  return res.data || [];
}


async function upsertStaff(
  row
){

  const res =
    await sb
      .from("staffs")
      .upsert(
        [row]
      );


  if(res.error){
    throw res.error;
  }
}


async function updateStaff(
  id,
  patch
){

  const res =
    await sb
      .from("staffs")
      .update(
        patch
      )
      .eq(
        "id",
        id
      );


  if(res.error){
    throw res.error;
  }
}


/* =========================
   スタッフ一覧表示
========================= */

function renderStaffList(){

  if(!staffList){
    return;
  }


  staffList.innerHTML = "";


  const getSort =
    (s) =>
      Number(
        s.sort_order ??
        s.sort ??
        0
      );


  staffsAll.sort(
    (a,b) =>
      getSort(a) -
      getSort(b)
  );


  staffsAll.forEach(
    (s, idx) => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "settingsStaffItem";


      const left =
        document.createElement(
          "div"
        );

      left.className =
        "settingsStaffInfo";


      const name =
        document.createElement(
          "div"
        );

      name.className =
        "settingsStaffName";

      name.textContent =
        `${s.name}${
          s.active
            ? ""
            : "（無効）"
        }`;


      const meta =
        document.createElement(
          "div"
        );

      meta.className =
        "settingsStaffMeta";

      meta.textContent =
        s.active
          ? "有効"
          : "無効";


      left.appendChild(
        name
      );

      left.appendChild(
        meta
      );


      const btns =
        document.createElement(
          "div"
        );

      btns.className =
        "settingsStaffActions";


      const up =
        document.createElement(
          "button"
        );

      up.className =
        "btn";

      up.type =
        "button";

      up.textContent =
        "↑";

      up.disabled =
        idx === 0;


      up.onclick =
        async () => {

          try{

            const prev =
              staffsAll[
                idx - 1
              ];

            const cur =
              staffsAll[
                idx
              ];


            const prevSort =
              getSort(
                prev
              );

            const curSort =
              getSort(
                cur
              );


            await updateStaff(
              prev.id,
              {
                sort_order:
                  curSort,

                sort:
                  curSort
              }
            );


            await updateStaff(
              cur.id,
              {
                sort_order:
                  prevSort,

                sort:
                  prevSort
              }
            );


            staffsAll =
              await fetchStaffsAll();


            renderStaffList();

          }catch(e){

            console.error(e);

            alert(
              "並び順変更でエラー: " +
              (
                e?.message ||
                e
              )
            );
          }
        };


      const down =
        document.createElement(
          "button"
        );

      down.className =
        "btn";

      down.type =
        "button";

      down.textContent =
        "↓";

      down.disabled =
        idx ===
        staffsAll.length - 1;


      down.onclick =
        async () => {

          try{

            const next =
              staffsAll[
                idx + 1
              ];

            const cur =
              staffsAll[
                idx
              ];


            const nextSort =
              getSort(
                next
              );

            const curSort =
              getSort(
                cur
              );


            await updateStaff(
              next.id,
              {
                sort_order:
                  curSort,

                sort:
                  curSort
              }
            );


            await updateStaff(
              cur.id,
              {
                sort_order:
                  nextSort,

                sort:
                  nextSort
              }
            );


            staffsAll =
              await fetchStaffsAll();


            renderStaffList();

          }catch(e){

            console.error(e);

            alert(
              "並び順変更でエラー: " +
              (
                e?.message ||
                e
              )
            );
          }
        };


      const toggle =
        document.createElement(
          "button"
        );

      toggle.className =
        "btn";

      toggle.type =
        "button";

      toggle.textContent =
        s.active
          ? "無効"
          : "有効";


      toggle.onclick =
  async () => {

    alert("ボタン反応確認");

    try{

            await updateStaff(
              s.id,
              {
                active:
                  !s.active
              }
            );


            staffsAll =
              await fetchStaffsAll();


            renderStaffList();

          }catch(e){

            console.error(e);

            alert(
              "有効・無効変更でエラー: " +
              (
                e?.message ||
                e
              )
            );
          }
        };


      btns.appendChild(
        up
      );

      btns.appendChild(
        down
      );

      btns.appendChild(
        toggle
      );


      item.appendChild(
        left
      );

      item.appendChild(
        btns
      );


      staffList.appendChild(
        item
      );
    }
  );
}


/* =========================
   PIN確認
========================= */

async function enterPin(){

  const pin =
    (
      await loadPin()
    ).trim();


  const input =
    (
      pinInput?.value ||
      ""
    ).trim();


  if(input !== pin){

    alert(
      "PINが違います"
    );

    return;
  }


  pinOk = true;


  try{

    staffsAll =
      await fetchStaffsAll();

  }catch(e){

    console.error(e);

    alert(
      "staffsの取得でエラー: " +
      (
        e?.message ||
        e
      )
    );

    staffsAll = [];
  }


  renderStaffList();


  if(staffNameInput){
    staffNameInput.disabled =
      false;
  }


  if(staffAddBtn){
    staffAddBtn.disabled =
      false;
  }


  if(newPinInput){
    newPinInput.disabled =
      false;
  }


  if(pinChangeBtn){
    pinChangeBtn.disabled =
      false;
  }


  alert(
    "管理者PINを確認しました"
  );
}


/* =========================
   スタッフ追加
========================= */

async function addStaff(){

  if(!pinOk){
    alert(
      "先に管理者PINを確認してください"
    );
    return;
  }


  const name =
    (
      staffNameInput?.value ||
      ""
    ).trim();


  if(!name){
    return;
  }


  try{

    const getSort =
      (s) =>
        Number(
          s.sort_order ??
          s.sort ??
          0
        );


    const maxSort =
      Math.max(
        0,
        ...staffsAll.map(
          getSort
        )
      );


    const id =
      crypto.randomUUID();


    await upsertStaff({
      id,
      name,
      active:true,
      sort_order:
        maxSort + 1,
      sort:
        maxSort + 1
    });


    if(staffNameInput){
      staffNameInput.value =
        "";
    }


    staffsAll =
      await fetchStaffsAll();


    renderStaffList();

  }catch(e){

    console.error(e);

    alert(
      "スタッフ追加でエラー: " +
      (
        e?.message ||
        e
      )
    );
  }
}


/* =========================
   PIN変更
========================= */

async function changePin(){

  if(!pinOk){

    alert(
      "先に管理者PINを確認してください"
    );

    return;
  }


  const np =
    (
      newPinInput?.value ||
      ""
    ).trim();


  if(np.length < 4){

    alert(
      "PINは4桁以上を推奨します"
    );

    return;
  }


  await savePin(
    np
  );


  alert(
    "PINを変更しました"
  );


  if(newPinInput){
    newPinInput.value =
      "";
  }
}


/* =========================
   ログイン確認
========================= */

async function checkSettingsLogin(){

  const {
    data,
    error
  } =
    await sb.auth.getSession();


  if(error){

    console.error(error);

    window.location.href =
      "index.html";

    return;
  }


  if(!data?.session){

    window.location.href =
      "index.html";

    return;
  }
}


/* =========================
   Events
========================= */

pinEnterBtn?.addEventListener(
  "click",
  enterPin
);


staffAddBtn?.addEventListener(
  "click",
  addStaff
);


pinChangeBtn?.addEventListener(
  "click",
  changePin
);


settingsLogoutBtn?.addEventListener(
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

      alert(
        "ログアウトできませんでした"
      );

      return;
    }


    window.location.href =
      "index.html";
  }
);


/* =========================
   初期状態
========================= */

if(staffNameInput){
  staffNameInput.disabled =
    true;
}

if(staffAddBtn){
  staffAddBtn.disabled =
    true;
}

if(newPinInput){
  newPinInput.disabled =
    true;
}

if(pinChangeBtn){
  pinChangeBtn.disabled =
    true;
}


checkSettingsLogin();
