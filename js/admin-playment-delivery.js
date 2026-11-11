
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
    delivery_eta_condition:
      "después de confirmar el pago y la disponibilidad del producto"
  };

  let adminId = null;
  let saving = false;

  function injectPanel() {
    if ($("paymentDeliveryCard") || !$("settingsForm")) return;

    const style = document.createElement("style");
    style.textContent = `
      .pd-card{margin-top:20px;display:grid;gap:18px}
      .pd-section{padding:16px;border:1px solid var(--line);
        border-radius:15px;display:grid;gap:12px}
      .pd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .pd-grid label{display:grid;gap:7px}
      .pd-grid input,.pd-grid textarea,.pd-grid select{
        width:100%;box-sizing:border-box}
      .pd-wide{grid-column:1/-1}
      .pd-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .pd-checks label{display:flex;align-items:center;gap:9px;
        padding:12px;border:1px solid var(--line);border-radius:12px}
      .pd-checks input{width:18px;height:18px;accent-color:var(--red)}
      .pd-card .pd-help{font-size:12px;color:var(--muted);margin:0}
      @media(max-width:650px){
        .pd-grid,.pd-checks{grid-template-columns:1fr}
        .pd-wide{grid-column:auto}
      }
    `;
    document.head.appendChild(style);

    const card = document.createElement("section");
    card.id = "paymentDeliveryCard";
    card.className = "panel-card pd-card";
    card.hidden = true;

    card.innerHTML = `
      <div>
        <span class="eyebrow">CONFIGURACIÓN DE COMPRA</span>
        <h2>Pagos, recepción y entrega</h2>
        <p class="pd-help">Administra lo que verá el cliente al finalizar su compra.</p>
      </div>

      <form id="paymentDeliveryForm">

        <section class="pd-section">
          <h3>01 · Métodos de pago</h3>
          <div class="pd-checks">
            <label><input id="pdTransfer" type="checkbox"> Transferencia bancaria</label>
            <label><input id="pdWhatsappPay" type="checkbox"> Pago por WhatsApp</label>
          </div>

          <div class="pd-grid">
            <label>Banco
              <input id="pdBank" maxlength="100" placeholder="Nombre del banco">
            </label>
            <label>Titular
              <input id="pdHolder" maxlength="120" placeholder="Nombre del titular">
            </label>
            <label>Número de cuenta
              <input id="pdAccount" maxlength="40">
            </label>
            <label>CLABE
              <input id="pdClabe" maxlength="30" inputmode="numeric">
            </label>
          </div>
        </section>

        <section class="pd-section">
          <h3>02 · Textos que verá el cliente</h3>
          <div class="pd-grid">
            <label class="pd-wide">
              Texto principal debajo de opciones de pago
              <textarea id="pdInstructions" rows="4" maxlength="1000"></textarea>
            </label>
            <label class="pd-wide">
              Aviso de seguridad
              <textarea id="pdSecurity" rows="3" maxlength="500"></textarea>
            </label>
          </div>
        </section>

        <section class="pd-section">
          <h3>03 · Formas de recibir los productos</h3>
          <div class="pd-checks">
            <label><input id="pdDeliveryWhatsapp" type="checkbox"> Recibir por WhatsApp</label>
            <label><input id="pdDeliveryAccount" type="checkbox"> Recibir en Mi cuenta</label>
          </div>
        </section>

        <section class="pd-section">
          <h3>04 · Tiempo estimado de entrega</h3>
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
            <label class="pd-wide">Condición de entrega
              <textarea id="pdEtaCondition" rows="2" maxlength="180"></textarea>
            </label>
          </div>
        </section>

        <button class="btn btn-primary" id="pdSave" type="submit">
          Guardar configuración de compra
        </button>

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

    $("pdInstructions").value = d.payment_instructions;
    $("pdSecurity").value = d.payment_security_notice;

    if ($("settingPayment")) {
      $("settingPayment").value = d.payment_instructions;
    }

    $("pdDeliveryWhatsapp").checked =
      d.delivery_whatsapp_enabled !== false;

    $("pdDeliveryAccount").checked =
      d.delivery_account_enabled !== false;

    $("pdEtaMin").value = d.delivery_eta_min;
    $("pdEtaMax").value = d.delivery_eta_max;
    $("pdEtaUnit").value = d.delivery_eta_unit;
    $("pdEtaCondition").value = d.delivery_eta_condition;
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

    if (!Number.isInteger(min) || !Number.isInteger(max) ||
        min < 0 || max < min) {
      showMessage("El tiempo máximo debe ser igual o mayor al mínimo.");
      return;
    }

    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError ||
        !sessionData.session ||
        sessionData.session.user.id !== adminId ||
        !await verifyAdmin(sessionData.session)) {
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
      delivery_eta_condition: $("pdEtaCondition").value.trim()
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

    if (!db || !$("paymentDeliveryForm")) return;

    const { data } = await db.auth.getSession();
    await loadSettings(data.session);

    db.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        loadSettings(session).catch(error =>
          showMessage(error.message)
        );
      }, 0);
    });
  }

  init();
})();
