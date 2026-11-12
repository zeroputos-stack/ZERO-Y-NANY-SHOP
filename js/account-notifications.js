
(() => {
  "use strict";

  const db = window.zeroSupabase;
  const $ = id => document.getElementById(id);

  if (!db) {
    console.error("ZERO-SHOP: Supabase no está conectado.");
    return;
  }

  let userId = null;
  let refreshTimer = null;
  let loading = false;

  // ==========================================
  // FUNCIONES GENERALES
  // ==========================================

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

  function getIcon(type) {
    return {
      order_received: "🛍️",
      payment_confirmed: "💳",
      order_delivered: "📦"
    }[type] || "🔔";
  }

  // ==========================================
  // ESTILOS
  // ==========================================

  function addStyles() {
    if ($("zeroShopNotificationStyles")) return;

    const style = document.createElement("style");
    style.id = "zeroShopNotificationStyles";

    style.textContent = `
      .zsn-button {
        position: relative;
        border: 1px solid #ffffff25;
        background: #ffffff0a;
        color: white;
        border-radius: 12px;
        padding: 10px 13px;
        font: 800 12px Inter, sans-serif;
        cursor: pointer;
      }

      .zsn-button:hover {
        background: #ff315d22;
        border-color: #ff7196;
      }

      .zsn-count {
        display: inline-grid;
        place-items: center;
        min-width: 19px;
        height: 19px;
        margin-left: 5px;
        padding: 0 5px;
        border-radius: 99px;
        background: #ff315d;
        color: white;
        font-size: 10px;
        font-weight: 900;
      }

      .zsn-count[hidden] {
        display: none !important;
      }

      .zsn-panel {
        width: 100%;
        margin: 18px 0;
        border: 1px solid #ffffff18;
        border-radius: 20px;
        background: linear-gradient(145deg,#171526,#10101b);
        padding: 18px;
        box-shadow: 0 18px 55px #0004;
      }

      .zsn-panel[hidden] {
        display: none !important;
      }

      .zsn-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }

      .zsn-head h3 {
        margin: 0;
        font-size: 17px;
        color: white;
      }

      .zsn-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .zsn-small {
        border: 1px solid #ffffff20;
        background: #ffffff08;
        color: #ff9bb4;
        border-radius: 9px;
        padding: 8px 10px;
        font: 750 11px Inter, sans-serif;
        cursor: pointer;
      }

      .zsn-small:disabled {
        opacity: .5;
        cursor: wait;
      }

      .zsn-list {
        display: grid;
        gap: 10px;
      }

      .zsn-item {
        display: grid;
        grid-template-columns: 38px 1fr;
        gap: 10px;
        padding: 13px;
        border: 1px solid #ffffff15;
        border-radius: 13px;
        background: #09081280;
      }

      .zsn-item.unread {
        border-color: #ff719655;
        background: #ff315d0b;
      }

      .zsn-icon {
        width: 36px;
        height: 36px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        background: #ff315d1c;
        color: #ff91ad;
        font-size: 17px;
      }

      .zsn-copy strong {
        display: block;
        color: white;
        font-size: 13px;
      }

      .zsn-copy p {
        margin: 5px 0;
        color: #bcb8ce;
        font-size: 12px;
        line-height: 1.55;
      }

      .zsn-copy small {
        color: #827d96;
        font-size: 10px;
      }

      .zsn-open {
        display: inline-block;
        margin-top: 8px;
        border: 0;
        background: none;
        padding: 0;
        color: #ff91ad;
        font: 800 11px Inter, sans-serif;
        cursor: pointer;
      }

      .zsn-open:hover {
        text-decoration: underline;
      }

      .zsn-empty {
        padding: 22px;
        text-align: center;
        color: #a9a5bb;
        font-size: 12px;
        line-height: 1.6;
        border: 1px dashed #ffffff25;
        border-radius: 13px;
      }

      @media(max-width:600px) {
        .zsn-panel {
          padding: 13px;
        }

        .zsn-head {
          align-items: flex-start;
        }

        .zsn-actions {
          width: 100%;
        }

        .zsn-small {
          flex: 1;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ==========================================
  // CREAR BOTÓN Y PANEL
  // ==========================================

  function ensureUI() {
    addStyles();

    // Identificador correcto de account.html
    const head = document.querySelector("#dashboard .dash-head");

    if (!head) {
      console.warn("ZERO-SHOP: No se encontró el encabezado del cliente.");
      return;
    }

    const logout = $("logoutBtn");

    // BOTÓN DE NOTIFICACIONES
    if (!$("zeroShopNotificationButton")) {
      const button = document.createElement("button");

      button.type = "button";
      button.id = "zeroShopNotificationButton";
      button.className = "zsn-button";

      button.innerHTML = `
        🔔 Notificaciones
        <span class="zsn-count" id="zeroShopUnreadCount" hidden>0</span>
      `;

      if (logout) {
        logout.insertAdjacentElement("beforebegin", button);
      } else {
        head.appendChild(button);
      }

      button.addEventListener("click", togglePanel);
    }

    // PANEL DE NOTIFICACIONES
    if (!$("zeroShopNotificationsPanel")) {
      const panel = document.createElement("section");

      panel.id = "zeroShopNotificationsPanel";
      panel.className = "zsn-panel";
      panel.hidden = true;

      panel.innerHTML = `
        <div class="zsn-head">

          <h3>🔔 Centro de notificaciones</h3>

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
            Cargando notificaciones...
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

  // ==========================================
  // ABRIR Y CERRAR PANEL
  // ==========================================

  function togglePanel() {
    const panel = $("zeroShopNotificationsPanel");

    if (!panel) return;

    panel.hidden = !panel.hidden;

    if (!panel.hidden) {
      loadNotifications();
    }
  }

  // ==========================================
  // CONSULTAR NOTIFICACIONES EN SUPABASE
  // ==========================================

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

      // CONTAR NO LEÍDAS
      const unread = rows.filter(row => !row.read_at).length;

      const count = $("zeroShopUnreadCount");

      if (count) {
        count.textContent = unread > 99 ? "99+" : String(unread);
        count.hidden = unread === 0;
      }

      // MOSTRAR NOTIFICACIONES
      list.innerHTML = rows.length
        ? rows.map(row => `
          <article class="zsn-item ${row.read_at ? "" : "unread"}">

            <div class="zsn-icon">
              ${getIcon(row.notification_type)}
            </div>

            <div class="zsn-copy">

              <strong>${esc(row.title)}</strong>

              <p>${esc(row.body)}</p>

              <small>
                ${formatDate(row.created_at)}
              </small>

              <br>

              <button
                type="button"
                class="zsn-open"
                data-zsn-open="${esc(row.id)}"
                data-zsn-order="${esc(row.order_id)}"
                data-zsn-type="${esc(row.notification_type)}">

                ${
                  row.notification_type === "order_delivered"
                    ? "Ver mis productos →"
                    : "Ver mi pedido →"
                }

              </button>

            </div>

          </article>
        `).join("")
        : `
          <div class="zsn-empty">
            <div style="font-size:30px;margin-bottom:8px">🔔</div>
            <strong>Todavía no tienes notificaciones.</strong>
            <br>
            Aquí aparecerán las actualizaciones de tus compras.
          </div>
        `;

    } catch (error) {
      console.error("Error al consultar notificaciones:", error);

      list.innerHTML = `
        <div class="zsn-empty">
          No se pudieron cargar tus notificaciones.
          <br><br>
          ${esc(error.message || "Error desconocido")}
        </div>
      `;

    } finally {
      loading = false;
    }
  }

  // ==========================================
  // MARCAR COMO LEÍDAS
  // ==========================================

  async function markRead(id) {
    if (!userId) return;

    try {
      const { error } = await db.rpc(
        "zero_shop_mark_notification_read",
        {
          p_notification_id: id || null
        }
      );

      if (error) throw error;

      await loadNotifications();

    } catch (error) {
      console.error("Error al marcar notificación:", error);

      alert(
        "No se pudo actualizar la notificación: " +
        error.message
      );
    }
  }

  // ==========================================
  // ACCIONES AL ABRIR UNA NOTIFICACIÓN
  // ==========================================

  async function onNotificationClick(event) {
    const button = event.target.closest("[data-zsn-open]");

    if (!button) return;

    const notificationId = button.dataset.zsnOpen;
    const orderId = button.dataset.zsnOrder;
    const type = button.dataset.zsnType;

    // Marcar como leída
    await markRead(notificationId);

    // CERRAR PANEL
    const panel = $("zeroShopNotificationsPanel");

    if (panel) panel.hidden = true;

    // SI EL PEDIDO YA FUE ENTREGADO
    if (type === "order_delivered") {

      const deliveries = $("myDigitalDeliveries");

      if (deliveries) {
        deliveries.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      } else {
        $("ordersList")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

    } else {

      // PEDIDO RECIBIDO O PAGO CONFIRMADO
      const orders = $("ordersList");

      if (orders) {
        orders.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }

    console.log(
      "Notificación abierta:",
      notificationId,
      "Pedido:",
      orderId
    );
  }

  // ==========================================
  // INICIAR SESIÓN DEL CLIENTE
  // ==========================================

  async function start(session) {

    if (!session?.user) {
      userId = null;

      if (refreshTimer) {
        clearInterval(refreshTimer);
      }

      refreshTimer = null;

      $("zeroShopNotificationButton")?.remove();
      $("zeroShopNotificationsPanel")?.remove();

      return;
    }

    userId = session.user.id;

    ensureUI();

    await loadNotifications();

    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    // ACTUALIZAR AUTOMÁTICAMENTE CADA 45 SEGUNDOS
    refreshTimer = setInterval(() => {
      loadNotifications();
    }, 45000);

    console.log(
      "ZERO-SHOP: Centro de notificaciones iniciado."
    );
  }

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  async function init() {

    try {
      const { data, error } = await db.auth.getSession();

      if (error) throw error;

      if (data.session) {
        await start(data.session);
      }

    } catch (error) {
      console.error(
        "Error al iniciar notificaciones:",
        error
      );
    }

    // DETECTAR CAMBIOS DE SESIÓN
    db.auth.onAuthStateChange((event, session) => {

      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
        session?.user
      ) {
        setTimeout(() => {
          start(session);
        }, 0);
      }

      if (event === "SIGNED_OUT") {

        userId = null;

        if (refreshTimer) {
          clearInterval(refreshTimer);
        }

        refreshTimer = null;

        $("zeroShopNotificationButton")?.remove();
        $("zeroShopNotificationsPanel")?.remove();
      }

    });
  }

  init();

})();
