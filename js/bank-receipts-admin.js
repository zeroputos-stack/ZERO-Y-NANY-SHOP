
(() => {
  const db = window.zeroSupabase;

  const esc = s => String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

  async function start() {
    const form = document.getElementById('settingsForm');

    if (!form || !db) return;

    const panel = document.createElement('section');
    panel.className = 'panel-card';
    panel.style.cssText = 'margin-top:20px;padding:22px';

    panel.innerHTML = `
      <h3>Cuentas bancarias para transferencias</h3>
      <p>
        Agrega varias cuentas. Los clientes podrán
        elegir una al comprar.
      </p>
      <div id="bankRows"></div>
      <button type="button" id="addBank" class="btn">
        + Agregar cuenta
      </button>
      <button
        type="button"
        id="saveBanks"
        class="btn btn-primary"
      >
        Guardar cuentas
      </button>
      <p id="bankStatus"></p>
    `;

    form.insertAdjacentElement('afterend', panel);

    let banks = [];

    function render() {
      document.getElementById('bankRows').innerHTML =
        banks.map((b, i) => `
          <div style="
            padding:12px;
            border:1px solid #7775;
            border-radius:12px;
            margin:10px 0;
            display:grid;
            gap:7px
          ">
            <label>
              Banco
              <input
                data-bank="${i}"
                data-field="bank"
                value="${esc(b.bank)}"
                placeholder="Banco"
              >
            </label>

            <label>
              Titular
              <input
                data-bank="${i}"
                data-field="holder"
                value="${esc(b.holder)}"
              >
            </label>

            <label>
              Número de cuenta
              <input
                data-bank="${i}"
                data-field="account"
                value="${esc(b.account)}"
              >
            </label>

            <label>
              CLABE
              <input
                data-bank="${i}"
                data-field="clabe"
                value="${esc(b.clabe)}"
                maxlength="18"
              >
            </label>

            <button type="button" data-remove="${i}">
              Eliminar cuenta
            </button>
          </div>
        `).join('');

      document.querySelectorAll('[data-bank]')
        .forEach(el => el.addEventListener('input', () => {
          banks[+el.dataset.bank][el.dataset.field] =
            el.value;
        }));

      document.querySelectorAll('[data-remove]')
        .forEach(el => el.addEventListener('click', () => {
          banks.splice(+el.dataset.remove, 1);
          render();
        }));
    }

    document.getElementById('addBank').onclick = () => {
      banks.push({
        bank: '',
        holder: '',
        account: '',
        clabe: ''
      });
      render();
    };

    document.getElementById('saveBanks').onclick =
      async () => {
        const msg = document.getElementById('bankStatus');

        try {
          const { data: { user } } =
            await db.auth.getUser();

          if (!user) {
            throw Error('Inicia sesión como administrador');
          }

          if (banks.some(b =>
            !b.bank.trim() ||
            !b.holder.trim() ||
            (!b.account.trim() && !b.clabe.trim())
          )) {
            throw Error(
              'Completa banco, titular y cuenta o CLABE'
            );
          }

          const { error } = await db
            .from('store_settings')
            .update({
              payment_bank_accounts: banks
            })
            .eq('id', 1);

          if (error) throw error;

          msg.textContent =
            'Cuentas guardadas correctamente.';

        } catch (e) {
          msg.textContent = e.message;
        }
      };

    const { data, error } = await db
      .from('store_settings')
      .select('payment_bank_accounts')
      .eq('id', 1)
      .single();

    if (
      !error &&
      Array.isArray(data?.payment_bank_accounts)
    ) {
      banks = data.payment_bank_accounts;
    }

    render();

    // Mostrar comprobantes en los pedidos del administrador.
    const orders = document.getElementById('ordersList');

    if (!orders) return;

    let loading = false;

    async function addLinks() {
      if (loading) return;

      const cards = [
        ...orders.querySelectorAll('.order-card')
      ].filter(c => !c.dataset.receiptChecked);

      if (!cards.length) return;

      loading = true;

      try {
        for (const card of cards) {
          card.dataset.receiptChecked = '1';

          const id = card.querySelector(
            '[data-payment-status]'
          )?.dataset.paymentStatus;

          if (!id) continue;

          const { data } = await db
            .from('orders')
            .select(
              'payment_receipt_path,payment_bank_label'
            )
            .eq('id', id)
            .single();

          if (!data?.payment_receipt_path) continue;

          const { data: link, error } =
            await db.storage
              .from('payment-receipts')
              .createSignedUrl(
                data.payment_receipt_path,
                300
              );

          if (error) continue;

          const a = document.createElement('a');

          a.href = link.signedUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';

          a.textContent =
            'Ver comprobante de transferencia' +
            (data.payment_bank_label
              ? ' · ' + data.payment_bank_label
              : '');

          a.style.cssText = `
            display:block;
            padding:12px;
            color:#a6ffd5;
            font-weight:bold
          `;

          card.appendChild(a);
        }
      } finally {
        loading = false;
      }
    }

    const obs = new MutationObserver(() => {
      setTimeout(addLinks, 100);
    });

    obs.observe(orders, {
      childList: true
    });

    addLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
