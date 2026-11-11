
(() => {
  "use strict";

  const db = window.zeroSupabase;
  const $ = id => document.getElementById(id);

  if (!db) return;

  let initialized = false;
  let activeOrder = null;
  let activeItems = [];
  let activeDeliveries = new Map();
  let saving = false;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

  function addStyles() {
    if ($("zeroDeliveryAdminStyles")) return;

    const style = document.createElement("style");
    style.id = "zeroDeliveryAdminStyles";

    style.textContent = `
      .zod-entry{
        width:100%;
        margin-top:12px;
      }
      .zod-gate{
        display:block;
        color:#aaa6bf;
        font-size:12px;
        padding:8px 0;
      }
      .zod-open{
        min-height:40px;
      }
      .zod-overlay{
        position:fixed;
        inset:0;
        z-index:10050;
        background:rgba(5,4,14,.84);
        backdrop-filter:blur(9px);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:14px;
        overflow:auto;
      }
      .zod-overlay[hidden]{
        display:none!important;
      }
      .zod-modal{
        width:min(760px,100%);
        max-height:calc(100dvh - 28px);
        overflow:auto;
        background:#151426;
        color:#f8f7ff;
        border:1px solid #ff315d66;
        border-radius:22px;
        box-shadow:0 24px 80px #0009;
        padding:22px;
      }
      .zod-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        border-bottom:1px solid #ffffff14;
        padding-bottom:16px;
        margin-bottom:16px;
      }
      .zod-kicker{
        color:#ff7196;
        font-size:10px;
        font-weight:900;
        letter-spacing:1.8px;
      }
      .zod-head h2{
        font-size:22px;
        margin:5px 0;
      }
      .zod-head p,
      .zod-muted{
        color:#aaa6bf;
        font-size:13px;
        margin:0;
        line-height:1.55;
      }
      .zod-close{
        width:38px;
        height:38px;
        border:1px solid #ffffff20;
        border-radius:12px;
        color:#fff;
        background:#ffffff0a;
        font-size:23px;
        cursor:pointer;
      }
      .zod-summary{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
        margin-bottom:16px;
      }
      .zod-summary div{
        background:#0d0c18;
        border:1px solid #ffffff12;
        border-radius:13px;
        padding:11px;
      }
      .zod-summary small{
        display:block;
        color:#a9a5bb;
        font-size:10px;
        margin-bottom:5px;
      }
      .zod-summary b{
        font-size:12px;
        overflow-wrap:anywhere;
      }
      .zod-alert{
        padding:12px 14px;
        border-radius:12px;
        background:#ffb02014;
        border:1px solid #ffb02055;
        color:#ffda9a;
        font-size:12px;
        line-height:1.5;
        margin:12px 0;
      }
      .zod-alert.ok{
        background:#19c37d12;
        border-color:#19c37d55;
        color:#8be5b8;
      }
      .zod-item{
        border:1px solid #ffffff16;
        background:#100f1d;
        border-radius:15px;
        padding:14px;
        margin:11px 0;
        display:grid;
        gap:9px;
      }
      .zod-item-top strong{
        font-size:13px;
      }
      .zod-item-top small{
        display:block;
        color:#aaa6bf;
        font-size:11px;
        margin-top:4px;
      }
      .zod-item textarea{
        width:100%;
        min-height:105px;
        resize:vertical;
        box-sizing:border-box;
        border:1px solid #514363;
        background:#0b0a14;
        color:#fff;
        border-radius:12px;
        padding:12px;
        font:inherit;
        font-size:13px;
        line-height:1.5;
      }
      .zod-item textarea:focus{
        outline:2px solid #ff315d66;
        border-color:#ff7196;
      }
      .zod-item textarea:disabled{
        opacity:.55;
      }
      .zod-actions{
        display:flex;
        gap:9px;
        flex-wrap:wrap;
        margin-top:16px;
      }
      .zod-actions button{
        border:0;
        border-radius:12px;
        padding:13px 16px;
        font-weight:800;
        cursor:pointer;
      }
      .zod-save{
        background:linear-gradient(100deg,#ff315d,#c80b79);
        color:white;
        flex:1;
      }
      .zod-wa{
        background:#173c31;
        color:#a4f3c8;
      }
      .zod-actions button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }
      .zod-message{
        font-size:12px;
        color:#aaa6bf;
        margin-top:12px;
        min-height:18px;
      }
      .zod-message.ok{
        color:#83e6b5;
      }
      @media(max-width:560px){
        .zod-modal{
          padding:16px;
          border-radius:17px;
        }
        .zod-head h2{
          font-size:18px;
        }
        .zod-summary{
          grid-template-columns:1fr;
        }
        .zod-actions{
          display:grid;
        }
        .zod-actions button{
          width:100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createModal() {
    if ($("zeroDeliveryModal")) return;

    const overlay = document.createElement("div");
    overlay.id = "zeroDeliveryModal";
    overlay.className = "zod-overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
      <section class="zod-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zodOrderTitle">

        <header class="zod-head">
          <div>
            <span class="zod-kicker">
              ZERO Y NANY · ENTREGA DIGITAL
            </span>
            <h2 id="zodOrderTitle">Entregar productos</h2>
            <p id="zodCustomerLabel">
              Captura los datos que recibirá el cliente.
            </p>
          </div>

          <button type="button"
            class="zod-close"
            data-zod-close
            aria-label="Cerrar">×</button>
        </header>

        <div class="zod-summary" id="zodSummary"></div>

        <div id="zodAlert" class="zod-alert" hidden></div>

        <form id="zodDeliveryForm">
          <div id="zodItems"></div>

          <div class="zod-actions">
            <button class="zod-save"
              id="zodSaveButton"
              type="submit">
              Guardar y entregar productos
            </button>

            <button class="zod-wa"
              id="zodWhatsappButton"
              type="button"
              disabled>
              Enviar entrega por WhatsApp
            </button>
          </div>

          <div class="zod-message"
            id="zodMessage"
            role="status"></div>
        </form>
      </section>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", event => {
      if (
        event.target === overlay ||
        event.target.closest("[data-zod-close]")
      ) {
        closeModal();
      }
    });

    $("zodDeliveryForm").addEventListener("submit", saveDelivery);
    $("zodWhatsappButton").addEventListener("click", sendWhatsApp);
  }

  function setMessage(text, ok = false) {
    const el = $("zodMessage");
    if (!el) return;

    el.textContent = text;
    el.classList.toggle("ok", ok);
  }

  function showAlert(text, type = "warning") {
    const el = $("zodAlert");
    if (!el) return;

    el.hidden = !text;
    el.textContent = text || "";
    el.className = "zod-alert" + (type === "ok" ? " ok" : "");
  }

  function closeModal() {
    if ($("zeroDeliveryModal")) {
      $("zeroDeliveryModal").hidden = true;
    }

    activeOrder = null;
    activeItems = [];
    activeDeliveries = new Map();
    saving = false;
  }

  async function openDelivery(orderId) {
    createModal();

    $("zeroDeliveryModal").hidden = false;
    $("zodOrderTitle").textContent = "Cargando pedido…";
    $("zodCustomerLabel").textContent =
      "Consultando productos y estado del pago.";

    $("zodSummary").innerHTML = "";
    $("zodItems").innerHTML = "";
    $("zodSaveButton").disabled = true;
    $("zodWhatsappButton").disabled = true;

    showAlert("");
    setMessage("Cargando información…");

    try {
      const [orderResult, itemsResult, deliveriesResult] =
        await Promise.all([

          db.from("orders")
            .select(`
              id,
              order_number,
              customer_name,
              whatsapp,
              payment_status,
              status,
              delivery_method,
              delivery_status,
              customer_user_id,
              delivered_at
            `)
            .eq("id", orderId)
            .single(),

          db.from("order_items")
            .select(`
              id,
              order_id,
              product_name,
              product_variant,
              quantity,
              unit_price,
              line_total
            `)
            .eq("order_id", orderId)
            .order("created_at", { ascending: true }),

          db.from("order_deliveries")
            .select(`
              order_item_id,
              delivery_content,
              delivered_at
            `)
            .eq("order_id", orderId)
        ]);

      if (orderResult.error) throw orderResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (deliveriesResult.error) throw deliveriesResult.error;

      activeOrder = orderResult.data;
      activeItems = itemsResult.data || [];

      activeDeliveries = new Map(
        (deliveriesResult.data || []).map(row => [
          row.order_item_id,
          row.delivery_content
        ])
      );

      renderDeliveryForm();

    } catch (error) {
      setMessage(
        "No se pudo abrir el pedido: " +
        (error.message || "Error desconocido")
      );

      showAlert(
        "Comprueba que ejecutaste la migración SQL de entregas en Supabase."
      );
    }
  }

  function renderDeliveryForm() {
    if (!activeOrder) return;

    const order = activeOrder;
    const isPaid = order.payment_status === "paid";
    const canDeliver = isPaid && order.status !== "cancelled";
    const alreadyDelivered = order.delivery_status === "delivered";

    $("zodOrderTitle").textContent =
      "Pedido " + order.order_number;

    $("zodCustomerLabel").textContent =
      order.customer_name || "Cliente";

    $("zodSummary").innerHTML = `
      <div>
        <small>Estado del pago</small>
        <b>${isPaid ? "✓ Pago verificado" : "Pago pendiente"}</b>
      </div>

      <div>
        <small>Forma solicitada</small>
        <b>${order.delivery_method === "account"
          ? "Mi cuenta"
          : "WhatsApp"}</b>
      </div>

      <div>
        <small>Estado de entrega</small>
        <b>${alreadyDelivered ? "Entregado" : "Pendiente"}</b>
      </div>
    `;

    if (!isPaid) {
      showAlert(
        "Primero cambia el estado del pago a «Pagado» en el pedido y guarda el cambio."
      );
    } else if (order.status === "cancelled") {
      showAlert("Este pedido está cancelado y no puede entregarse.");
    } else if (
      order.delivery_method === "account" &&
      !order.customer_user_id
    ) {
      showAlert(
        "Este pedido no quedó vinculado a una cuenta. Puedes enviarlo por WhatsApp, pero no aparecerá en Mi cuenta."
      );
    } else if (alreadyDelivered) {
      showAlert(
        "Este pedido ya tiene una entrega registrada. Puedes revisar, corregir o volver a enviar los datos.",
        "ok"
      );
    } else {
      showAlert(
        "Captura los datos de acceso de cada producto. El cliente los verá cuando guardes la entrega.",
        "ok"
      );
    }

    $("zodItems").innerHTML = activeItems.map(item => {
      const content = activeDeliveries.get(item.id) || "";
      const variant = item.product_variant
        ? " · " + item.product_variant
        : "";

      return `
        <article class="zod-item">
          <div class="zod-item-top">
            <div>
              <strong>
                ${escapeHtml(item.product_name)}${escapeHtml(variant)}
              </strong>
              <small>Cantidad: ${Number(item.quantity)}</small>
            </div>
          </div>

          <textarea
            data-zod-item="${escapeHtml(item.id)}"
            maxlength="10000"
            placeholder="Escribe aquí el código, enlace o instrucciones de entrega…"
            ${canDeliver ? "" : "disabled"}
          >${escapeHtml(content)}</textarea>
        </article>
      `;
    }).join("") || '<p class="zod-muted">Este pedido no tiene productos.</p>';

    $("zodSaveButton").disabled =
      !canDeliver || activeItems.length === 0;

    $("zodSaveButton").textContent =
      alreadyDelivered
        ? "Actualizar entrega"
        : "Guardar y entregar productos";

    $("zodWhatsappButton").disabled = !alreadyDelivered;

    setMessage(alreadyDelivered ? "Entrega registrada." : "");
  }

  async function saveDelivery(event) {
    event.preventDefault();

    if (!activeOrder || saving) return;

    if (activeOrder.payment_status !== "paid") {
      showAlert("No se puede entregar hasta que el pago esté verificado.");
      return;
    }

    if (activeOrder.status === "cancelled") {
      showAlert("No se puede entregar un pedido cancelado.");
      return;
    }

    const fields = [
      ...document.querySelectorAll("#zodItems [data-zod-item]")
    ];

    const deliveries = fields.map(field => ({
      order_item_id: field.dataset.zodItem,
      delivery_content: field.value.trim()
    }));

    if (
      !deliveries.length ||
      deliveries.some(row => !row.delivery_content)
    ) {
      setMessage("Completa los datos de entrega de todos los productos.");
      return;
    }

    saving = true;
    $("zodSaveButton").disabled = true;
    $("zodSaveButton").textContent = "Guardando entrega…";

    setMessage("Guardando en Supabase…");

    try {
      const { error } = await db.rpc(
        "save_zero_shop_delivery",
        {
          p_order_id: activeOrder.id,
          p_deliveries: deliveries
        }
      );

      if (error) throw error;

      deliveries.forEach(row => {
        activeDeliveries.set(
          row.order_item_id,
          row.delivery_content
        );
      });

      activeOrder.delivery_status = "delivered";
      activeOrder.status = "completed";
      activeOrder.delivered_at = new Date().toISOString();

      renderDeliveryForm();

      showAlert(
        "Productos guardados y marcados como entregados. Si el cliente eligió Mi cuenta, ya puede consultarlos desde su perfil.",
        "ok"
      );

      setMessage("Entrega guardada correctamente.", true);

      $("refreshOrders")?.click();

    } catch (error) {
      setMessage(
        "No se pudo guardar: " +
        (error.message || "Error desconocido")
      );

      $("zodSaveButton").disabled = false;

    } finally {
      saving = false;

      if (activeOrder) {
        $("zodSaveButton").textContent =
          activeOrder.delivery_status === "delivered"
            ? "Actualizar entrega"
            : "Guardar y entregar productos";
      }
    }
  }

  function sendWhatsApp() {
    if (!activeOrder) return;

    const phone = String(activeOrder.whatsapp || "")
      .replace(/\D/g, "");

    if (phone.length < 8) {
      setMessage("El pedido no tiene un número de WhatsApp válido.");
      return;
    }

    let message;

    if (
      activeOrder.delivery_method === "account" &&
      activeOrder.customer_user_id
    ) {
      message = [
        `Hola ${activeOrder.customer_name || "cliente"}.`,
        `Tu pedido ${activeOrder.order_number} de ZERO Y NANY - SHOP ya fue entregado.`,
        "",
        "Puedes consultar tus productos y datos de acceso desde Mi cuenta:",
        `${location.origin}/account.html`,
        "",
        "Gracias por tu compra."
      ].join("\n");

    } else {
      const fields = [
        ...document.querySelectorAll("#zodItems [data-zod-item]")
      ];

      const contents = new Map(
        fields.map(field => [
          field.dataset.zodItem,
          field.value.trim()
        ])
      );

      const productLines = activeItems.map(item => {
        const variant = item.product_variant
          ? " · " + item.product_variant
          : "";

        const content =
          activeDeliveries.get(item.id) ||
          contents.get(item.id) ||
          "";

        return `${item.product_name}${variant} x${item.quantity}\n${content}`;
      });

      message = [
        `Hola ${activeOrder.customer_name || "cliente"}, tu pedido ${activeOrder.order_number} de ZERO Y NANY - SHOP ya está listo.`,
        "",
        "Datos de tus productos:",
        ...productLines,
        "",
        "Gracias por tu compra."
      ].join("\n");
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // Añade la opción de entrega solamente cuando el pago está verificado.
  function enhanceOrderCards() {
    const list = $("ordersList");
    if (!list) return;

    list.querySelectorAll(".order-card").forEach(card => {
      const statusSelect =
        card.querySelector("[data-order-status]");

      const paymentSelect =
        card.querySelector("[data-payment-status]");

      const orderId =
        statusSelect?.dataset.orderStatus ||
        paymentSelect?.dataset.paymentStatus;

      const controls = card.querySelector(".order-controls");

      if (!orderId || !controls || !paymentSelect) return;

      let entry = card.querySelector(".zod-entry");

      if (!entry) {
        entry = document.createElement("div");
        entry.className = "zod-entry";
        controls.appendChild(entry);
      }

      const payment = paymentSelect.value;
      const status = statusSelect?.value || "";
      const signature = `${payment}|${status}`;

      if (entry.dataset.signature === signature) return;

      entry.dataset.signature = signature;

      if (status === "cancelled") {
        entry.innerHTML = `
          <small class="zod-gate">
            Este pedido está cancelado.
          </small>
        `;
      } else if (payment !== "paid") {
        entry.innerHTML = `
          <small class="zod-gate">
            🔒 Verifica el pago para habilitar la entrega.
          </small>
        `;
      } else {
        const label = status === "completed"
          ? "Revisar / actualizar entrega"
          : "✦ Preparar entrega";

        entry.innerHTML = `
          <button
            type="button"
            class="btn btn-primary btn-sm zod-open"
            data-zod-open="${escapeHtml(orderId)}">
            ${label}
          </button>
        `;
      }
    });
  }

  function bindOrders() {
    const list = $("ordersList");

    if (!list || list.dataset.zodBound === "true") return;

    list.dataset.zodBound = "true";

    list.addEventListener("click", event => {
      const button = event.target.closest("[data-zod-open]");

      if (button) {
        openDelivery(button.dataset.zodOpen);
      }
    });

    const observer = new MutationObserver(enhanceOrderCards);

    observer.observe(list, {
      childList: true,
      subtree: true
    });

    enhanceOrderCards();
  }

  async function startForSession(session) {
    if (initialized || !session?.user) return;

    const { data, error } = await db
      .from("profiles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error || data?.role !== "admin") return;

    initialized = true;

    addStyles();
    createModal();
    bindOrders();
  }

  async function init() {
    const { data, error } = await db.auth.getSession();

    if (!error) {
      await startForSession(data.session);
    }

    db.auth.onAuthStateChange((event, session) => {
      if (e