
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const supabase = window.zeroSupabase;

  let activeAdminId = null;
  let busy = false;

  const DEFAULT_INSTRUCTIONS =
    "Confirma el método de pago por WhatsApp antes de realizar tu pago.";

  const DEFAULT_SECURITY_NOTICE =
    "Verifica que los datos correspondan a ZERO Y NANY - SHOP antes de transferir.";

  const STYLE = `
    .payment-delivery-card {
      margin-top:18px;
      display:grid;
      gap:18px;
    }

    .payment-delivery-card h2 {
      margin:0;
      font-size:19px;
    }

    .payment-delivery-card h3 {
      margin:0 0 10px;
      font-size:14px;
    }

    .payment-delivery-card .settings-intro {
      margin:5px 0 0;
      color:var(--muted);
      font-size:12px;
      line-height:1.55;
    }

    .pd-group {
      padding:16px;
      border:1px solid var(--line);
      border-radius:16px;
      background:#ffffff05;
      display:grid;
      gap:12px;
    }

    .pd-toggle-grid {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
    }

    .pd-toggle {
      display:flex;
      align-items:center;
      gap:10px;
      padding:12px;
      border:1px solid var(--line);
      border-radius:12px;
      background:#ffffff06;
      font-size:12px;
      font-weight:700;
    }

    .pd-toggle input {
      width:18px;
      height:18px;
      accent-color:var(--red);
      flex:0 0 auto;
    }

    .pd-fields {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
    }

    .pd-fields label {
      display:grid;
      gap:6px;
      font-size:11px;
      font-weight:700;
    }

    .pd-fields input,
    .pd-fields select,
    .pd-fields textarea {
      width:100%;
      min-width:0;
      box-sizing:border-box;
    }

    .pd-span-2 {
      grid-column:1/-1;
    }

    .pd-help {
      margin:0;
      color:var(--muted);
      font-size:10px;
      line-height:1.5;
    }

    .pd-save-row {
      display:flex;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
    }

    @media(max-width:650px) {
      .pd-toggle-grid,
      .pd-fields {
        grid-template-columns:1fr;
      }

      .pd-span-2 {
        grid-column:auto;
      }
    }
  `;

  function syncPaymentFields() {
    const main = $("pdPaymentInstructions");
    const legacy = $("settingPayment");

    if (!main || !legacy || main.dataset.syncBound) return;

    main.addEventListener("input", () => {
      legacy.value = main.value;
    });

    legacy.addEventListener("input", () => {
      main.value = legacy.value;
    });

    main.dataset.syncBound = "true";
  }

  function injectPanel() {
    const tab = $("tab-settings");
    const baseForm = $("settingsForm");

    if (!tab || !baseForm || $("paymentDeliveryCard")) return;

    if (!document.getElementById("paymentDeliveryAdminStyles")) {
      const style = document.createElement("style");
      style.id = "paymentDeliveryAdminStyles";
      style.textContent = STYLE;
      document.head.appendChild(style);
    }

    const card = document.createElement("section");

    card.id = "paymentDeliveryCard";
    card.className =
      "panel-card settings-form payment-delivery-card";
    card.hidden = true;

    card.innerHTML = `
      <div>
        <span class="eyebrow">CONFIGURACIÓN DE COMPRA</span>
        <h2>Pagos, recepción y entrega</h2>
        <p class="settings-intro">
          Personaliza las opciones de pago, los mensajes que aparecen
          al cliente y el tiempo de entrega.
        </p>
      </div>

      <form id="paymentDeliveryForm">

        <section class="pd-group">

          <div>
            <h3>01 · Métodos de pago</h3>
            <p class="pd-help">
              Activa o desactiva los métodos disponibles.
            </p>
          </div>

          <div class="pd-toggle-grid">
            <label class="pd-toggle">
              <input id="pdTransferEnabled" type="checkbox">
              Habilitar transferencia bancaria
            </label>

            <label class="pd-toggle">
              <input id="pdWhatsappPaymentEnabled" type="checkbox">
              Habilitar pago por WhatsApp
            </label>
          </div>

          <div class="pd-fields">

            <label>
              Banco
              <input id="pdBankName" maxlength="100"
                placeholder="Nombre del banco">
            </label>

            <label>
              Titular de la cuenta
              <input id="pdAccountHolder" maxlength="120"
                placeholder="Nombre del titular">
            </label>

            <label>
              Número de cuenta
              <input id="pdAccountNumber" maxlength="40"
                placeholder="Número de cuenta">
            </label>

            <label>
              CLABE interbancaria
              <input id="pdClabe" maxlength="30"
                inputmode="numeric" placeholder="CLABE">
            </label>

          </div>

        </section>


        <section class="pd-group">

          <div>
            <h3>02 · Mensajes de pago para el cliente</h3>
            <p class="pd-help">
              Estos mensajes aparecerán debajo de las opciones
              de pago en la pantalla Finalizar compra.
            </p>
          </div>

          <div class="pd-fields">

            <label class="pd-span-2">
              Texto principal debajo de opciones de pago

              <textarea
                id="pdPaymentInstructions"
                rows="3"
                maxlength="1000"
                placeholder="Escribe las instrucciones que verá el cliente..."
              ></textarea>
            </label>

            <label class="pd-span-2">
              Aviso de seguridad (texto pequeño)

              <textarea
                id="pdPaymentSecurityNotice"
                rows="2"
                maxlength="500"
                placeholder="Escribe el aviso de seguridad..."
              ></textarea>
            </label>

          </div>

        </section>


        <section class="pd-group">

          <div>
            <h3>03 · Forma de recibir los productos</h3>
            <p class="pd-help">
              Puedes ofrecer una o ambas modalidades.
            </p>
          </div>

          <div class="pd-toggle-grid">

            <label class="pd-toggle">
              <input id="pdDeliveryWhatsappEnabled" type="checkbox">
              Entrega mediante WhatsApp
            </label>

            <label class="pd-toggle">
              <input id="pdDeliveryAccountEnabled" type="checkbox">
              Entrega en la cuenta de la página
            </label>

          </div>

        </section>


        <section class="pd-group">

          <div>
            <h3>04 · Tiempo estimado de entrega</h3>
            <p class="pd-help">
              Este plazo aparecerá durante la compra.
            </p>
          </div>

          <div class="pd-fields">

            <label>
              Tiempo mínimo
              <input id="pdEtaMin" type="number"
                min="0" max="9999" step="1" required>
            </label>

            <label>
              Tiempo máximo
              <input id="pdEtaMax" type="number"
                min="0" max="9999" step="1" required>
            </label>

            <label>
              Unidad de tiempo
              <select id="pdEtaUnit">
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Días</option>
              </select>
            </label>

            <label class="pd-span-2">
              Condición o momento de inicio

              <textarea
                id="pdEtaCondition"
                rows="2"
                maxlength="180"
                placeholder="Después de confirmar el pago..."
              ></textarea>
            </label>

          </div>

        </section>


        <div class="pd-save-row">

          <button
            class="btn btn-primary"
            id="pdSaveBtn"
            type="submit"
          >
            Guardar pagos y entrega
          </button>

          <span
            id="pdMessage"
            class="form-message"
            role="status"
            aria-live="polite"
          ></span>

        </div>

      </form>
    `;

    baseForm.insertAdjacentElement("afterend", card);

    syncPaymentFields();
  }


  function setMessage(text, ok = false) {
    const element = $("pdMessage");
    if (!element) return;

    element.textContent = text;
    element.className = "form-message" + (ok ? " ok" : "");
  }


  function fillForm(data = {}) {

    $("pdTransferEnabled").checked =
      data.payment_transfer_enabled !== false;

    $("pdWhatsappPaymentEnabled").checked =
      data.payment_whatsapp_enabled !== false;

    $("pdBankName").value =
      data.payment_bank_name || "";

    $("pdAccountHolder").value =
      data.payment_account_holder || "";

    $("pdAccountNumber").value =
      data.payment_account_number || "";

    $("pdClabe").value =
      data.payment_clabe || "";

    $("pdPaymentInstructions").value =
      data.payment_instructions || DEFAULT_INSTRUCTIONS;

    $("pdPaymentSecurityNotice").value =
      data.payment_security_notice ?? DEFAULT_SECURITY_NOTICE;

    // Mantiene sincronizado el campo anterior de Ajustes.
    if ($("settingPayment")) {
      $("settingPayment").value =
        $("pdPaymentInstructions").value;
    }

    $("pdDeliveryWhatsappEnabled").checked =
      data.delivery_whatsapp_enabled !== false;

    $("pdDeliveryAccountEnabled").checked =
      data.delivery_account_enabled !== false;

    $("pdEtaMin").value =
      Number.isInteger(Number(data.delivery_eta_min))
        ? Number(data.delivery_eta_min) : 5;

    $("pdEtaMax").value =
      Number.isInteger(Number(data.delivery_eta_max))
        ? Number(data.delivery_eta_max) : 15;

    $("pdEtaUnit").value =
      ["minutes", "hours", "days"].includes(data.delivery_eta_unit)
        ? data.delivery_eta_unit : "minutes";

    $("pdEtaCondition").value =
      data.delivery_eta_condition ||
      "después de confirmar el pago y la disponibilidad del producto";
  }


  async function getAdminUser(session) {
    const user = session?.user;

    if (!user || !supabase) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || data?.role !== "admin") return null;

    return user;
  }


  async function loadSettings(session) {
    const card = $("paymentDeliveryCard");

    if (!card) return;

    const user = await getAdminUser(session);

    if (!user) {
      activeAdminId = null;
      card.hidden = true;
      return;
    }

    activeAdminId = user.id;
    card.hidden = false;

    setMessage("Cargando configuración…");

    const { data, error } = await supabase
      .from("store_settings")
      .select(`
        payment_transfer_enabled,
        payment_whatsapp_enabled,
        payment_bank_name,
        payment_account_holder,
        payment_account_number,
        payment_clabe,
        payment_instructions,
        payment_security_notice,
        delivery_whatsapp_enabled,
        delivery_account_enabled,
        delivery_eta_min,
        delivery_eta_max,
        delivery_eta_unit,
        delivery_eta_condition
      `)
      .eq("id", 1)
      .single();

    if (error) {
      setMessage("No se pudo cargar la configuración: " + error.message);
      return;
    }

    fillForm(data || {});
    setMessage("Configuración cargada.", true);
  }


  async function saveSettings(event) {
    event.preventDefault();

    if (busy) return;

    const min = Number($("pdEtaMin").value);
    const max = Number($("pdEtaMax").value);

    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min < 0 ||
      max < min
    ) {
      setMessage(
        "Revisa el tiempo: el máximo no puede ser menor que el mínimo."
      );
      return;
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !sessionData?.session?.user ||
      sessionData.session.user.id !== activeAdminId
    ) {
      setMessage("Tu sesión de administrador no está activa.");
      return;
    }

    const user = await getAdminUser(sessionData.session);

    if (!user) {
      setMessage("Esta cuenta ya no tiene permisos de administrador.");
      $("paymentDeliveryCard").hidden = true;
      return;
    }

    const instructions = $("pdPaymentInstructions").value.trim();

    const update = {
      payment_transfer_enabled: $("pdTransferEnabled").checked,
      payment_whatsapp_enabled: $("pdWhatsappPaymentEnabled").checked,

      payment_bank_name: $("pdBankName").value.trim(),
      payment_account_holder: $("pdAccountHolder").value.trim(),
      payment_account_number: $("pdAccountNumber").value.trim(),
      payment_clabe: $("pdClabe").value.trim(),

      payment_instructions: instructions,
      payment_security_notice:
        $("pdPaymentSecurityNotice").value.trim(),

      delivery_whatsapp_enabled:
        $("pdDeliveryWhatsappEnabled").checked,

      delivery_account_enabled:
        $("pdDeliveryAccountEnabled").checked,

      delivery_eta_min: min,
      delivery_eta_max: max,
      delivery_eta_unit: $("pdEtaUnit").value,
      delivery_eta_condition: $("pdEtaCondition").value.trim()
    };

    busy = true;

    const button = $("pdSaveBtn");
    button.disabled = true;

    setMessage("Guardando cambios…");

    try {

      const { error } = await supabase
        .from("store_settings")
        .update(update)
        .eq("id", 1);

      if (error) throw error;

      // Sincronizar el campo de instrucciones anterior.
      if ($("settingPayment")) {
        $("settingPayment").value = instructions;
      }

      setMessage(
        "¡Configuración guardada! Los mensajes de pago y entrega fueron actualizados.",
        true
      );

    } catch (error) {

      setMessage(
        "No se pudieron guardar los cambios: " +
        (error.message || "Error desconocido")
      );

    } finally {

      busy = false;
      button.disabled = false;

    }
  }


  function init() {

    injectPanel();

    if (!supabase || !$("paymentDeliveryForm")) return;

    $("paymentDeliveryForm").addEventListener(
      "submit",
      saveSettings
    );

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) return;

      loadSettings(data?.session).catch(err =>
        setMessage(err.message || "No se pudo cargar la configuración.")
      );
    });

    supabase.auth.onAuthStateChange((event, session) => {

      window.setTimeout(() => {

        loadSettings(session).catch(err =>
          setMessage(err.message || "No se pudo cargar la configuración.")
        );

      }, 0);

    });

  }

  init();

})();
