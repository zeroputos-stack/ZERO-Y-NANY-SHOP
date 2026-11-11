(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const db = window.zeroSupabase;

  const defaults = {
    payment_instructions:
      "Confirma el método de pago por WhatsApp antes de realizar tu pago.",
    payment_security_notice:
      "Verifica que los datos correspondan a ZERO Y NANY - SHOP antes de transferir.",
    payment_transfer_enabled: true,
    payment_whatsapp_enabled: true,
    payment_bank_name: "",
    payment_account_holder: "",
    payment_account_number: "",
    payment_clabe: "",
    delivery_whatsapp_enabled: true,
    delivery_account_enabled: true,
    delivery_eta_min: 5,
    delivery_eta_max: 15,
    delivery_eta_unit: "minutes",
    delivery_eta_description:
      "El tiempo puede variar según la disponibilidad del producto y la confirmación del pago."
  };

  let adminId = null;
  let saving = false;

  function injectPanel() {
    if ($("paymentDeliveryCard") || !$("settingsForm")) return;

    const style = document.createElement("style");
    style.textContent = `
      .pd-card{
        margin-top:24px;
        border:1px solid rgba(255,255,255,.08);
        border-radius:26px;
        padding:0;
        overflow:hidden;
        background:
          radial-gradient(circle at top right, rgba(255,49,93,.12), transparent 35%),
          linear-gradient(180deg, rgba(19,18,39,.98), rgba(10,9,24,.98));
        box-shadow:0 18px 45px rgba(0,0,0,.28);
      }

      .pd-hero{
        padding:22px 22px 18px;
        border-bottom:1px solid rgba(255,255,255,.06);
        background:
          linear-gradient(135deg, rgba(255,49,93,.15), rgba(123,63,242,.12));
      }

      .pd-hero-top{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:10px;
      }

      .pd-badge{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:8px 12px;
        border-radius:999px;
        font-size:12px;
        letter-spacing:.08em;
        text-transform:uppercase;
        font-weight:700;
        color:#ffd3df;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.08);
      }

      .pd-status-mini{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:8px 12px;
        border-radius:999px;
        font-size:12px;
        font-weight:700;
        color:#b9ffe2;
        background:rgba(30,255,153,.07);
        border:1px solid rgba(30,255,153,.18);
      }

      .pd-title{
        margin:0;
        font-size:30px;
        line-height:1.1;
        color:#fff;
        font-weight:800;
      }

      .pd-subtitle{
        margin:8px 0 0;
        color:rgba(255,255,255,.72);
        font-size:14px;
        line-height:1.6;
        max-width:780px;
      }

      .pd-body{
        padding:22px;
        display:grid;
        gap:18px;
      }

      .pd-section{
        position:relative;
        padding:20px;
        border:1px solid rgba(255,255,255,.08);
        border-radius:22px;
        display:grid;
        gap:16px;
        background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.02));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.03);
      }

      .pd-section-head{
        display:flex;
        align-items:flex-start;
        gap:14px;
      }

      .pd-icon{
        width:46px;
        height:46px;
        flex:0 0 46px;
        border-radius:16px;
        display:grid;
        place-items:center;
        font-size:22px;
        background:linear-gradient(135deg, #ff315d, #8c52ff);
        color:#fff;
        box-shadow:0 12px 25px rgba(255,49,93,.22);
      }

      .pd-section-head h3{
        margin:0;
        color:#fff;
        font-size:25px;
        line-height:1.15;
      }

      .pd-section-head p{
        margin:6px 0 0;
        color:rgba(255,255,255,.63);
        font-size:13px;
        line-height:1.55;
      }

      .pd-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px;
      }

      .pd-grid label{
        display:grid;
        gap:8px;
        color:#f4f0ff;
        font-size:14px;
        font-weight:600;
      }

      .pd-grid input,
      .pd-grid textarea,
      .pd-grid select{
        width:100%;
        box-sizing:border-box;
        border-radius:16px;
        border:1px solid rgba(255,255,255,.12);
        background:rgba(7,7,20,.78);
        color:#fff;
        padding:14px 15px;
        outline:none;
        font:inherit;
        transition:.2s ease;
      }

      .pd-grid textarea{
        resize:vertical;
        min-height:90px;
      }

      .pd-grid input::placeholder,
      .pd-grid textarea::placeholder{
        color:rgba(255,255,255,.36);
      }

      .pd-grid input:focus,
      .pd-grid textarea:focus,
      .pd-grid select:focus{
        border-color:rgba(255,49,93,.65);
        box-shadow:0 0 0 4px rgba(255,49,93,.12);
        transform:translateY(-1px);
      }

      .pd-wide{grid-column:1/-1}

      .pd-checks{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
      }

      .pd-check{
        display:flex;
        align-items:center;
        gap:12px;
        padding:15px 16px;
        border:1px solid rgba(255,255,255,.10);
        border-radius:18px;
        background:rgba(255,255,255,.025);
        transition:.2s ease;
      }

      .pd-check:hover{
        border-color:rgba(255,49,93,.35);
        background:rgba(255,49,93,.05);
      }

      .pd-check input{
        width:20px;
        height:20px;
        accent-color:#ff315d;
        flex:0 0 auto;
      }

      .pd-check span{
        display:block;
      }

      .pd-check strong{
        display:block;
        font-size:16px;
        color:#fff;
        margin-bottom:2px;
      }

      .pd-check small{
        display:block;
        color:rgba(255,255,255,.58);
        font-size:12px;
        line-height:1.45;
      }

      .pd-unit-note{
        margin-top:-6px;
        color:rgba(255,255,255,.52);
        font-size:12px;
      }

      .pd-submit-wrap{
        display:flex;
        align-items:center;
        gap:14px;
        flex-wrap:wrap;
        margin-top:4px;
      }

      .pd-btn{
        appearance:none;
        border:none;
        cursor:pointer;
        border-radius:18px;
        padding:15px 22px;
        font:inherit;
        font-weight:800;
        color:#fff;
        background:linear-gradient(135deg,#ff2d68,#ff4778 40%,#9d59ff);
        box-shadow:0 14px 35px rgba(255,49,93,.28);
        transition:.25s ease;
      }

      .pd-btn:hover{
        transform:translateY(-2px);
        box-shadow:0 18px 38px rgba(255,49,93,.34);
      }

      .pd-btn:disabled{
        opacity:.75;
        cursor:not-allowed;
        transform:none;
      }

      .pd-footer-help{
        color:rgba(255,255,255,.55);
        font-size:12px;
        line-height:1.5;
      }

      #pdMessage.form-message{
        margin-top:0;
        padding:12px 14px;
        border-radius:14px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.06);
        color:#ffd5df;
      }

      #pdMessage.form-message.ok{
        color:#b9ffe2;
        background:rgba(30,255,153,.06);
        border-color:rgba(30,255,153,.18);
      }

      @media (max-width: 780px){
        .pd-grid,.pd-checks{grid-template-columns:1fr}
        .pd-wide{grid-column:auto}
        .pd-title{font-size:26px}
        .pd-section{padding:18px}
        .pd-body{padding:16px}
        .pd-hero{padding:18px 16px 14px}
      }
    `;
    document.head.appendChild(style);

    const card = document.createElement("section");
    card.id = "paymentDeliveryCard";
    card.className = "panel-card pd-card";
    card.hidden = true;

    card.innerHTML = `
      <div class="pd-hero">
        <div class="pd-hero-top">
          <span class="pd-badge">✦ Configuración de compra</span>
          <span class="pd-status-mini">● Panel activo</span>
        </div>
        <h2 class="pd-title">Pagos, entrega y recepción</h2>
        <p class="pd-subtitle">
          Personaliza la experiencia final de compra. Aquí puedes definir los métodos de pago,
          los mensajes informativos que verá el cliente y la forma en que recibirá sus productos.
        </p>
      </div>

      <form id="paymentDeliveryForm" class="pd-body">

        <section class="pd-section">
          <div class="pd-section-head">
            <div class="pd-icon">💳</div>
            <div>
              <h3>01 · Métodos de pago</h3>
              <p>Activa o desactiva las formas de pago disponibles para tus clientes.</p>
            </div>
          </div>

          <div class="pd-checks">
            <label class="pd-check">
              <input id="pdTransfer" type="checkbox">
              <span>
                <strong>Transferencia bancaria</strong>
                <small>Muestra los datos bancarios al cliente para completar el pago.</small>
              </span>
            </label>

            <label class="pd-check">
              <input id="pdWhatsappPay" type="checkbox">
              <span>
                <strong>Pago por WhatsApp</strong>
                <small>Permite coordinar el pago directamente por mensaje.</small>
              </span>
            </label>
          </div>

          <div class="pd-grid">
            <label>Banco
              <input id="pdBank" maxlength="100" placeholder="Ej. BBVA, Banorte, Santander">
            </label>

            <label>Titular
              <input id="pdHolder" maxlength="120" placeholder="Nombre completo del titular">
            </label>

            <label>Número de cuenta
              <input id="pdAccount" maxlength="40" placeholder="Número de cuenta">
            </label>

            <label>CLABE
              <input id="pdClabe" maxlength="30" inputmode="numeric" placeholder="CLABE interbancaria">
            </label>
          </div>
        </section>

        <section class="pd-section">
          <div class="pd-section-head">
            <div class="pd-icon">📝</div>
            <div>
              <h3>02 · Textos que verá el cliente</h3>
              <p>Edita los mensajes visibles en la pantalla de finalización de compra.</p>
            </div>
          </div>

          <div class="pd-grid">
            <label class="pd-wide">
              Texto principal debajo de opciones de pago
              <textarea id="pdInstructions" rows="4" maxlength="1000" placeholder="Escribe las instrucciones de pago para el cliente"></textarea>
            </label>

            <label class="pd-wide">
              Aviso de seguridad
              <textarea id="pdSecurity" rows="3" maxlength="500" placeholder="Escribe un aviso de seguridad o confirmación"></textarea>
            </label>
          </div>
        </section>

        <section class="pd-section">
          <div class="pd-section-head">
            <div class="pd-icon">📦</div>
            <div>
              <h3>03 · Formas de recibir los productos</h3>
              <p>Configura cómo podrá recibir el cliente su compra digital.</p>
            </div>
          </div>

          <div class="pd-checks">
            <label class="pd-check">
              <input id="pdDeliveryWhatsapp" type="checkbox">
              <span>
                <strong>Recibir por WhatsApp</strong>
                <small>La información del producto o acceso será enviada por mensaje.</small>
              </span>
            </label>

            <label class="pd-check">
              <input id="pdDeliveryAccount" type="checkbox">
              <span>
                <strong>Recibir en Mi cuenta</strong>
                <small>El cliente podrá consultar el pedido y seguimiento desde la página.</small>
              </span>
            </label>
          </div>
        </section>

        <section class="pd-section">
          <div class="pd-section-head">
            <div class="pd-icon">⏱️</div>
            <div>
              <h3>04 · Tiempo estimado de entrega</h3>
              <p>Define el tiempo aproximado y la descripción que verá el cliente.</p>
            </div>
          </div>

          <div class="pd-grid">
            <label>Tiempo mínimo
              <input id="pdEtaMin" type="number" min="0" max="9999" required>
            </label>

            <label>Tiempo máximo
              <input id="pdEtaMax" type="number" min="0" max="9999" required>
            </label>

            <label>Unidad
              <select id="pdEtaUnit">
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Días</option>
              </select>
            </label>

            <label class="pd-wide">
              Descripción y condiciones de entrega
              <textarea id="pdEtaDescription" rows="3" maxlength="500" placeholder="Describe cómo funciona el tiempo de entrega"></textarea>
            </label>
          </div>

          <p class="pd-unit-note">
            Ejemplo: “La entrega puede variar según disponibilidad, validación de pago o demanda del servicio”.
          </p>
        </section>

        <div class="pd-submit-wrap">
          <button class="pd-btn" id="pdSave" type="submit">
            Guardar configuración de compra
          </button>
          <div class="pd-footer-help">
            Los cambios se guardan en Supabase y se reflejan en la vista del cliente.
          </div>
        </div>

        <div id="pdMessage" class="form-message" role="status"></div>
      </form>
    `;

    $("settingsForm").insertAdjacentElement("afterend", card);

    $("pdInstructions").addEventListener("input", () => {
      if ($("settingPayment")) {
        $("settingPayment").value = $("pdInstructions").value;
      }
    });

    if ($("settingPayment")) {
      $("settingPayment").addEventListener("input", () => {
        $("pdInstructions").value = $("settingPayment").value;
      });
    }

    $("paymentDeliveryForm").addEventListener("submit", saveSettings);
  }

  function showMessage(text, ok = false) {
    const el = $("pdMessage");
    if (!el) return;
    el.textContent = text;
    el.className = "form-message" + (ok ? " ok" : "");
  }

  function fill(data) {
    const d = { ...defaults, ...data };

    $("pdTransfer").checked = d.payment_transfer_enabled !== false;
    $("pdWhatsappPay").checked = d.payment_whatsapp_enabled !== false;

    $("pdBank").value = d.payment_bank_name || "";
    $("pdHolder").value = d.payment_account_holder || "";
    $("pdAccount").value = d.payment_account_number || "";
    $("pdClabe").value = d.payment_clabe || "";

    $("pdInstructions").value = d.payment_instructions || "";
    $("pdSecurity").value = d.payment_security_notice || "";

    if ($("settingPayment")) {
      $("settingPayment").value = d.payment_instructions || "";
    }

    $("pdDeliveryWhatsapp").checked = d.delivery_whatsapp_enabled !== false;
    $("pdDeliveryAccount").checked = d.delivery_account_enabled !== false;

    $("pdEtaMin").value = d.delivery_eta_min;
    $("pdEtaMax").value = d.delivery_eta_max;
    $("pdEtaUnit").value = d.delivery_eta_unit || "minutes";
    $("pdEtaDescription").value = d.delivery_eta_description || "";
  }

  async function verifyAdmin(session) {
    if (!session?.user || !db) return false;

    const { data, error } = await db
      .from("profiles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error || data?.role !== "admin") return false;

    adminId = session.user.id;
    return true;
  }

  async function loadSettings(session) {
    const card = $("paymentDeliveryCard");
    if (!card) return;

    if (!await verifyAdmin(session)) {
      card.hidden = true;
      return;
    }

    card.hidden = false;
    showMessage("Cargando configuración...");

    const { data, error } = await db
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      showMessage("Error al cargar: " + error.message);
      return;
    }

    fill(data);
    showMessage("Configuración cargada.", true);
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (saving) return;

    const min = Number($("pdEtaMin").value);
    const max = Number($("pdEtaMax").value);

    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) {
      showMessage("El tiempo máximo debe ser igual o mayor al mínimo.");
      return;
    }

    const { data: sessionData, error: sessionError } = await db.auth.getSession();

    if (
      sessionError ||
      !sessionData.session ||
      sessionData.session.user.id !== adminId ||
      !await verifyAdmin(sessionData.session)
    ) {
      showMessage("Tu sesión de administrador no es válida.");
      return;
    }

    const update = {
      payment_transfer_enabled: $("pdTransfer").checked,
      payment_whatsapp_enabled: $("pdWhatsappPay").checked,
      payment_bank_name: $("pdBank").value.trim(),
      payment_account_holder: $("pdHolder").value.trim(),
      payment_account_number: $("pdAccount").value.trim(),
      payment_clabe: $("pdClabe").value.trim(),
      payment_instructions: $("pdInstructions").value.trim(),
      payment_security_notice: $("pdSecurity").value.trim(),
      delivery_whatsapp_enabled: $("pdDeliveryWhatsapp").checked,
      delivery_account_enabled: $("pdDeliveryAccount").checked,
      delivery_eta_min: min,
      delivery_eta_max: max,
      delivery_eta_unit: $("pdEtaUnit").value,
      delivery_eta_description: $("pdEtaDescription").value.trim()
    };

    saving = true;
    $("pdSave").disabled = true;
    showMessage("Guardando configuración...");

    try {
      const { error } = await db
        .from("store_settings")
        .update(update)
        .eq("id", 1);

      if (error) throw error;

      if ($("settingPayment")) {
        $("settingPayment").value = update.payment_instructions;
      }

      showMessage("Configuración guardada correctamente.", true);
    } catch (error) {
      showMessage("No se pudo guardar: " + error.message);
    } finally {
      saving = false;
      $("pdSave").disabled = false;
    }
  }

  async function init() {
    injectPanel();

    if (!db || !$("paymentDeliveryForm")) {
      console.error("ZERO-SHOP: no se pudo iniciar el panel de pagos.");
      return;
    }

    const { data, error } = await db.auth.getSession();

    if (error) {
      showMessage("Error de sesión: " + error.message);
      return;
    }

    await loadSettings(data.session);

    db.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        loadSettings(session).catch(error => {
          showMessage(error.message);
        });
      }, 0);
    });
  }

  init();
})();