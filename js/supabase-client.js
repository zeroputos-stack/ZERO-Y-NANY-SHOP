(() => {
  window.zeroAuthInviteFlow = /(?:type=invite|type=recovery)/i.test((location.hash || "") + (location.search || ""));
  const cfg = window.ZERO_CONFIG || {};
  const ready = !!(cfg.supabaseUrl && cfg.supabasePublishableKey &&
    !cfg.supabaseUrl.includes("PEGA_AQUI") && !cfg.supabasePublishableKey.includes("PEGA_AQUI"));
  window.zeroSupabaseReady = ready;
  window.zeroSupabase = ready
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
})();
