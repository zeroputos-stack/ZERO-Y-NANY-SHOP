
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const supabase = window.zeroSupabase;

  let products = [];
  let settings = {
    store_name: "ZERO Y NANY - SHOP",
    whatsapp_number: "526623459707",
    announcement: "Tu tienda digital, siempre disponible.",
    payment_instructions: "Confirma con la tienda los datos para realizar tu transferencia.",
    design: {}
  };

  let category = "Todas";

  const DELIVERY_ETA_TEXT =
    "El plazo se confirmará después de validar el pago y la disponibilidad del producto.";

  function readCart() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("zeroShopCloudCart") || "[]"
      );

      if (!Array.isArray(saved)) return [];

      return saved
        .filter(item => item && typeof item.product_id === "string")
        .map(item => ({
          product_id: item.product_id,
          quantity: Math.max(
            1,
            Math.min(20, Number.parseInt(item.quantity, 10) || 1)
          )
        }));
    } catch {
      return [];
    }
  }

  let cart = readCart();

  const money = (value) => new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(value || 0));

  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  let toastTimer;

  function toast(message) {
    const element = $("toast");
    if (!element) return;

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(
      () => element.classList.remove("show"),
      2800
    );
  }

  function imageUrl(path) {
    if (!path || !supabase) return "";

    return supabase.storage
      .from("product-images")
      .getPublicUrl(path).data.publicUrl || "";
  }

  const waLink = (
    message = "Hola, quiero información de ZERO Y NANY - SHOP."
  ) => {
    const phone = String(settings.whatsapp_number || "")
      .replace(/\D/g, "");

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  function showConfigWarning(message) {
    const status = $("storeStatus");
    const grid = $("productGrid");

    if (status) {
      status.hidden = false;
      status.textContent = message ||
        "La tienda no pudo conectarse con Supabase. Revisa config.js y la conexión del proyecto.";
    }

    if (grid) {
      grid.innerHTML =
        `<div class="empty-products">No fue posible cargar el catálogo. Verifica la configuración de Supabase.</div>`;
    }

    if ($("heroProductCount")) {
      $("heroProductCount").textContent = "—";
    }
  }

  const defaultDesign = {
    theme: {
      accent: "#ff315d",
      background: "#090812",
      panel: "#151426",
      text: "#f8f7ff",
      font: "Inter"
    },

    content: {
      badge: "TIENDA DIGITAL · ZERO Y NANY - SHOP",
      hero_title: "Lo que buscas, en un solo lugar.",
      hero_subtitle:
        "Explora el catálogo, revisa la disponibilidad y envía tu pedido de forma sencilla. Tus compras quedan registradas para darles seguimiento.",
      hero_cta: "Explorar catálogo",
      hero_image_path: null
    },

    sections: {
      hero: true,
      catalogo: true,
      "como-comprar": true,
      contacto: true
    },

    order: [
      "hero",
      "catalogo",
      "como-comprar",
      "contacto"
    ]
  };

  function applyStoreDesign(raw = {}) {
    const design = { ...defaultDesign, ...(raw || {}) };

    design.theme = {
      ...defaultDesign.theme,
      ...(design.theme || {})
    };

    design.content = {
      ...defaultDesign.content,
      ...(design.content || {})
    };

    design.sections = {
      ...defaultDesign.sections,
      ...(design.sections || {})
    };

    const root = document.documentElement;

    root.style.setProperty("--red", design.theme.accent);
    root.style.setProperty("--bg", design.theme.background);
    root.style.setProperty("--panel", design.theme.panel);
    root.style.setProperty("--panel2", design.theme.panel);
    root.style.setProperty("--text", design.theme.text);

    const font = design.theme.font === "system"
      ? "system-ui, sans-serif"
      : `"${design.theme.font}", system-ui, sans-serif`;

    root.style.setProperty("--store-font", font);
    document.body.style.fontFamily = "var(--store-font)";

    const setText = (id, value) => {
      const element = $(id);

      if (
        element &&
        value !== undefined &&
        value !== null
      ) {
        element.textContent = value;
      }
    };

    const badge = $("heroBadge");

    if (badge) {
      const dot =
        badge.querySelector("i") || document.createElement("i");

      badge.replaceChildren(
        dot,
        document.createTextNode(` ${design.content.badge}`)
      );
    }

    setText("heroTitle", design.content.hero_title);
    setText("heroSubtitle", design.content.hero_subtitle);
    setText("heroCtaLabel", design.content.hero_cta);

    document.querySelectorAll("[data-store-name]").forEach(element => {
      element.textContent =
        settings.store_name || "ZERO Y NANY - SHOP";
    });

    const heroImage = $("heroImage");

    if (
      heroImage &&
      design.content.hero_image_path
    ) {
      heroImage.src = imageUrl(design.content.hero_image_path);
    }

    const main = document.querySelector("main");

    const sections = [
      ...document.querySelectorAll("[data-design-section]")
    ];

    sections.forEach(element => {
      element.hidden =
        design.sections[element.dataset.designSection] === false;
    });

    if (main && Array.isArray(design.order)) {
      design.order.forEach(key => {
        const section = sections.find(
          element => element.dataset.designSection === key
        );

        if (section) main.appendChild(section);
      });
    }

    const meta = document.querySelector(
      'meta[name="description"]'
    );

    if (meta) {
      meta.content =
        `${settings.store_name || "ZERO Y NANY - SHOP"}: tienda digital, catálogo y pedidos.`;
    }
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      settings = { ...settings, ...data };
    }

    applyStoreDesign(settings.design || {});

    document.title = `${settings.store_name} | Tienda oficial`;

    if ($("heroWhatsapp")) {
      $("heroWhatsapp").href = waLink();
    }

    if ($("contactWhatsapp")) {
      $("contactWhatsapp").href = waLink(
        "Hola, necesito ayuda con mi pedido de ZERO Y NANY - SHOP."
      );
    }

    if ($("year")) {
      $("year").textContent = new Date().getFullYear();
    }

    if ($("paymentInstructionsText")) {
      $("paymentInstructionsText").textContent =
        settings.payment_instructions ||
        "Confirma con la tienda los datos para realizar tu transferencia.";
    }
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("category")
      .order("name");

    if (error) throw error;

    products = data || [];

    const availableIds = new Set(
      products.map(product => product.id)
    );

    cart = cart.filter(
      item => availableIds.has(item.product_id)
    );

    saveCart();

    if ($("heroProductCount")) {
      $("heroProductCount").textContent = products.length;
    }

    renderFilters();
    renderProducts();
  }

  function renderFilters() {
    const container = $("categoryFilters");

    if (!container) return;

    const categories = [
      "Todas",
      ...new Set(
        products.map(product => product.category).filter(Boolean)
      )
    ];

    container.innerHTML = categories.map(name => `
      <button
        type="button"
        class="category-filter ${category === name ? "active" : ""}"
        data-category="${safe(name)}"
      >${safe(name)}</button>
    `).join("");

    container.querySelectorAll("[data-category]").forEach(button => {
      button.addEventListener("click", () => {
        category = button.dataset.category;
        renderFilters();
        renderProducts();
      });
    });
  }

  function renderProducts() {
    const grid = $("productGrid");

    if (!grid) return;

    const search = (
      $("searchInput")?.value || ""
    ).trim().toLowerCase();

    const filtered = products.filter(product =>
      (category === "Todas" || product.category === category) &&
      `${product.name} ${product.category} ${product.duration} ${product.modality} ${product.description}`
        .toLowerCase()
        .includes(search)
    );

    grid.innerHTML = filtered.map(product => {
      const outOfStock =
        product.stock !== null &&
        Number(product.stock) <= 0;

      const stockText = outOfStock
        ? "Agotado"
        : product.stock === null
          ? "Consultar disponibilidad"
          : `${product.stock} disponibles`;

      const image = imageUrl(product.image_path);

      const variant = [
        product.duration && product.duration !== "—"
          ? product.duration
          : "",
        product.modality || ""
      ].filter(Boolean).join(" · ");

      return `
        <article class="product-card">
          <div class="product-image">
            ${
              image
                ? `<img src="${safe(image)}" alt="${safe(product.name)}" loading="lazy">`
                : `<span class="product-fallback">✦</span>`
            }
          </div>

          <div class="product-meta">
            <span class="product-category">${safe(product.category)}</span>
            <span class="stock-tag ${outOfStock ? "out" : product.stock === null ? "unknown" : ""}">
              ${safe(stockText)}
            </span>
          </div>

          <h3>${safe(product.name)}</h3>

          <div class="product-variant">
            ${safe(variant || product.description || "Disponible en ZERO Y NANY - SHOP")}
          </div>

          <div class="product-price">
            ${money(product.price)} <small>MXN</small>
          </div>

          <button
            type="button"
            class="btn btn-primary"
            data-add="${safe(product.id)}"
            ${outOfStock ? "disabled" : ""}
          >
            ${outOfStock ? "Agotado" : "Agregar al carrito"}
          </button>
        </article>
      `;
    }).join("") ||
      `<div class="empty-products">No encontramos productos con esa búsqueda.</div>`;

    grid.querySelectorAll("[data-add]").forEach(button => {
      button.addEventListener("click", () => {
        addToCart(button.dataset.add);
      });
    });
  }

  function cartLines() {
    return cart.map(item => {
      const product = products.find(
        entry => entry.id === item.product_id
      );

      if (!product) return null;

      const quantity = Math.max(
        1,
        Number(item.quantity) || 1
      );

      return {
        ...item,
        quantity,
        product,
        lineTotal: Number(product.price || 0) * quantity,
        image: imageUrl(product.image_path)
      };
    }).filter(Boolean);
  }

  function cartTotals() {
    const lines = cartLines();

    return {
      lines,
      unique: lines.length,
      units: lines.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
      total: lines.reduce(
        (sum, item) => sum + item.lineTotal,
        0
      )
    };
  }

  function resetCheckoutView() {
    if ($("checkoutResult")) {
      $("checkoutResult").hidden = true;
      $("checkoutResult").innerHTML = "";
    }

    if ($("checkoutView")) {
      $("checkoutView").hidden = true;
    }

    if ($("cartView")) {
      $("cartView").hidden = false;
    }

    if ($("checkoutForm")) {
      $("checkoutForm").hidden = false;
    }

    if ($("drawerTitle")) {
      $("drawerTitle").textContent = "Mi carrito";
    }
  }

  function saveCart() {
    localStorage.setItem(
      "zeroShopCloudCart",
      JSON.stringify(cart)
    );

    renderCart();
  }

  function addToCart(id) {
    const product = products.find(
      item => item.id === id
    );

    if (!product) return;

    const existing = cart.find(
      item => item.product_id === id
    );

    const nextQuantity =
      (existing?.quantity || 0) + 1;

    if (
      product.stock !== null &&
      nextQuantity > Number(product.stock)
    ) {
      toast("No hay más existencias disponibles.");
      return;
    }

    if (existing) {
      existing.quantity = nextQuantity;
    } else {
      cart.push({
        product_id: id,
        quantity: 1
      });
    }

    resetCheckoutView();
    saveCart();
    toast("Producto agregado al carrito.");
  }

  function renderCart() {
    const totals = cartTotals();

    const countElements = [
      $("cartCount"),
      $("cartCountFloating")
    ].filter(Boolean);

    countElements.forEach(element => {
      element.textContent = totals.units;
    });

    if ($("cartProductsLabel")) {
      $("cartProductsLabel").textContent =
        `${totals.unique} ${totals.unique === 1 ? "producto" : "productos"}`;
    }

    if ($("cartUnitsLabel")) {
      $("cartUnitsLabel").textContent =
        `${totals.units} ${totals.units === 1 ? "unidad seleccionada" : "unidades seleccionadas"}`;
    }

    if ($("cartUniqueCount")) {
      $("cartUniqueCount").textContent = totals.unique;
    }

    if ($("cartUnitCount")) {
      $("cartUnitCount").textContent = totals.units;
    }

    if ($("cartSubtotal")) {
      $("cartSubtotal").textContent = money(totals.total);
    }

    if ($("cartTotal")) {
      $("cartTotal").textContent = money(totals.total);
    }

    if ($("checkoutTotal")) {
      $("checkoutTotal").textContent = money(totals.total);
    }

    if ($("checkoutStartBtn")) {
      $("checkoutStartBtn").disabled = totals.units === 0;
    }

    const itemsElement = $("cartItems");

    if (!itemsElement) return;

    itemsElement.innerHTML = totals.lines.length
      ? totals.lines.map(item => `
          <article class="cart-line">
            <div class="cart-line-image">
              ${
                item.image
                  ? `<img src="${safe(item.image)}" alt="${safe(item.product.name)}">`
                  : "✦"
              }
            </div>

            <div class="cart-line-info">
              <strong>${safe(item.product.name)}</strong>

              <small>
                ${safe(item.product.category)}
                ${item.product.duration ? ` · ${safe(item.product.duration)}` : ""}
                ${item.product.modality ? ` · ${safe(item.product.modality)}` : ""}
              </small>

              <small>${money(item.product.price)} por unidad</small>

              <div class="cart-line-actions">
                <button type="button" data-minus="${safe(item.product_id)}" aria-label="Quitar una unidad">−</button>
                <b>${item.quantity}</b>
                <button type="button" data-plus="${safe(item.product_id)}" aria-label="Agregar una unidad">+</button>
                <button type="button" class="remove-line" data-remove="${safe(item.product_id)}" aria-label="Eliminar producto">×</button>
              </div>
            </div>

            <div class="cart-line-price">
              ${money(item.lineTotal)}
            </div>
          </article>
        `).join("")
      : `<div class="empty-list">Tu carrito está vacío. Explora el catálogo y agrega los productos que deseas comprar.</div>`;

    itemsElement.querySelectorAll("[data-minus]").forEach(button => {
      button.addEventListener("click", () => {
        changeQty(button.dataset.minus, -1);
      });
    });

    itemsElement.querySelectorAll("[data-plus]").forEach(button => {
      button.addEventListener("click", () => {
        changeQty(button.dataset.plus, 1);
      });
    });

    itemsElement.querySelectorAll("[data-remove]").forEach(button => {
      button.addEventListener("click", () => {
        cart = cart.filter(
          item => item.product_id !== button.dataset.remove
        );

        saveCart();
        toast("Producto eliminado del carrito.");
      });
    });
  }

  function changeQty(id, delta) {
    const line = cart.find(
      item => item.product_id === id
    );

    const product = products.find(
      item => item.id === id
    );

    if (!line || !product) return;

    const nextQuantity = line.quantity + delta;

    if (nextQuantity <= 0) {
      cart = cart.filter(
        item => item.product_id !== id
      );
    } else if (
      product.stock !== null &&
      nextQuantity > Number(product.stock)
    ) {
      toast("No hay más existencias disponibles.");
      return;
    } else {
      line.quantity = nextQuantity;
    }

    saveCart();
  }

  function openCart(open = true) {
    if (open) resetCheckoutView();

    $("cartDrawer")?.classList.toggle("open", open);
    $("cartBackdrop")?.classList.toggle("open", open);

    document.body.style.overflow =
      open ? "hidden" : "";
  }

  function selectedRadio(name, fallback) {
    return document.querySelector(
      `input[name="${name}"]:checked`
    )?.value || fallback;
  }

  function updatePaymentUI() {
    const method = selectedRadio(
      "paymentMethod",
      "transfer"
    );

    const instructions = $("transferInstructions");

    if (instructions) {
      instructions.hidden = method !== "transfer";
    }

    if ($("paymentInstructionsText")) {
      $("paymentInstructionsText").textContent =
        settings.payment_instructions ||
        "Solicita a la tienda los datos para realizar tu transferencia.";
    }
  }

  async function updateDeliveryUI() {
    const hint = $("accountDeliveryHint");

    if (!hint) return;

    const method = selectedRadio(
      "deliveryMethod",
      "whatsapp"
    );

    if (method !== "account") {
      hint.textContent =
        "Recibirás la información o instrucciones de entrega en el WhatsApp que registraste.";
      return;
    }

    if (!supabase?.auth?.getSession) {
      hint.innerHTML =
        `Para recibir tus productos en tu cuenta necesitas <a href="account.html">iniciar sesión o registrarte</a>.`;
      return;
    }

    try {
      const { data, error } =
        await supabase.auth.getSession();

      if (error) throw error;

      if (data?.session?.user) {
        hint.textContent =
          "Tu pedido se asociará a tu cuenta. Podrás consultarlo desde la sección Mi cuenta.";
      } else {
        hint.innerHTML =
          `Para recibir tus productos en la página, primero <a href="account.html">inicia sesión o regístrate</a>. Tu carrito se conservará en este dispositivo.`;
      }
    } catch {
      hint.innerHTML =
        `No pudimos comprobar tu sesión. <a href="account.html">Entra a Mi cuenta</a> y vuelve a intentarlo.`;
    }
  }

  function showCheckout() {
    if (!cart.length) {
      toast("Agrega al menos un producto para continuar.");
      return;
    }

    $("cartView").hidden = true;
    $("checkoutView").hidden = false;
    $("checkoutResult").hidden = true;
    $("drawerTitle").textContent = "Finalizar compra";

    if ($("deliveryEtaText")) {
      $("deliveryEtaText").textContent = DELIVERY_ETA_TEXT;
    }

    if ($("checkoutTotal")) {
      $("checkoutTotal").textContent =
        money(cartTotals().total);
    }

    updatePaymentUI();
    updateDeliveryUI();
  }

  function makeOrderWhatsappMessage(
    order,
    customer,
    paymentMethod,
    deliveryMethod,
    lines
  ) {
    const productLines = lines.map(item =>
      `• ${item.product.name} x${item.quantity} — ${money(item.lineTotal)}`
    );

    return [
      `Hola, acabo de registrar un pedido en ${settings.store_name || "ZERO Y NANY - SHOP"}.`,
      `Folio: ${order.order_number}`,
      `Nombre: ${customer.name}`,
      `Total: ${money(order.total)}`,
      `Pago: ${paymentMethod === "transfer" ? "Transferencia bancaria" : "Coordinar por WhatsApp"}`,
      `Entrega: ${deliveryMethod === "account" ? "Mi cuenta en la página" : "WhatsApp"}`,
      "Productos:",
      ...productLines,
      "¿Me apoyan con la confirmación, por favor?"
    ].join("\n");
  }

  async function placeOrder(event) {
    event.preventDefault();

    const totals = cartTotals();

    if (!totals.lines.length) {
      toast("Agrega productos antes de confirmar tu pedido.");
      return;
    }

    const button = $("placeOrderBtn");

    if (!button) return;

    const customer = {
      name: $("customerName").value.trim(),
      whatsapp: $("customerWhatsapp").value.trim(),
      notes: $("customerNotes").value.trim()
    };

    const paymentMethod = selectedRadio(
      "paymentMethod",
      "transfer"
    );

    const deliveryMethod = selectedRadio(
      "deliveryMethod",
      "whatsapp"
    );

    if (customer.name.length < 2) {
      toast("Escribe tu nombre completo.");
      return;
    }

    if (customer.whatsapp.replace(/\D/g, "").length < 8) {
      toast("Escribe un número de WhatsApp válido.");
      return;
    }

    if (deliveryMethod === "account") {
      try {
        const { data, error } =
          await supabase.auth.getSession();

        if (error) throw error;

        if (!data?.session?.user) {
          toast("Inicia sesión o regístrate para recibir tus productos en tu cuenta.");
          await updateDeliveryUI();
          return;
        }
      } catch (error) {
        toast(
          error?.message ||
          "No pudimos verificar tu sesión. Entra a Mi cuenta."
        );
        return;
      }
    }

    const paymentLabel =
      paymentMethod === "transfer"
        ? "Transferencia bancaria"
        : "Coordinar pago por WhatsApp";

    const deliveryLabel =
      deliveryMethod === "account"
        ? "Cuenta del cliente en la página"
        : "WhatsApp";

    const notesParts = [
      `Método de pago: ${paymentLabel}`,
      `Forma de entrega: ${deliveryLabel}`,
      `Tiempo estimado: ${DELIVERY_ETA_TEXT}`,
      customer.notes
        ? `Notas del cliente: ${customer.notes}`
        : ""
    ].filter(Boolean);

    const payload = {
      p_customer_name: customer.name,
      p_whatsapp: customer.whatsapp,
      p_notes: notesParts.join(" | ").slice(0, 500),
      p_items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      }))
    };

    button.disabled = true;
    button.textContent = "Registrando tu pedido…";

    try {
      const { data, error } = await supabase.rpc(
        "create_zero_shop_order",
        payload
      );

      if (error) throw error;

      if (!data?.order_number) {
        throw new Error(
          "El pedido se procesó, pero no recibimos el folio. Contacta a la tienda antes de volver a enviarlo."
        );
      }

      const order = data;

      const whatsappUrl = waLink(
        makeOrderWhatsappMessage(
          order,
          customer,
          paymentMethod,
          deliveryMethod,
          totals.lines
        )
      );

      cart = [];
      saveCart();

      $("cartView").hidden = true;
      $("checkoutView").hidden = true;
      $("drawerTitle").textContent = "Pedido registrado";

      const result = $("checkoutResult");

      const paymentHtml =
        paymentMethod === "transfer"
          ? `
            <div class="payment-instructions">
              <strong>Instrucciones para tu transferencia</strong>
              <p>${safe(settings.payment_instructions || "Contacta a la tienda para confirmar los datos de pago.")}</p>
              <small>Una vez realizado el pago, envía tu comprobante para validación.</small>
            </div>
          `
          : `
            <p>Elegiste coordinar el pago por WhatsApp. Usa el botón para enviar los datos de tu pedido a la tienda.</p>
          `;

      const deliveryHtml =
        deliveryMethod === "account"
          ? `
            <p>La entrega quedó solicitada en tu cuenta. Entra a <b>Mi cuenta</b> para consultar el seguimiento del pedido.</p>
          `
          : `
            <p>La entrega se coordinará por WhatsApp al número <b>${safe(customer.whatsapp)}</b>. El plazo se confirmará después de validar el pago.</p>
          `;

      result.innerHTML = `
        <h3>¡Pedido registrado!</h3>
        <p><b>Folio:</b> ${safe(order.order_number)}</p>
        <p><b>Total:</b> ${money(order.total)} MXN</p>
        ${paymentHtml}
        ${deliveryHtml}
        <div class="result-actions">
          <a class="btn btn-primary btn-block" href="${safe(whatsappUrl)}" target="_blank" rel="noopener">
            ${paymentMethod === "whatsapp" ? "Continuar por WhatsApp ↗" : "Enviar comprobante o consultar por WhatsApp ↗"}
          </a>
          ${
            deliveryMethod === "account"
              ? `<a class="btn btn-outline btn-block" href="account.html">Ir a Mi cuenta</a>`
              : ""
          }
          <button class="btn btn-soft btn-block" id="finishOrderBtn" type="button">Cerrar</button>
        </div>
      `;

      result.hidden = false;

      $("finishOrderBtn")?.addEventListener(
        "click",
        () => openCart(false)
      );

      toast("Tu pedido quedó registrado correctamente.");

    } catch (error) {
      console.error(
        "ZERO-SHOP: no se pudo registrar el pedido",
        error
      );

      toast(
        error?.message ||
        "No se pudo registrar el pedido. Intenta nuevamente."
      );

    } finally {
      button.disabled = false;
      button.textContent = "Confirmar y registrar pedido";
    }
  }

  function initCart() {
    $("openCartBtn")?.addEventListener(
      "click",
      () => openCart(true)
    );

    $("openCartFloatingBtn")?.addEventListener(
      "click",
      () => openCart(true)
    );

    $("closeCartBtn")?.addEventListener(
      "click",
      () => openCart(false)
    );

    $("cartBackdrop")?.addEventListener(
      "click",
      () => openCart(false)
    );

    $("checkoutStartBtn")?.addEventListener(
      "click",
      showCheckout
    );

    $("backToCartBtn")?.addEventListener("click", () => {
      $("checkoutView").hidden = true;
      $("cartView").hidden = false;
      $("drawerTitle").textContent = "Mi carrito";
    });

    $("continueShoppingBtn")?.addEventListener("click", () => {
      openCart(false);

      document.getElementById("catalogo")?.scrollIntoView({
        behavior: "smooth"
      });
    });

    $("checkoutForm")?.addEventListener(
      "submit",
      placeOrder
    );

    $("searchInput")?.addEventListener(
      "input",
      renderProducts
    );

    $("mobileMenuBtn")?.addEventListener("click", () => {
      $("mobileNav")?.classList.toggle("open");
    });

    document.querySelectorAll(
      'input[name="paymentMethod"]'
    ).forEach(input => {
      input.addEventListener("change", updatePaymentUI);
    });

    document.querySelectorAll(
      'input[name="deliveryMethod"]'
    ).forEach(input => {
      input.addEventListener("change", updateDeliveryUI);
    });

    renderCart();
  }

  async function start() {
    if ($("year")) {
      $("year").textContent = new Date().getFullYear();
    }

    initCart();

    if (!window.zeroSupabaseReady || !supabase) {
      showConfigWarning();
      return;
    }

    try {
      await loadSettings();
      await loadProducts();

      supabase.channel("zero-shop-public-products")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "products"
          },
          () => {
            loadProducts().catch(error => {
              showConfigWarning(error.message);
            });
          }
        )
        .subscribe();

    } catch (error) {
      console.error(
        "ZERO-SHOP: error al iniciar la tienda",
        error
      );

      showConfigWarning(
        `No se pudo conectar con la base de datos: ${error.message || "error desconocido"}. Revisa las tablas y permisos de Supabase.`
      );
    }
  }

  start();
})();
