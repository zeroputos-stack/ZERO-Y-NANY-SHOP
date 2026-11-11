
(() => {
  "use strict";

  const db = window.zeroSupabase;
  const $ = id => document.getElementById(id);

  if (!db) return;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

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

  function ensurePanel() {
    const grid = document.querySelector(
      "#accountView .account-dashboard-grid"
    );

    if (!grid) return null;

    let panel = $("myDigitalDeliveries");

    if (panel) return panel;

    const style = document.createElement("style");
    style.id = "myDigitalDeliveriesStyles";

    style.textContent = `
      .my-deliveries-panel {
        margin-top:18px;
      }

      .my-delivery-order {
        border:1px solid #ffffff18;
        background:#11101d;
        border-radius:15px;
        padding:15px;
        margin:12px 0;
      }

      .my-delivery-head {
        display:flex;
        justify-content:space-between;
        gap:10px;
        flex-wrap:wrap;
        align-items:center;
        margin-bottom:10px;
      }

      .my-delivery-head strong {
        font-size:13px;
      }

      .my-delivery-pill {
        font-size:10px;
        font-weight:800;
        border-radius:99px;
        padding:6px 9px;
        background:#ffb02018;
        color:#ffd38a;
        border:1px solid #ffb02044;
      }

      .my-delivery-pill.done {
        background:#19c37d18;
        color:#8ce8b7;
        border-color:#19c37d44;
      }

      .my-delivery-product {
        border-top:1px solid #ffffff12;
        padding:12px 0;
      }

      .my-delivery-product strong {
        display:block;
        font-size:12px;
      }

      .my-delivery-product small {
        display:block;
        color:#aaa6bf;
        font-size:11px;
        margin-top:5px;
      }

      .my-delivery-content {
        white-space:pre-wrap;
        overflow-wrap:anywhere;
        background:#090812;
        border:1px solid #ff719633;
        border-radius:11px;
        padding:12px;
        margin-top:9px;
        color:#f8eaf0;
        font-size:12px;
        line-height:1.6;
      }

      .my-delivery-pending {
        font-size:11px;
        color:#b7b1c9;
        margin-top:8px;
        line-height:1.5;
      }

      .my-delivery-copy {
        margin-top:9px;
        border:1px solid #ff719655;
        border-radius:9px;
        padding:8px 12px;
        background:#ff315d16;
        color:#ff9db7;
        font-weight:800;
        font-size:11px;
        cursor:pointer;
      }

      .my-delivery-copy:active {
        transform:scale(.98);
      }
    `;

    document.head.appendChild(style);

    panel = document.createElement("section");
    panel.id = "myDigitalDeliveries";
    panel.className = "account-panel my-deliveries-panel";

    panel.innerHTML = `
      <h3>✦ Mis productos entregados</h3>

      <p class="account-small">
        Aquí encontrarás los códigos, enlaces, cuentas e instrucciones
        correspondientes a tus compras.
      </p>

      <div id="myDigitalDeliveriesList">
        <div class="account-empty">
          Cargando tus entregas…
        </div>
      </div>
    `;

    grid.insertAdjacentElement("afterend", panel);

    panel.addEventListener("click", async event => {
      const button = event.target.closest("[data-copy-delivery]");

      if (!button) return;

      try {
        const content = decodeURIComponent(
          button.dataset.copyDelivery
        );

        await navigator.clipboard.writeText(content);

        const oldText = button.textContent;
        button.textContent = "✓ Copiado";

        setTimeout(() => {
          button.textContent = oldText;
        }, 1500);

      } catch (error) {
        button.textContent = "No se pudo copiar";
      }
    });

    return panel;
  }

  async function loadMyDeliveries(session) {
    const panel = ensurePanel();

    if (!panel) return;

    if (!session?.user) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;

    const list = $("myDigitalDeliveriesList");

    if (!list) return;

    list.innerHTML = `
      <div class="account-empty">
        Consultando tus productos…
      </div>
    `;

    try {
      const { data: orders, error: ordersError } = await db
        .from("orders")
        .select(`
          id,
          order_number,
          payment_status,
          delivery_status,
          delivered_at,
          total,
          created_at
        `)
        .eq("customer_user_id", session.user.id)
        .eq("delivery_method", "account")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      if (!orders?.length) {
        list.innerHTML = `
          <div class="account-empty">
            Todavía no tienes pedidos con entrega en Mi cuenta.
            Cuando realices una compra y selecciones esa modalidad,
            aparecerá aquí.
          </div>
        `;
        return;
      }

      const orderIds = orders.map(order => order.id);

      const [itemsResult, deliveriesResult] = await Promise.all([

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
      if (deliveriesResult.error) throw deliveriesResult.error;

      const itemsByOrder = new Map();

      (itemsResult.data || []).forEach(item => {
        if (!itemsByOrder.has(item.order_id)) {
          itemsByOrder.set(item.order_id, []);
        }

        itemsByOrder.get(item.order_id).push(item);
      });

      const deliveriesByItem = new Map(
        (deliveriesResult.data || []).map(row => [
          row.order_item_id,
          row
        ])
      );

      list.innerHTML = orders.map(order => {
        const items = itemsByOrder.get(order.id) || [];

        const delivered =
          order.delivery_status === "delivered";

        const paid =
          order.payment_status === "paid";

        const itemsHtml = items.map(item => {
          const delivery = deliveriesByItem.get(item.id);

          const variant = item.product_variant
            ? " · " + item.product_variant
            : "";

          if (!delivery) {
            return `
              <div class="my-delivery-product">
                <strong>
                  ${escapeHtml(item.product_name)}${escapeHtml(variant)}
                </strong>

                <small>
                  Cantidad: ${Number(item.quantity)}
                </small>

                <div class="my-delivery-pending">
                  ${
                    paid
                      ? "Tu pago está verificado. La tienda está preparando tu entrega. Los datos aparecerán aquí cuando estén listos."
                      : "Tu pedido está pendiente de verificación de pago."
                  }
                </div>
              </div>
            `;
          }

          const copyData = encodeURIComponent(
            delivery.delivery_content
          );

          return `
            <div class="my-delivery-product">
              <strong>
                ${escapeHtml(item.product_name)}${escapeHtml(variant)}
              </strong>

              <small>
                Cantidad: ${Number(item.quantity)}
              </small>

              <div class="my-delivery-content">
                ${escapeHtml(delivery.delivery_content)}
              </div>

              <small>
                Entregado: ${dateTime(delivery.delivered_at)}
              </small>

              <button
                type="button"
                class="my-delivery-copy"
                data-copy-delivery="${copyData}">
                Copiar datos de entrega
              </button>
            </div>
          `;
        }).join("");

        const pill = delivered
          ? `
            <span class="my-delivery-pill done">
              ✓ Entregado
            </span>
          `
          : `
            <span class="my-delivery-pill">
              ${paid
                ? "Pago verificado · En preparación"
                : "Pago pendiente"}
            </span>
          `;

        return `
          <article class="my-delivery-order">

            <div class="my-delivery-head">
              <strong>
                Pedido ${escapeHtml(order.order_number)}
              </strong>

              ${pill}
            </div>

            <div class="account-order-meta">
              ${dateTime(order.created_at)}
              · Total ${money(order.total)}
            </div>

            ${itemsHtml || `
              <div class="account-empty">
                Este pedido no tiene productos registrados.
              </div>
            `}

          </article>
        `;
      }).join("");

    } catch (error) {
      console.error(
        "ZERO SHOP: error al cargar entregas",
        error
      );

      list.innerHTML = `
        <div class="account-empty">
          No fue posible cargar tus entregas:
          ${escapeHtml(error.message || "Error desconocido")}
        </div>
      `;
    }
  }

  async function init() {
    const { data, error } = await db.auth.getSession();

    if (!error) {
      await loadMyDeliveries(data.session);
    }

    db.auth.onAuthStateChange((event, session) => {

      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => {
          loadMyDeliveries(session);
        }, 0);
      }

      if (event === "SIGNED_OUT") {
        const panel = $("myDigitalDeliveries");

        if (panel) {
          panel.hidden = true;
        }
      }
    });
  }

  init();
})();
