
(() => {
  "use strict";

  const db = window.zeroSupabase;
  const $ = id => document.getElementById(id);

  if (!db) {
    console.error("ZERO-SHOP: Supabase no está conectado.");
    return;
  }

  let currentUserId = null;
  let loading = false;

  // ==========================================
  // FUNCIONES GENERALES
  // ==========================================

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  const money = value => new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(value || 0));

  const dateTime = value => value
    ? new Date(value).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "Fecha no disponible";

  // ==========================================
  // ESTILOS
  // ==========================================

  function addStyles() {
    if ($("myDigitalDeliveriesStyles")) return;

    const style = document.createElement("style");
    style.id = "myDigitalDeliveriesStyles";

    style.textContent = `
      .my-deliveries-panel {
        margin-top: 25px;
        padding: 20px;
        border: 1px solid #ffffff20;
        border-radius: 20px;
        background: linear-gradient(145deg,#171526,#10101b);
        color: white;
      }

      .my-deliveries-panel h3 {
        margin: 0 0 8px;
        font-size: 20px;
      }

      .my-deliveries-description {
        color: #aaa6bf;
        font-size: 12px;
        line-height: 1.6;
        margin-bottom: 18px;
      }

      .my-delivery-order {
        border: 1px solid #ffffff18;
        background: #11101d;
        border-radius: 15px;
        padding: 15px;
        margin: 13px 0;
      }

      .my-delivery-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
        margin-bottom: 10px;
      }

      .my-delivery-head strong {
        font-size: 13px;
        color: white;
      }

      .my-delivery-pill {
        font-size: 10px;
        font-weight: 800;
        border-radius: 99px;
        padding: 6px 9px;
        background: #ffb02018;
        color: #ffd38a;
        border: 1px solid #ffb02044;
      }

      .my-delivery-pill.done {
        background: #19c37d18;
        color: #8ce8b7;
        border-color: #19c37d44;
      }

      .my-delivery-product {
        border-top: 1px solid #ffffff12;
        padding: 13px 0;
      }

      .my-delivery-product strong {
        display: block;
        font-size: 13px;
        color: white;
      }

      .my-delivery-product small {
        display: block;
        color: #aaa6bf;
        font-size: 11px;
        margin-top: 5px;
      }

      .my-delivery-content {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: #090812;
        border: 1px solid #ff719655;
        border-radius: 11px;
        padding: 13px;
        margin-top: 10px;
        color: #f8eaf0;
        font-size: 13px;
        line-height: 1.7;
      }

      .my-delivery-copy {
        margin-top: 9px;
        border: 1px solid #ffffff22;
        background: #ffffff0a;
        color: #ff9bb4;
        border-radius: 9px;
        padding: 9px 12px;
        font: 800 11px Inter,sans-serif;
        cursor: pointer;
      }

      .my-delivery-copy:hover {
        background: #ff315d20;
      }

      .my-delivery-pending {
        font-size: 11px;
        color: #b7b1c9;
        margin-top: 9px;
        line-height: 1.6;
      }

      .my-delivery-meta {
        color: #aaa6bf;
        font-size: 11px;
        margin: 8px 0 12px;
      }

      .my-delivery-method {
        display: inline-block;
        font-size: 10px;
        color: #ff9bb4;
        border: 1px solid #ff719633;
        border-radius: 20px;
        padding: 5px 8px;
        margin-top: 8px;
      }

      .my-delivery-empty {
        padding: 22px;
        text-align: center;
        color: #aaa6bf;
        font-size: 12px;
        line-height: 1.7;
        border: 1px dashed #ffffff25;
        border-radius: 13px;
      }

      @media(max-width:600px) {
        .my-deliveries-panel {
          padding: 15px;
        }

        .my-delivery-order {
          padding: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ==========================================
  // CREAR PANEL EN ACCOUNT.HTML
  // ==========================================

  function ensurePanel() {
    addStyles();

    const dashboard = $("dashboard");
    const ordersList = $("ordersList");

    if (!dashboard || !ordersList) {
      console.warn(
        "ZERO-SHOP: No se encontró el panel del cliente."
      );
      return null;
    }

    let panel = $("myDigitalDeliveries");

    if (panel) return panel;

    panel = document.createElement("section");

    panel.id = "myDigitalDeliveries";
    panel.className = "my-deliveries-panel";

    panel.innerHTML = `
      <h3>📦 Mis productos digitales</h3>

      <p class="my-deliveries-description">
        Aquí puedes consultar todos los productos que ZERO-SHOP
        te ha entregado, incluyendo códigos, enlaces,
        contraseñas e instrucciones.
      </p>

      <div id="myDigitalDeliveriesList">
        <div class="my-delivery-empty">
          Consultando tus productos...
        </div>
      </div>
    `;

    // Insertar después de la lista de pedidos.
    ordersList.insertAdjacentElement("afterend", panel);

    // ========================================
    // BOTÓN COPIAR DATOS
    // ========================================

    panel.addEventListener("click", async event => {

      const button = event.target.closest(
        "[data-copy-delivery]"
      );

      if (!button) return;

      const text = button.dataset.copyDelivery || "";

      try {
        await navigator.clipboard.writeText(text);

      } catch (_) {

        const area = document.createElement("textarea");

        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";

        document.body.appendChild(area);

        area.select();

        document.execCommand("copy");

        area.remove();
      }

      const original = button.textContent;

      button.textContent = "✓ Copiado";

      setTimeout(() => {
        button.textContent = original;
      }, 1600);

    });

    return panel;
  }

  // ==========================================
  // CONSULTAR PEDIDOS DEL CLIENTE
  // ==========================================

  async function loadMyDeliveries(session) {

    if (!session?.user) return;

    if (loading) return;

    currentUserId = session.user.id;

    const panel = ensurePanel();

    if (!panel) return;

    panel.hidden = false;

    const list = $("myDigitalDeliveriesList");

    if (!list) return;

    loading = true;

    list.innerHTML = `
      <div class="my-delivery-empty">
        Consultando tus pedidos y entregas...
      </div>
    `;

    try {

      // IMPORTANTE:
      // Ya NO filtramos por delivery_method = account.
      // Ahora aparecen las entregas de WhatsApp y Mi cuenta.

      const { data: orders, error: ordersError } = await db
        .from("orders")
        .select(`
          id,
          order_number,
          payment_status,
          delivery_status,
          delivery_method,
          delivered_at,
          total,
          created_at,
          status
        `)
        .eq("customer_user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (ordersError) throw ordersError;

      if (!orders?.length) {

        list.innerHTML = `
          <div class="my-delivery-empty">
            <div style="font-size:30px">🛍️</div>

            Todavía no tienes pedidos vinculados
            a esta cuenta.

            <br>
            Cuando realices una compra,
            aparecerá aquí.
          </div>
        `;

        return;
      }

      const orderIds = orders.map(order => order.id);

      // ======================================
      // CONSULTAR PRODUCTOS Y ENTREGAS
      // ======================================

      const [itemsResult, deliveriesResult] =
        await Promise.all([

          db.from("order_items")
            .select(`
              id,
              order_id,
              product_name,
              product_variant,
              quantity
            `)
            .in("order_id", orderIds)
            .order("created_at", { ascending: true }),

          db.from("order_deliveries")
            .select(`
              order_id,
              order_item_id,
              delivery_content,
              delivered_at
            `)
            .in("order_id", orderIds)

        ]);

      if (itemsResult.error) throw itemsResult.error;

      if (deliveriesResult.error) {
        throw deliveriesResult.error;
      }

      // ======================================
      // ORGANIZAR PRODUCTOS POR PEDIDO
      // ======================================

      const itemsByOrder = new Map();

      (itemsResult.data || []).forEach(item => {

        if (!itemsByOrder.has(item.order_id)) {
          itemsByOrder.set(item.order_id, []);
        }

        itemsByOrder.get(item.order_id).push(item);

      });

      // ======================================
      // ORGANIZAR ENTREGAS POR PRODUCTO
      // ======================================

      const deliveriesByItem = new Map(
        (deliveriesResult.data || []).map(row => [
          row.order_item_id,
          row
        ])
      );

      // ======================================
      // MOSTRAR TODOS LOS PEDIDOS
      // ======================================

      list.innerHTML = orders.map(order => {

        const items = itemsByOrder.get(order.id) || [];

        const delivered =
          order.delivery_status === "delivered";

        const paid =
          order.payment_status === "paid";

        const cancelled =
          order.status === "cancelled";

        const method =
          order.delivery_method === "account"
            ? "Mi cuenta"
            : "WhatsApp";

        // ESTADO DEL PEDIDO

        let pill;

        if (cancelled) {

          pill = `
            <span class="my-delivery-pill">
              Pedido cancelado
            </span>
          `;

        } else if (delivered) {

          pill = `
            <span class="my-delivery-pill done">
              ✓ Entregado
            </span>
          `;

        } else if (paid) {

          pill = `
            <span class="my-delivery-pill">
              Pago confirmado · En preparación
            </span>
          `;

        } else {

          pill = `
            <span class="my-delivery-pill">
              Pago pendiente
            </span>
          `;

        }

        // PRODUCTOS

        const itemsHtml = items.map(item => {

          const delivery = deliveriesByItem.get(item.id);

          const variant = item.product_variant
            ? " · " + item.product_variant
            : "";

          return `
            <div class="my-delivery-product">

              <strong>
                ${escapeHTML(item.product_name)}
                ${escapeHTML(variant)}
              </strong>

              <small>
                Cantidad: ${Number(item.quantity)}
              </small>

              ${
                delivery && delivery.delivery_content
                  ? `

                    <div class="my-delivery-content">${escapeHTML(
                      delivery.delivery_content
                    )}</div>

                    <button
                      type="button"
                      class="my-delivery-copy"
                      data-copy-delivery="${escapeHTML(
                        delivery.delivery_content
                      )}">

                      📋 Copiar datos

                    </button>

                    <small>
                      Entregado:
                      ${dateTime(
                        delivery.delivered_at ||
                        order.delivered_at
                      )}
                    </small>

                  `
                  : `

                    <div class="my-delivery-pending">

                      ${
                        cancelled
                          ? "Este pedido fue cancelado. Contacta a la tienda si necesitas ayuda."
                          : paid
                            ? "Tu pago está confirmado. La tienda está preparando los datos de entrega."
                            : "Tu pedido está pendiente de confirmación del pago."
                      }

                    </div>

                  `
              }

            </div>
          `;

        }).join("");

        // TARJETA DEL PEDIDO

        return `

          <article
            class="my-delivery-order"
            id="delivery-order-${escapeHTML(order.id)}">

            <div class="my-delivery-head">

              <strong>
                Pedido ${escapeHTML(order.order_number)}
              </strong>

              ${pill}

            </div>

            <div class="my-delivery-meta">

              Fecha:
              ${dateTime(order.created_at)}

              <br>

              Total:
              ${money(order.total)}

              <br>

              Modalidad:
              <span class="my-delivery-method">
                ${method}
              </span>

            </div>

            ${
              itemsHtml ||
              `
                <div class="my-delivery-empty">
                  Este pedido no tiene productos registrados.
                </div>
              `
            }

          </article>

        `;

      }).join("");

    } catch (error) {

      console.error(
        "ZERO-SHOP: Error al cargar entregas:",
        error
      );

      list.innerHTML = `
        <div class="my-delivery-empty">

          No fue posible cargar tus productos.

          <br><br>

          ${escapeHTML(
            error.message || "Error desconocido"
          )}

        </div>
      `;

    } finally {

      loading = false;

    }
  }

  // ==========================================
  // RECARGAR ENTREGAS
  // ==========================================

  async function refreshDeliveries() {

    if (!currentUserId) return;

    const { data, error } = await db.auth.getSession();

    if (error) {
      console.error(error);
      return;
    }

    if (data.session?.user?.id === currentUserId) {
      await loadMyDeliveries(data.session);
    }
  }

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  async function init() {

    try {

      const { data, error } = await db.auth.getSession();

      if (error) throw error;

      if (data.session?.user) {
        await loadMyDeliveries(data.session);
      }

    } catch (error) {

      console.error(
        "ZERO-SHOP: Error al iniciar entregas:",
        error
      );

    }

    // DETECTAR INICIO Y CIERRE DE SESIÓN

    db.auth.onAuthStateChange((event, session) => {

      if (
        event === "SIGNED_IN" &&
        session?.user
      ) {

        setTimeout(() => {
          loadMyDeliveries(session);
        }, 0);

      }

      if (event === "SIGNED_OUT") {

        currentUserId = null;

        const panel = $("myDigitalDeliveries");

        if (panel) {
          panel.hidden = true;
        }

      }

    });

    // Permitir que otros scripts soliciten una actualización.
    document.addEventListener(
      "zeroShopRefreshDeliveries",
      refreshDeliveries
    );
  }

  init();

})();
