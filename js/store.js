

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const supabase = window.zeroSupabase;

  let products = [];
  let settings = {
    store_name: "ZERO Y NANY - SHOP",
    whatsapp_number: "526623459707",
    announcement: "Tu tienda digital, siempre disponible.",
    payment_instructions: "Confirma el método de pago por WhatsApp antes de realizar tu pago.",
    design: {}
  };
  let category = "Todas";

  function readCart() {
    try {
      const saved = JSON.parse(localStorage.getItem("zeroShopCloudCart") || "[]");
      if (!Array.isArray(saved)) return [];
      return saved
        .filter(item => item && typeof item.product_id === "string")
        .map(item => ({
          product_id: item.product_id,
          quantity: Math.max(1, Math.min(20, Number.parseInt(item.quantity, 10) || 1))
        }));
    } catch {
      return [];
    }
  }

  let cart = readCart();

  const money = (n) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(Number(n || 0));

  const safe = (value) =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
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
    toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
  }

  function imageUrl(path) {
    if (!path || !supabase) return "";
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl || "";
  }

  const waLink = (message = "Hola, quiero información de ZERO Y NANY - SHOP.") =>
    `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(message)}`;

  function showConfigWarning(message) {
    const status = $("storeStatus");
    const grid = $("productGrid");

    if (status) {
      status.hidden = false;
      status.textContent = message ||
        "La tienda no pudo conectarse con Supabase. Revisa config.js y la conexión del proyecto.";
    }

    if (grid) {
      grid.innerHTML = `<div class="empty-products">No fue posible cargar el catálogo. Verifica la configuración de Supabase.</div>`;
    }

    const count = $("heroProductCount");
    if (count) count.textContent = "—";
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
      hero_subtitle: "Explora el catálogo, revisa la disponibilidad y envía tu pedido de forma sencilla. Tus compras quedan registradas para darles seguimiento.",
      hero_cta: "Explorar catálogo",
      hero_image_path: null
    },
    sections: {
      hero: true,
      catalogo: true,
      "como-comprar": true,
      contacto: true
    },
    order: ["hero", "catalogo", "como-comprar", "contacto"]
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
      if (element && value !== undefined && value !== null) {
        element.textContent = value;
      }
    };

    const badge = $("heroBadge");

    if (badge) {
      const dot = badge.querySelector("i") || document.createElement("i");
      badge.replaceChildren(
        dot,
        document.createTextNode(` ${design.content.badge}`)
      );
    }

    setText("heroTitle", design.content.hero_title);
    setText("heroSubtitle", design.content.hero_subtitle);
    setText("heroCtaLabel", design.content.hero_cta);

    document.querySelectorAll("[data-store-name]").forEach(element => {
      element.textContent = settings.store_name || "ZERO Y NANY - SHOP";
    });

    const heroImage = $("heroImage");

    if (heroImage && design.content.hero_image_path) {
      heroImage.src = imageUrl(design.content.hero_image_path);
    }

    const main = document.querySelector("main");
    const sections = [...document.querySelectorAll("[data-design-section]")];

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

    const meta = document.querySelector('meta[name="description"]');

    if (meta) {
      meta.content = `${settings.store_name || "ZERO Y NANY - SHOP"}: tienda digital, catálogo y pedidos.`;
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

    const heroWhatsapp = $("heroWhatsapp");
    const contactWhatsapp = $("contactWhatsapp");

    if (heroWhatsapp) {
      heroWhatsapp.href = waLink();
    }

    if (contactWhatsapp) {
      contactWhatsapp.href = waLink(
        "Hola, necesito ayuda con mi pedido de ZERO Y NANY - SHOP."
      );
    }

    const year = $("year");
    if (year) year.textContent = new Date().getFullYear();
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

    const availableIds = new Set(products.map(product => product.id));

    cart = cart.filter(item => availableIds.has(item.product_id));

    saveCart();

    const count = $("heroProductCount");
    if (count) count.textContent = products.length;

    renderFilters();
    renderProducts();
  }

  function renderFilters() {
    const container = $("categoryFilters");
    if (!container) return;

    const categories = [
      "Todas",
      ...new Set(products.map(product => product.category))
    ];

    container.innerHTML = categories.map(name => `
      <button type="button"
        class="category-filter ${category === name ? "active" : ""}"
        data-category="${safe(name)}">${safe(name)}</button>
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

    const search = ($("searchInput")?.value || "").trim().toLowerCase();

    const filtered = products.filter(product =>
      (category === "Todas" || product.category === category) &&
      `${product.name} ${product.category} ${product.duration} ${product.modality} ${product.description}`
        .toLowerCase().includes(search)
    );

    grid.innerHTML = filtered.map(product => {
      const outOfStock =
        product.stock !== null && Number(product.stock) <= 0;

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
            ${image
              ? `<img src="${safe(image)}" alt="${safe(product.name)}" loading="lazy">`
              : `<span class="product-fallback">✦</span>`}
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

          <button type="button"
            class="btn btn-primary"
            data-add="${safe(product.id)}"
            ${outOfStock ? "disabled" : ""}>
            ${outOfStock ? "Agotado" : "Agregar al carrito"}
          </button>
        </article>
      `;
    }).join("") || `
      <div class="empty-products">
        No encontramos productos con esa búsqueda.
      </div>
    `;

    grid.querySelectorAll("[data-add]").forEach(button => {
      button.addEventListener("click", () => {
        addToCart(button.dataset.add);
      });
    });
  }

  function saveCart() {
    localStorage.setItem("zeroShopCloudCart", JSON.stringify(cart));
    renderCart();
  }

  function addToCart(id) {
    const product = products.find(item => item.id === id);
    if (!product) return;

    const existing = cart.find(item => item.product_id === id);
    const nextQuantity = (existing?.quantity || 0) + 1;

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

    saveCart();
    toast("Producto agregado al carrito.");
  }

  function renderCart() {
    const countElement = $("cartCount");
    const itemsElement = $("cartItems");
    const totalElement = $("cartTotal");

    if (!countElement || !itemsElement || !totalElement) return;

    const lines = cart.map(item => {
      const product = products.find(entry => entry.id === item.product_id);
      return product ? { ...item, product } : null;
    }).filter(Boolean);

    const count = lines.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const total = lines.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );

    countElement.textContent = count;
    totalElement.textContent = money(total);

    itemsElement.innerHTML = lines.length
      ? lines.map(item => `
          <div class="cart-line">
            <div>
              <strong>${safe(item.product.name)}</strong>
              <small>
                ${safe(item.product.category)} ·
                ${safe(item.product.duration || "")} ·
                ${safe(item.product.modality || "")}
              </small>
              <small>${money(item.product.price)} c/u</small>
            </div>

            <div class="cart-line-actions">
              <button type="button"
                data-minus="${safe(item.product_id)}"
                aria-label="Quitar uno">−</button>

              <b>${item.quantity}</b>

              <button type="button"
                data-plus="${safe(item.product_id)}"
                aria-label="Agregar uno">+</button>

              <button type="button"
                data-remove="${safe(item.product_id)}"
                aria-label="Eliminar">×</button>
            </div>
          </div>
        `).join("")
      : `
        <div class="empty-list">
          Tu carrito está vacío. Agrega algún producto del catálogo.
        </div>
      `;

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
      });
    });
  }

  function changeQty(id, delta) {
    const line = cart.find(item => item.product_id === id);
    const product = products.find(item => item.id === id);

    if (!line || !product) return;

    const nextQuantity = line.quantity + delta;

    if (nextQuantity <= 0) {
      cart = cart.filter(item => item.product_id !== id);
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
    $("cartDrawer")?.classList.toggle("open", open);
    $("cartBackdrop")?.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  }

  async function placeOrder(event) {
    event.preventDefault();

    if (!cart.length) {
      toast("Agrega productos antes de enviar tu pedido.");
      return;
    }

    const button = $("placeOrderBtn");
    if (!button) return;

    button.disabled = true;
    button.textContent = "Registrando pedido…";

    const payload = {
      p_customer_name: $("customerName").value.trim(),
      p_whatsapp: $("customerWhatsapp").value.trim(),
      p_notes: $("customerNotes").value.trim(),
      p_items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      }))
    };

    try {
      const { data, error } = await supabase.rpc(
        "create_zero_shop_order",
        payload
      );

      if (error) throw error;

      cart = [];
      saveCart();

      $("checkoutForm").hidden = true;

      const whatsapp = waLink(
        `Hola, realicé el pedido ${data.order_number} en ZERO Y NANY - SHOP por ${money(data.total)}. Mi nombre es ${payload.p_customer_name}. ¿Me ayudan a confirmar el pago y entrega?`
      );

      const result = $("checkoutResult");
      result.hidden = false;

      result.innerHTML = `
        <strong>Pedido ${safe(data.order_number)}</strong>
        Tu pedido quedó registrado por ${money(data.total)}.<br><br>

        <b>Instrucciones:</b>
        ${safe(settings.payment_instructions || "Confirma el método de pago por WhatsApp.")}<br><br>

        <a class="btn btn-primary btn-block"
          href="${safe(whatsapp)}"
          target="_blank"
          rel="noopener">
          Continuar por WhatsApp ↗
        </a>
      `;

      toast("Pedido registrado correctamente.");

    } catch (error) {
      toast(
        error?.message ||
        "No se pudo registrar el pedido. Intenta nuevamente."
      );
    } finally {
      button.disabled = false;
      button.textContent = "Enviar pedido";
    }
  }

  function initCart() {
    $("openCartBtn")?.addEventListener("click", () => openCart(true));
    $("closeCartBtn")?.addEventListener("click", () => openCart(false));
    $("cartBackdrop")?.addEventListener("click", () => openCart(false));

    $("checkoutForm")?.addEventListener("submit", placeOrder);

    $("searchInput")?.addEventListener("input", renderProducts);

    $("mobileMenuBtn")?.addEventListener("click", () => {
      $("mobileNav")?.classList.toggle("open");
    });

    renderCart();
  }

  async function start() {
    const year = $("year");
    if (year) year.textContent = new Date().getFullYear();

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
      console.error("ZERO-SHOP: error al iniciar la tienda", error);

      showConfigWarning(
        `No se pudo conectar con la base de datos: ${error.message || "error desconocido"}. Revisa las tablas y permisos de Supabase.`
      );
    }
  }

  start();
})();
