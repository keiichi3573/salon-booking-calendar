const sb =
  supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

const settingsLogoutBtn =
  document.getElementById(
    "settingsLogoutBtn"
  );

if(settingsLogoutBtn){
  settingsLogoutBtn.addEventListener(
    "click",
    async () => {
      await sb.auth.signOut();
      window.location.href = "index.html";
    }
  );
}
