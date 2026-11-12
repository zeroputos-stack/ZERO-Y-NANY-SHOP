
(() => {
  "use strict";

  const db = window.zeroSupabase;
  const $ = id => document.getElementById(id);

  if (!db) {
    console.error("ZERO-SHOP: Supabase no está conectado.");
    return;
  }

  let currentUserId = null;
  let deliveries = new Map();
  let loading = false;

  // SEGURIDAD: ESCAPAR TEXTO HTML
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  // FORMATO DE FECHA
  function formatDate(value) {
    if (!value) return "Fecha no disponible";

    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  // ESTILOS
  function addStyles() {
    if ($("zeroDeliveriesStyles")) return;

    const style = document.createElement("style");
    style.id = "zeroDeliveriesStyles";

    style.textContent = `
      #myDigitalDeliveries {
        margin-top: 30px;
        padding: 22px;
        border: 1px solid #ffffff20;
        border-radius: 20px;
        background: linear-gradient(145deg,#191326,#100d19);
        scroll-margin-top: 25px;
      }

      #myDigitalDeliveries h3 {
        margin: 0 0 8px;
        color: #fff;
        font-size: 21px;
      }

      .zsd-subtitle {
        color: #b9a9c4;
        font-size: 13px;
        line-height: 1.6;
        margin-bottom: 18px;
      }

      .zsd-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .zsd-refresh {
        border: 1px solid #ffffff30;
        border-radius: 10px;
        background: #ffffff09;
        color: #ff91bd;
        padding: 10px 13px;
        font-weight: 700;
        cursor: pointer;
      }

      .zsd-list {
        display: grid;
        gap: 14px;
      }

      .zsd-card {
        padding: 17px;
        border: 1px solid #ffffff20;
        border-radius: 15px;
        background: #09081280;
        min-width: 0;
      }

      .zsd-card h4 {
        margin: 0 0 8px;
        color: #ff91bd;
        font-size: 17px;
        overflow-wrap: anywhere;
      }

      .zsd-meta {
        color: #b9a9c4;
        font-size: 12px;
        line-height: 1.8;
        margin-bottom: 13px;
      }

      .zsd-content-label {
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        margin-bottom: 9px;
      }

      .zsd-content {
        display: block;
        width: 100%;
        min-height: 75px;
        padding: 14px;
        border: 1px solid #ffffff20;
        border-radius: 11px;
        background: #05040b;
        color: #eee2f5;
        font-size: 13px;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        user-select: text;
      }

      .zsd-copy {
        width: 100%;
        margin-top: 12px;
        padding: 13px;
        border: 0;
        border-radius: 10px;
        background: linear-gradient(100deg,#fa316c,#b02cba);
        color: white;
        font-weight: 800;
        cursor: pointer;
      }

      .zsd-copy:disabled {
        opacity: .6;
      }

      .zsd-empty {
        padding: 22px;
        border: 1px dashed #ffffff30;
        border-radius: 12px;
        color: #b9a9c4;
        text-align: center;
        font-size: 13px;
        line-height: 1.7;
      }

      .zsd-status {
        color: #9ce5bf;
        font-size: 12px;
        margin-top: 9px;
      }

      @media(max-width:600px) {
        #myDigitalDeliveries {
          padding: 16px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // CREAR PANEL
  function ensurePanel() {
    addStyles();

    const account = $("accountView");

    if (!account) return false;

    if (!$("myDigitalDeliveries")) {
      const panel = document.createElement("section");

      panel.id = "myDigitalDeliveries";

      panel.innerHTML = `
        <div class="zsd-toolbar">
          <div>
            <h3>📦 Mis productos digitales</h3>
            <div class="zsd-subtitle">
              Aquí encontrarás los productos y mensajes
              que ZERO-SHOP te ha entregado.
            </div>
          </div>

          <button type="button"
            class="zsd-refresh"
            id="zsdRefresh">
            ↻ Actualizar
          </button>
        </div>

        <div id="zsdList" class="zsd-list">
          <div class="zsd-empty">
            Cargando tus productos...
          </div>
        </div>
      `;

      account.appendChild(panel);

      $("zsdRefresh").addEventListener(
        "click",
        loadDeliveries
      );

      $("zsdList").addEventListener(
        "click",
        handleCopy
      );
    }

    return true;
  }

  // MOSTRAR MENSAJE
  function showEmpty(text) {
    const list = $("zsdList");

    if (!list) return;

    list.innerHTML = `
      <div class="zsd-empty">${esc(text)}</div>
    `;
  }

  // CARGAR ENTREGAS DEL CLIENTE
  async function loadDeliveries() {
    if (!currentUserId || loading) return;

    if (!ensurePanel()) return;

    loading = true;

    showEmpty("Consultando tus productos entregados...");

    try {

      // 1. BUSCAR PEDIDOS DEL CLIENTE
      const { data: orders, error: ordersError } = await db
        .from("orders")
        .select(`
          id,
          order_number,
          created_at,
          delivery_status
        `)
        .eq("customer_user_id", currentUserId)
        .order("created_at", {
          ascending: false
        });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        showEmpty("Todavía no tienes pedidos registrados.");
        return;
      }

      const orderIds = orders.map(order => order.id);

      const orderMap = new Map(
        orders.map(order => [order.id, order])
      );

      // 2. BUSCAR ENTREGAS RELACIONADAS CON ESOS PEDIDOS
      const { data: deliveryRows, error: deliveryError } =
        await db
          .from("order_deliveries")
          .select(`
            id,
            order_id,
            order_item_id,
            delivery_content,
            delivered_at
          `)
          .in("order_id", orderIds)
          .order("delivered_at", {
            ascending: false
          });

      if (deliveryError) throw deliveryError;

      if (!deliveryRows || deliveryRows.length === 0) {
        showEmpty(
          "Todavía no tienes productos entregados. " +
          "Cuando el administrador registre una entrega, " +
          "aparecerá aquí."
        );
        return;
      }

      // 3. BUSCAR LOS PRODUCTOS DE LOS PEDIDOS
      const { data: items, error: itemsError } = await db
        .from("order_items")
        .select(`
          id,
          order_id,
          product_name,
          product_variant,
          quantity
        `)
        .in("order_id", orderIds);

      if (itemsError) throw itemsError;

      const itemMap = new Map(
        (items || []).map(item => [item.id, item])
      );

      // 4. PREPARAR LAS ENTREGAS
      deliveries.clear();

      const prepared = deliveryRows.map(delivery => {

        const order = orderMap.get(delivery.order_id);

        let item = delivery.order_item_id
          ? itemMap.get(delivery.order_item_id)
          : null;

        // Si la entrega no tiene order_item_id,
        // intentar encontrar el producto del pedido.
        if (!item) {
          const matchingItems = (items || []).filter(
            product => product.order_id === delivery.order_id
          );

          if (matchingItems.length === 1) {
            item = matchingItems[0];
          }
        }

        const entry = {
          ...delivery,
          order_number: order?.order_number || "Sin número",
          product_name: item?.product_name || "Producto digital",
          product_variant: item?.product_variant || "",
          quantity: item?.quantity || 1
        };

        deliveries.set(delivery.id, entry);

        return entry;
      });

      // 5. DIBUJAR PRODUCTOS
      const list = $("zsdList");

      list.innerHTML = prepared.map(item => `
        <article class="zsd-card">

          <h4>
            📦 ${esc(item.product_name)}
          </h4>

          <div class="zsd-meta">
            <div>
              Pedido: ${esc(item.order_number)}
            </div>

            ${item.product_variant
              ? `<div>Variante: ${esc(item.product_variant)}</div>`
              : ""}

            <div>
              Cantidad: ${esc(item.quantity)}
            </div>

            <div>
              Entregado: ${esc(formatDate(item.delivered_at))}
            </div>
          </div>

          <div class="zsd-content-label">
            Tu producto o mensaje:
          </div>

          <div class="zsd-content">${esc(
            item.delivery_content || "No hay contenido registrado."
          )}</div>

          <button
            type="button"
            class="zsd-copy"
            data-zsd-copy="${esc(item.id)}"
            ${item.delivery_content ? "" : "disabled"}>

            📋 Copiar contenido
          </button>

          <div
            class="zsd-status"
            id="zsdStatus-${esc(item.id)}"
            aria-live="polite">
          </div>

        </article>
      `).join("");

    } catch (error) {

      console.error(
        "ZERO-SHOP: Error cargando entregas:",
        error
      );

      showEmpty(
        "No fue posible cargar tus productos: " +
        (error.message || "Error desconocido") +
        ". Revisa los permisos RLS de Supabase."
      );

    } finally {
      loading = false;
    }
  }

  // COPIAR CONTENIDO
  async function copyText(text) {

    if (navigator.clipboard &&
        window.isSecureContext) {

      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const copied = document.execCommand("copy");

    textarea.remove();

    if (!copied) {
      throw new Error("No se pudo copiar el contenido.");
    }
  }

  // EVENTO DEL BOTÓN COPIAR
  async function handleCopy(event) {

    const button = event.target.closest("[data-zsd-copy]");

    if (!button) return;

    const id = button.dataset.zsdCopy;
    const delivery = deliveries.get(id);

    if (!delivery || !delivery.delivery_content) return;

    const status = $("zsdStatus-" + id);

    button.disabled = true;

    try {

      await copyText(delivery.delivery_content);

      if (status) {
        status.textContent = "✓ Contenido copiado correctamente.";
      }

    } catch (error) {

      if (status) {
        status.textContent = error.message;
      }

      console.error(error);

    } finally {
      button.disabled = false;
    }
  }

  // INICIAR SESIÓN Y CARGAR PRODUCTOS
  async function start(session) {

    if (!session?.user) {

      currentUserId = null;
      deliveries.clear();

      return;
    }

    currentUserId = session.user.id;

    ensurePanel();

    await loadDeliveries();
  }

  // INICIALIZAR
  async function init() {

    try {

      const { data, error } = await db.auth.getSession();

      if (error) throw error;

      if (data.session) {
        await start(data.session);
      }

      db.auth.onAuthStateChange((event, session) => {

        if (event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED") {

          setTimeout(() => {
            start(session);
          }, 0);
        }

        if (event === "SIGNED_OUT") {

          currentUserId = null;
          deliveries.clear();

          const list = $("zsdList");

          if (list) {
            showEmpty("Inicia sesión para consultar tus productos.");
          }
        }
      });

    } catch (error) {

      console.error(
        "ZERO-SHOP: Error inicializando entregas:",
        error
      );

    }
  }

  init();

})();
