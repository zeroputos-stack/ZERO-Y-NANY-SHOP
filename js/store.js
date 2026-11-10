(() => {
  const $ = (id) => document.getElementById(id);
  const supabase = window.zeroSupabase;
  let products = [];
  let settings = {store_name:"ZERO Y NANY - SHOP",whatsapp_number:"526623459707",announcement:"Tu tienda digital, siempre disponible.",design:{}};
  let category = "Todas";
  let cart = JSON.parse(localStorage.getItem("zeroShopCloudCart") || "[]");

  const money = n => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(n||0));
  const safe = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = msg => { const t=$("toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2600); };
  const imageUrl = path => path ? supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl : "";
  const waLink = (text="Hola, quiero información de ZERO Y NANY - SHOP.") => `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(text)}`;

  function showConfigWarning() {
    $("storeStatus").hidden = false;
    $("storeStatus").textContent = "La tienda está lista, pero falta conectar Supabase. Abre config.js y agrega la Project URL y la Publishable key de tu proyecto.";
    $("productGrid").innerHTML = `<div class="empty-products">Configuración pendiente. Sigue los pasos de SETUP_RAPIDO.txt para conectar el catálogo en la nube.</div>`;
    $("heroProductCount").textContent = "—";
  }

  const defaultDesign = {
    theme:{accent:"#ff315d",background:"#090812",panel:"#151426",text:"#f8f7ff",font:"Inter"},
    content:{badge:"TIENDA DIGITAL · ZERO Y NANY - SHOP",hero_title:"Lo que buscas, en un solo lugar.",hero_subtitle:"Explora el catálogo, revisa la disponibilidad y envía tu pedido de forma sencilla. Tus compras quedan registradas para darles seguimiento.",hero_cta:"Explorar catálogo",hero_image_path:null},
    sections:{hero:true,catalogo:true,"como-comprar":true,contacto:true},
    order:["hero","catalogo","como-comprar","contacto"]
  };
  function applyStoreDesign(raw={}) {
    const d={...defaultDesign,...(raw||{})};
    d.theme={...defaultDesign.theme,...(d.theme||{})};
    d.content={...defaultDesign.content,...(d.content||{})};
    d.sections={...defaultDesign.sections,...(d.sections||{})};
    const root=document.documentElement;
    root.style.setProperty("--red",d.theme.accent);
    root.style.setProperty("--bg",d.theme.background);
    root.style.setProperty("--panel",d.theme.panel);
    root.style.setProperty("--panel2",d.theme.panel);
    root.style.setProperty("--text",d.theme.text);
    const font=d.theme.font==="system"?"system-ui, sans-serif":`\"${d.theme.font}\", system-ui, sans-serif`;
    root.style.setProperty("--store-font",font);
    document.body.style.fontFamily="var(--store-font)";
    const setText=(id,value)=>{const el=$(id);if(el && value!==undefined && value!==null)el.textContent=value;};
    const badge=$("heroBadge");if(badge){const dot=badge.querySelector("i")||document.createElement("i");badge.replaceChildren(dot,document.createTextNode(" "+d.content.badge));}
    setText("heroTitle",d.content.hero_title);
    setText("heroSubtitle",d.content.hero_subtitle);
    setText("heroCtaLabel",d.content.hero_cta);
    document.querySelectorAll("[data-store-name]").forEach(el=>el.textContent=settings.store_name||"ZERO Y NANY - SHOP");
    const heroImg=$("heroImage");
    if(heroImg && d.content.hero_image_path)heroImg.src=imageUrl(d.content.hero_image_path);
    const main=document.querySelector("main");
    const sections=[...document.querySelectorAll("[data-design-section]")];
    sections.forEach(el=>{const key=el.dataset.designSection;el.hidden=d.sections[key]===false;});
    if(main && Array.isArray(d.order)){
      d.order.forEach(key=>{const el=sections.find(x=>x.dataset.designSection===key);if(el)main.appendChild(el);});
    }
    const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=`${settings.store_name||"ZERO Y NANY - SHOP"}: tienda digital, catálogo y pedidos.`;
  }
  async function loadSettings() {
    const {data,error}=await supabase.from("store_settings").select("*").eq("id",1).maybeSingle();
    if(!error && data) settings=data;
    applyStoreDesign(settings.design||{});
    document.title = `${settings.store_name} | Tienda oficial`;
    $("heroWhatsapp").href=waLink();
    $("contactWhatsapp").href=waLink("Hola, necesito ayuda con mi pedido de ZERO Y NANY - SHOP.");
    $("year").textContent=new Date().getFullYear();
  }

  async function loadProducts() {
    const {data,error}=await supabase.from("products").select("*").eq("active",true).order("category").order("name");
    if(error){$("productGrid").innerHTML=`<div class="empty-products">No se pudo cargar el catálogo. ${safe(error.message)}</div>`;return;}
    products=data||[];
    const validIds=new Set(products.map(p=>p.id));
    cart=cart.filter(item=>validIds.has(item.product_id));
    saveCart();
    $("heroProductCount").textContent=products.length;
    renderFilters();
    renderProducts();
  }

  function renderFilters() {
    const cats=["Todas",...new Set(products.map(p=>p.category))];
    $("categoryFilters").innerHTML=cats.map(c=>`<button class="category-filter ${category===c?"active":""}" data-category="${safe(c)}">${safe(c)}</button>`).join("");
    $("categoryFilters").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{category=btn.dataset.category;renderFilters();renderProducts();}));
  }

  function renderProducts() {
    const query=$("searchInput").value.trim().toLowerCase();
    const filtered=products.filter(p=>(category==="Todas"||p.category===category) &&
      `${p.name} ${p.category} ${p.duration} ${p.modality} ${p.description}`.toLowerCase().includes(query));
    $("productGrid").innerHTML=filtered.map(p=>{
      const out=p.stock!==null && Number(p.stock)<=0;
      const stockText=out?"Agotado":p.stock===null?"Consultar disponibilidad":`${p.stock} disponibles`;
      const img=imageUrl(p.image_path);
      const variant=[p.duration && p.duration!=="—"?p.duration:"",p.modality||""].filter(Boolean).join(" · ");
      return `<article class="product-card">
        <div class="product-image">${img?`<img src="${safe(img)}" alt="${safe(p.name)}" loading="lazy">`:`<span class="product-fallback">✦</span>`}</div>
        <div class="product-meta"><span class="product-category">${safe(p.category)}</span><span class="stock-tag ${out?"out":p.stock===null?"unknown":""}">${stockText}</span></div>
        <h3>${safe(p.name)}</h3><div class="product-variant">${safe(variant || p.description || "Disponible en ZERO Y NANY - SHOP")}</div>
        <div class="product-price">${money(p.price)} <small>MXN</small></div>
        <button class="btn btn-primary" data-add="${p.id}" ${out?"disabled":""}>${out?"Agotado":"Agregar al carrito"}</button>
      </article>`;
    }).join("") || `<div class="empty-products">No encontramos productos con esa búsqueda.</div>`;
    $("productGrid").querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>addToCart(btn.dataset.add)));
  }

  function saveCart(){localStorage.setItem("zeroShopCloudCart",JSON.stringify(cart));renderCart();}
  function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  const existing = cart.find(x => x.product_id === id);
  const next = (existing?.quantity || 0) + 1;

  if (p.stock !== null && next > Number(p.stock)) {
    toast("No hay más existencias disponibles.");
    return;
  }

  if (existing) {
    existing.quantity = next;
  } else {
    cart.push({
      product_id: id,
      quantity: 1
    });
  }

  $("checkoutForm").hidden = false;
  $("checkoutResult").hidden = true;

  saveCart();
  toast("Producto agregado al carrito.");
}
    const p=products.find(x=>x.id===id); if(!p)return;
    const existing=cart.find(x=>x.product_id===id);
    const next=(existing?.quantity||0)+1;
    if(p.stock!==null && next>Number(p.stock)){toast("No hay más existencias disponibles.");return;}
    if(existing)existing.quantity=next;else cart.push({product_id:id,quantity:1});
    saveCart();toast("Producto agregado al carrito.");
  }
  function renderCart() {
    const count=cart.reduce((a,x)=>a+x.quantity,0);
    $("cartCount").textContent=count;
    const lines=cart.map(item=>{
      const p=products.find(x=>x.id===item.product_id);
      return p?{...item,product:p}:null;
    }).filter(Boolean);
    const total=lines.reduce((a,x)=>a+x.product.price*x.quantity,0);
    $("cartTotal").textContent=money(total);
    $("cartItems").innerHTML=lines.length?lines.map(x=>`<div class="cart-line">
      <div><strong>${safe(x.product.name)}</strong><small>${safe(x.product.category)} · ${safe(x.product.duration||"")} · ${safe(x.product.modality||"")}</small><small>${money(x.product.price)} c/u</small></div>
      <div class="cart-line-actions"><button data-minus="${x.product_id}" aria-label="Quitar uno">−</button><b>${x.quantity}</b><button data-plus="${x.product_id}" aria-label="Agregar uno">+</button><button data-remove="${x.product_id}" aria-label="Eliminar">×</button></div>
    </div>`).join(""):`<div class="empty-list">Tu carrito está vacío. Agrega algún producto del catálogo.</div>`;
    $("cartItems").querySelectorAll("[data-minus]").forEach(b=>b.addEventListener("click",()=>changeQty(b.dataset.minus,-1)));
    $("cartItems").querySelectorAll("[data-plus]").forEach(b=>b.addEventListener("click",()=>changeQty(b.dataset.plus,1)));
    $("cartItems").querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{cart=cart.filter(x=>x.product_id!==b.dataset.remove);saveCart();}));
  }
  function changeQty(id,delta) {
    const line=cart.find(x=>x.product_id===id),p=products.find(x=>x.id===id);if(!line||!p)return;
    const n=line.quantity+delta;
    if(n<=0)cart=cart.filter(x=>x.product_id!==id);
    else if(p.stock!==null&&n>p.stock){toast("No hay más existencias disponibles.");return;}
    else line.quantity=n;
    saveCart();
  }
  function openCart(open=true){$("cartDrawer").classList.toggle("open",open);$("cartBackdrop").classList.toggle("open",open);document.body.style.overflow=open?"hidden":"";}
  async function placeOrder(e) {
    e.preventDefault();
    if(!cart.length){toast("Agrega productos antes de enviar tu pedido.");return;}
    const btn=$("placeOrderBtn");btn.disabled=true;btn.textContent="Registrando pedido…";
    const payload={
      p_customer_name:$("customerName").value.trim(),
      p_whatsapp:$("customerWhatsapp").value.trim(),
      p_notes:$("customerNotes").value.trim(),
      p_items:cart.map(x=>({product_id:x.product_id,quantity:x.quantity}))
    };
    const {data,error}=await supabase.rpc("create_zero_shop_order",payload);
    btn.disabled=false;btn.textContent="Enviar pedido";
    if(error){toast(error.message);return;}
    cart=[];saveCart();
    $("checkoutForm").hidden=true;
    const wa=waLink(`Hola, realicé el pedido ${data.order_number} en ZERO Y NANY - SHOP por ${money(data.total)}. Mi nombre es ${$("customerName").value.trim()}. ¿Me ayudan a confirmar el pago y entrega?`);
    $("checkoutResult").hidden=false;
    $("checkoutResult").innerHTML=`<strong>Pedido ${safe(data.order_number)}</strong>Tu pedido quedó registrado por ${money(data.total)}.<br><br><b>Instrucciones:</b> ${safe(settings.payment_instructions||"Confirma el método de pago por WhatsApp.")}<br><br><a class="btn btn-primary btn-block" href="${wa}" target="_blank" rel="noopener">Continuar por WhatsApp ↗</a>`;
    toast("Pedido registrado correctamente.");
  }

  function initCart() {
    $("openCartBtn").addEventListener("click",()=>openCart(true));
    $("closeCartBtn").addEventListener("click",()=>openCart(false));
    $("cartBackdrop").addEventListener("click",()=>openCart(false));
    $("checkoutForm").addEventListener("submit",placeOrder);
    $("searchInput").addEventListener("input",renderProducts);
    $("mobileMenuBtn").addEventListener("click",()=>$("mobileNav").classList.toggle("open"));
    renderCart();
  }

  async function start() {
    $("year").textContent=new Date().getFullYear();
    initCart();
    if(!window.zeroSupabaseReady){showConfigWarning();return;}
    await loadSettings();
    await loadProducts();
    supabase.channel("zero-shop-public-products").on("postgres_changes",
      {event:"*",schema:"public",table:"products"},()=>loadProducts()).subscribe();
  }
  start();
})();
