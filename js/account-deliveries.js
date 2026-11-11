
(() => {
  "use strict";

  const db = window.zeroSupabase;
  const $ = id => document.getElementById(id);

  if (!db) return;

  let userId = null;
  let refreshTimer = null;
  let loading = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

  const formatDate = value => value
    ? new Date(value).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "Fecha no disponible";

  function addStyles() {
    if ($("zeroShopNotificationStyles")) return;

    const style = document.createElement("style");
    style.id = "zeroShopNotificationStyles";

    style.textContent = `
      .zsn-button {
        position:relative;
        border:1px solid #ffffff25;
        background:#ffffff0a;
        color:white;
        border-radius:12px;
        padding:10px 13px;
        font:800 12px Inter,sans-serif;
        cursor:pointer;
      }

      .zsn-count {
        display:inline-grid;
        place-items:center;
        min-width:19px;
        height:19px;
        margin-left:5px;
        padding:0 5px;
        border-radius:99px;
        background:#ff315d;
        color:white;
        font-size:10px;
        font-weight:900;
      }

      .zsn-count[hidden] {
        display:none!important;
      }

      .zsn-panel {
        border:1px solid #ffffff18;
        border-radius:20px;
        background:linear-gradient(145deg,#171526,#10101b);
        padding:18px;
        margin:14px 0;
        box-shadow:0 18px 55px #0004;
      }

      .zsn-panel[hidden] {
        display:none!important;
      }

      .zsn-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
        margin-bottom:14px;
      }

      .zsn-head h3 {
        margin:0;
        font-size:17px;
        color:white;
      }

      .zsn-actions {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .zsn-small {
        border:1px solid #ffffff20;
        background:#ffffff08;
        color:#ff9bb4;
        border-radius:9px;
        padding:8px 10px;
        font:750 11px Inter,sans-serif;
        cursor:pointer;
      }

      .zsn-list {
        display:grid;
        gap:10px;
      }

      .zsn-item {
        display:grid;
        grid-template-columns:38px 1fr;
        gap:10px;
        padding:13px;
        border:1px solid #ffffff15;
        border-radius:13px;
        background:#09081280;
      }

      .zsn-item.unread {
        border-color:#ff719655;
        background:#ff315d0b;
      }

      .zsn-icon {
        width:36px;
        height:36px;
        border-radius:11px;
        display:grid;
        place-items:center;
        background:#ff315d1c;
        color:#ff91ad;
        font-size:17px;
      }

      .zsn-copy strong {
        display:block;
        color:white;
        font-size:12px;
      }

      .zsn-copy p {
        margin:5px 0;
        color:#bcb8ce;
        font-size:11px;
        line-height:1.55;
      }

      .zsn-copy small {
        color:#827d96;
        font-size:10px;
      }

      .zsn-open {
        display:inline-block;
        margin-top:8px;
        border:0;
        background:none;
        padding:0;
        color:#ff91ad;
        font:800 11px Inter,sans-serif;
        cursor:pointer;
      }

      .zsn-empty {
        padding:22px;
        text-align:center;
        color:#a9a5bb;
        font-size:12px;
        border:1px dashed #ffffff25;
        border-radius:13px;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureUI() {
    addStyles();

    const head = document.querySelector(
      "#accountView .account-dashboard-head"
    );

    if (!head) return;

    const actions = head.querySelector("div:last-child");

    if (actions && !$("zeroShopNotificationButton")) {
      const button = document.createElement("button");

      button.type = "button";
      button.id = "zeroShopNotificationButton";
      button.className = "zsn-button";

      button.innerHTML = `
        ♧ Notificaciones
        <span class="zsn-count" id="zeroShopUnreadCount" hidden>0</span>
      `;

      actions.insertBefore(button, actions.firstChild);

      button.addEventListener("click", togglePanel);
    }

    if (!$("zeroShopNotificationsPanel")) {
      const panel = document.createElement("section");

      panel.id = "zeroShopNotificationsPanel";
      panel.className = "zsn-panel";
      panel.hidden = true;

      panel.innerHTML = `
        <div class="zsn-head">
          <h3>Centro de notificaciones</h3>

          <div class="zsn-actions">
            <button type="button"
              class="zsn-small"
              id="zeroShopMarkAllRead">
              Marcar todas como leídas
            </button>

            <button type="button"
              class="zsn-small"
              id="zeroShopRefreshNotifications">
              ↻ Actualizar
            </button>
          </div>
        </div>

        <div id="zeroShopNotificationsList" class="zsn-list">
          <div class="zsn-empty">
            Cargando notificaciones…
          </div>
        </div>
      `;

      head.insertAdjacentElement("afterend", panel);

      $("zeroShopMarkAllRead").addEventListener(
        "click",
        () => markRead(null)
      );

      $("zeroShopRefreshNotifications").addEventListener(
        "click",
        loadNotifications
      );

      $("zeroShopNotificationsList").addEventListener(
        "click",
        onNotificationClick
      );
    }
  }

  function togglePanel() {
    const panel = $("zeroShopNotificationsPanel");

    if (!panel) return;

    panel.hidden = !panel.hidden;

    if (!panel.hidden) loadNotifications();
  }

  function getIcon(type) {
    return {
      order_received: "🛍️",
      payment_confirmed: "✓",
      order_delivered: "📦"
    }[type] || "•";
  }

  async function loadNotifications() {
    if (!userId || loading) return;

    ensureUI();

    const list = $("zeroShopNotificationsList");

    if (!list) return;

    loading = true;

    try {
      const { data, error } = await db
        .from("zero_shop_notifications")
        .select(`
          id,
          order_id,
          notification_type,
          title,
          body,
          created_at,
          read_at
        `)
        .eq("customer_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;

      const rows = data || [];

      const unread = rows.filter(row => !row.read_at).length;

      const count = $("zeroShopUnreadCount");

      if (count) {
        count.textContent = unread > 99 ? "99+" : unread;
        count.hidden = unread === 0;
      }

      list.innerHTML = rows.length
        ? rows.map(row => `
          <article class="zsn-item ${row.read_at ? "" : "unread"}">
            <div class="zsn-icon">
              ${getIcon(row.notification_type)}
            </div>

            <div class="zsn-copy">
              <strong>${esc(row.title)}</strong>
              <p>${esc(row.body)}</p>
              <small>${formatDate(row.created_at)}</small>
              <br>

              <button
                type="button"
                class="zsn-open"
                data-zsn-open="${esc(row.id)}"
                data-zsn-order="${esc(row.order_id || "")}"
                data-zsn-type="${esc(row.notification_type)}">

                ${row.notification_type === "order_delivered"
                  ? "Ver mi producto →"
                  : "Ver mi pedido →"}
              </button>
            </div>
          </article>
        `).join("")
        : `
          <div class="zsn-empty">
            Todavía no tienes notificaciones.
            Aquí aparecerán las actualizaciones de tus compras.
          </div>
        `;

    } catch (error) {
      list.innerHTML = `
        <div class="zsn-empty">
          No se pudieron cargar las notificaciones:
          ${esc(error.message)}
        </div>
      `;
    } finally {
      loading = false;
    }
  }

  async function markRead(id) {
    const { error } = await db.rpc(
      "zero_shop_mark_notification_read",
      {
        p_notification_id: id || null
      }
    );

    if (error) {
      alert("No se pudo actualizar: " + error.message);
      return false;
    }

    await loadNotifications();
    return true;
  }

  async function onNotificationClick(event) {
    const button = event.target.closest("[data-zsn-open]");

    if (!button) return;

    const notificationId = button.dataset.zsnOpen;
    const orderId = button.dataset.zsnOrder;
    const type = button.dataset.zsnType;

    const success = await markRead(notificationId);

    if (!success) return;

    const panel = $("zeroShopNotificationsPanel");
    if (panel) panel.hidden = true;

    if (orderId && typeof window.zeroShopOpenDeliveryOrder === "function") {
      window.zeroShopOpenDeliveryOrder(orderId);
      return;
    }

    if (type === "order_delivered") {
      $("myDigitalDeliveries")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } else {
      $("ordersList")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  async function start(session) {
    if (!session?.user) {
      userId = null;

      if (refreshTimer) clearInterval(refreshTimer);

      refreshTimer = null;
      return;
    }

    userId = session.user.id;

    ensureUI();

    await loadNotifications();

    if (refreshTimer) clearInterval(refreshTimer);

    refreshTimer = setInterval(loadNotifications, 30000);
  }

  async function init() {
    const { data, error } = await db.auth.getSession();

    if (!error) await start(data.session);

    db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => start(session), 0);
      }

      if (event === "SIGNED_OUT") {
        userId = null;

        if (refreshTimer) clearInterval(refreshTimer);

        refreshTimer = null;

        $("zeroShopNotificationButton")?.remove();
        $("zeroShopNotificationsPanel")?.remove();
      }
    });
  }

  init();
})();
