(() => {
  const $=id=>document.getElementById(id);
  const supabase=window.zeroSupabase;
  let products=[],orders=[],settings=null,selected=new Set(),editingImagePath=null,originalImagePath=null,pendingImage=null,designerImageFile=null,designerImagePath=null,designerDesign=null,currentUserRole=null,currentUserId=null,teamMembers=[],designerObjectUrl=null,designerDirty=false;
  const money=n=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(n||0));
  const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const statusNames={new:"Nuevo",confirmed:"Confirmado",preparing:"En preparación",completed:"Completado",cancelled:"Cancelado"};
  const paymentNames={pending:"Pendiente",paid:"Pagado",refunded:"Reembolsado"};
  function toast(msg){const t=$("adminToast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800);}
  function message(id,msg,ok=false){const el=$(id);el.textContent=msg;el.className="form-message"+(ok?" ok":"");}
  function showTab(tab){if(currentUserRole==="editor"&&!['products','designer'].includes(tab))tab="products";document.querySelectorAll(".admin-tab").forEach(x=>x.classList.toggle("active",x.id==="tab-"+tab));document.querySelectorAll(".admin-nav[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab===tab));if(tab==="designer")renderDesignerForm();if(tab==="team"&&currentUserRole==="admin")loadTeamMembers();}
  function imageUrl(path){return path?supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl:"";}
  function setLoginMessage(msg){$("loginMessage").textContent=msg;}

  async function checkStaff(user){
    const {data,error}=await supabase.from("profiles").select("role").eq("user_id",user.id).maybeSingle();
    if(error||!["admin","editor"].includes(data?.role)){await supabase.auth.signOut();throw new Error("Esta cuenta no tiene permisos de acceso al panel.");}
    return data.role;
  }
  async function enterApp(user){
    currentUserId=user?.id||null;
    try{currentUserRole=await checkStaff(user);}catch(e){setLoginMessage(e.message);return;}
    const isAdmin=currentUserRole==="admin";
    $("loginPanel").hidden=true;$("adminApp").hidden=false;$("adminEmailLabel").textContent=(user.email||"Usuario")+` · ${isAdmin?"ADMINISTRADOR":"EDITOR"}`;
    ["dashboard","orders","settings","team"].forEach(tab=>{const nav=document.querySelector(`.admin-nav[data-tab="${tab}"]`);if(nav)nav.hidden=!isAdmin;});
    await Promise.all([loadProducts(),loadSettings(),...(isAdmin?[loadOrders()]:[])]);
    if(isAdmin)showTab("dashboard");else showTab("products");
    startRealtime();
  }
  async function loadProducts(){
    const {data,error}=await supabase.from("products").select("*").order("category").order("name");
    if(error){toast(error.message);return;}
    products=data||[];renderProducts();renderMetrics();
  }
  function renderProducts(){
    const q=$("productSearch").value.trim().toLowerCase();
    const filtered=products.filter(p=>`${p.name} ${p.category} ${p.duration} ${p.modality}`.toLowerCase().includes(q));
    $("productCountLabel").textContent=`${products.length} productos registrados`;
    $("adminProductList").innerHTML=filtered.map(p=>{
      const img=imageUrl(p.image_path);
      return `<article class="admin-product">
        <input type="checkbox" data-select="${p.id}" ${selected.has(p.id)?"checked":""} aria-label="Seleccionar producto">
        ${img?`<img src="${safe(img)}" alt="">`:`<div class="product-image">✦</div>`}
        <div class="admin-product-info"><strong>${safe(p.name)} · ${safe(p.modality||"")}</strong><small>${safe(p.category)} · ${safe(p.duration||"")} · ${money(p.price)} · Stock: ${p.stock===null?"Por confirmar":p.stock}</small></div>
        <div class="admin-product-actions"><button class="btn btn-soft" data-edit="${p.id}">Editar</button><button class="btn btn-danger" data-delete="${p.id}">Eliminar</button></div>
      </article>`;
    }).join("")||`<div class="empty-list">No hay productos que coincidan con la búsqueda.</div>`;
    $("selectedCount").textContent=`${selected.size} seleccionados`;
    $("deleteSelectedBtn").disabled=selected.size===0;
    $("adminProductList").querySelectorAll("[data-select]").forEach(el=>el.addEventListener("change",()=>{el.checked?selected.add(el.dataset.select):selected.delete(el.dataset.select);renderProducts();}));
    $("adminProductList").querySelectorAll("[data-edit]").forEach(el=>el.addEventListener("click",()=>editProduct(el.dataset.edit)));
    $("adminProductList").querySelectorAll("[data-delete]").forEach(el=>el.addEventListener("click",()=>deleteProducts([el.dataset.delete])));
  }
  function renderMetrics(){
    $("metricProducts").textContent=products.filter(p=>p.active).length;
    const newOrders=orders.filter(o=>o.status==="new").length;
    $("metricOrders").textContent=newOrders;
    $("metricPayments").textContent=orders.filter(o=>o.payment_status==="pending").length;
    const sales=orders.filter(o=>o.payment_status==="paid").reduce((a,o)=>a+Number(o.total),0);
    $("metricSales").textContent=money(sales);
    $("pendingOrderBadge").textContent=newOrders;
    $("recentOrders").innerHTML=orders.slice(0,5).map(o=>`<div class="recent-order"><div><b>${safe(o.order_number)} · ${safe(o.customer_name)}</b><small>${new Date(o.created_at).toLocaleString("es-MX")} · ${statusNames[o.status]}</small></div><strong>${money(o.total)}</strong></div>`).join("")||`<div class="empty-list">Todavía no hay pedidos.</div>`;
  }
  async function loadOrders(){
    const {data,error}=await supabase.from("orders").select("*, order_items(*)").order("created_at",{ascending:false}).limit(100);
    if(error){toast(error.message);return;}
    orders=data||[];renderOrders();renderMetrics();
  }
  function renderOrders(){
    const statusFilter=$("orderStatusFilter").value,paymentFilter=$("paymentFilter").value;
    const filtered=orders.filter(o=>(!statusFilter||o.status===statusFilter)&&(!paymentFilter||o.payment_status===paymentFilter));
    $("ordersList").innerHTML=filtered.map(o=>{
      const items=(o.order_items||[]).map(i=>`${i.quantity} × ${safe(i.product_name)} ${i.product_variant?`(${safe(i.product_variant)})`:""} — ${money(i.line_total)}`).join("<br>");
      const wa=`https://wa.me/${String(o.whatsapp).replace(/\D/g,"")}?text=${encodeURIComponent("Hola "+o.customer_name+", te contactamos de ZERO Y NANY - SHOP por tu pedido "+o.order_number+".")}`;
      return `<article class="order-card">
        <div class="order-card-head"><div><strong>${safe(o.order_number)} · ${safe(o.customer_name)}</strong><small>${new Date(o.created_at).toLocaleString("es-MX")} · WhatsApp: ${safe(o.whatsapp)}</small></div><div class="order-total">${money(o.total)}</div></div>
        <div class="order-details">${items||"Sin artículos"}${o.notes?`<br><br><b>Notas:</b> ${safe(o.notes)}`:""}</div>
        <div class="order-controls">
          <label>Pedido <select data-order-status="${o.id}">${Object.entries(statusNames).map(([k,v])=>`<option value="${k}" ${o.status===k?"selected":""}>${v}</option>`).join("")}</select></label>
          <label>Pago <select data-payment-status="${o.id}">${Object.entries(paymentNames).map(([k,v])=>`<option value="${k}" ${o.payment_status===k?"selected":""}>${v}</option>`).join("")}</select></label>
          <a href="${wa}" target="_blank" rel="noopener">Abrir WhatsApp ↗</a>
        </div>
      </article>`;
    }).join("")||`<div class="empty-list">No hay pedidos con esos filtros.</div>`;
    $("ordersList").querySelectorAll("[data-order-status]").forEach(el=>el.addEventListener("change",()=>updateOrder(el.dataset.orderStatus,{status:el.value})));
    $("ordersList").querySelectorAll("[data-payment-status]").forEach(el=>el.addEventListener("change",()=>updateOrder(el.dataset.paymentStatus,{payment_status:el.value})));
  }
  async function updateOrder(id,changes){
    const {error}=await supabase.rpc("update_zero_shop_order",{
      p_order_id:id,
      p_status:changes.status??null,
      p_payment_status:changes.payment_status??null
    });
    if(error){toast(error.message);await loadOrders();return;}
    toast(changes.status==="cancelled"?"Pedido cancelado y stock devuelto.":"Pedido actualizado.");
    await Promise.all([loadOrders(),loadProducts()]);
  }
  async function loadSettings(){
    const {data,error}=await supabase.from("store_settings").select("*").eq("id",1).single();
    if(error){toast(error.message);return;}settings=data;
    $("settingStoreName").value=data.store_name;$("settingWhatsapp").value=data.whatsapp_number;
    $("settingPayment").value=data.payment_instructions;$("settingAnnouncement").value=data.announcement;
    designerDesign=normalizeDesign(data.design||{});renderDesignerForm();
  }
  async function saveSettings(e){
    e.preventDefault();
    const update={store_name:$("settingStoreName").value.trim(),whatsapp_number:$("settingWhatsapp").value.replace(/\D/g,""),
      payment_instructions:$("settingPayment").value.trim(),announcement:$("settingAnnouncement").value.trim()};
    const {error}=await supabase.from("store_settings").update(update).eq("id",1);
    if(error){message("settingsMessage",error.message);return;}message("settingsMessage","Configuración guardada.",true);toast("Ajustes actualizados.");
  }
  const defaultDesign={theme:{accent:"#ff315d",background:"#090812",panel:"#151426",text:"#f8f7ff",font:"Inter"},content:{badge:"TIENDA DIGITAL · ZERO Y NANY - SHOP",hero_title:"Lo que buscas, en un solo lugar.",hero_subtitle:"Explora el catálogo, revisa la disponibilidad y envía tu pedido de forma sencilla. Tus compras quedan registradas para darles seguimiento.",hero_cta:"Explorar catálogo",hero_image_path:null},sections:{hero:true,catalogo:true,"como-comprar":true,contacto:true},order:["hero","catalogo","como-comprar","contacto"]};
  const sectionLabels={hero:"Portada principal",catalogo:"Catálogo", "como-comprar":"Cómo comprar",contacto:"Contacto"};
  function normalizeDesign(raw={}){return {theme:{...defaultDesign.theme,...(raw.theme||{})},content:{...defaultDesign.content,...(raw.content||{})},sections:{...defaultDesign.sections,...(raw.sections||{})},order:Array.isArray(raw.order)?[...raw.order]:[...defaultDesign.order]};}
  function collectDesignerForm(){
    const d=normalizeDesign(designerDesign||{});
    d.theme={accent:$("designAccent").value,background:$("designBackground").value,panel:$("designPanel").value,text:$("designText").value,font:$("designFont").value};
    d.content={...d.content,badge:$("designBadge").value.trim(),hero_title:$("designHeroTitle").value.trim(),hero_subtitle:$("designHeroSubtitle").value.trim(),hero_cta:$("designHeroCta").value.trim(),hero_image_path:designerImagePath||d.content.hero_image_path};
    d.sections={};d.order=[];
    document.querySelectorAll("#designerSectionList .designer-section-row").forEach(row=>{const key=row.dataset.section;d.order.push(key);d.sections[key]=row.querySelector('input[type="checkbox"]').checked;});
    return d;
  }
  function renderDesignerForm(){
    if(!designerDesign)designerDesign=normalizeDesign(settings?.design||{});
    const d=normalizeDesign(designerDesign);
    const values={designBadge:d.content.badge,designHeroTitle:d.content.hero_title,designHeroSubtitle:d.content.hero_subtitle,designHeroCta:d.content.hero_cta,designAccent:d.theme.accent,designBackground:d.theme.background,designPanel:d.theme.panel,designText:d.theme.text,designFont:d.theme.font};
    Object.entries(values).forEach(([id,v])=>{const el=$(id);if(el && document.activeElement!==el)el.value=v;});
    designerImagePath=d.content.hero_image_path||null;
    designerDirty=false;
    const preview=$("designImagePreview");if(preview)preview.textContent=designerImagePath?"Imagen principal guardada en la nube":"Se conserva la imagen principal predeterminada";
    renderSectionRows(d);updateDesignerPreview();
  }
  function renderSectionRows(d){
    const list=$("designerSectionList");if(!list)return;
    const keys=[...new Set([...(d.order||[]),...defaultDesign.order])];
    list.innerHTML=keys.map(key=>`<div class="designer-section-row" draggable="true" data-section="${key}"><span class="drag-grip" aria-label="Arrastrar">⠿</span><b>${sectionLabels[key]||key}</b><label><input type="checkbox" ${d.sections[key]!==false?"checked":""}> Visible</label><button type="button" class="btn btn-soft btn-sm" data-move="up" aria-label="Subir">↑</button><button type="button" class="btn btn-soft btn-sm" data-move="down" aria-label="Bajar">↓</button></div>`).join("");
  }
  function updateDesignerPreview(){
    const d=collectDesignerFormSafe();
    $("previewBrandName").textContent=settings?.store_name||"ZERO Y NANY - SHOP";
    $("previewBadge").textContent=d.content.badge;
    $("previewHeroTitle").textContent=d.content.hero_title;
    $("previewHeroSubtitle").textContent=d.content.hero_subtitle;
    $("previewHeroCta").textContent=d.content.hero_cta+" ↗";
    const box=$("designerLivePreview");box.style.setProperty("--preview-accent",d.theme.accent);box.style.setProperty("--preview-bg",d.theme.background);box.style.setProperty("--preview-panel",d.theme.panel);box.style.setProperty("--preview-text",d.theme.text);box.style.fontFamily=d.theme.font==="system"?"system-ui":d.theme.font;
    const image=$("previewHeroImage");
    const imageSrc=designerObjectUrl||(d.content.hero_image_path?imageUrl(d.content.hero_image_path):"");
    if(image){if(imageSrc){image.src=imageSrc;image.hidden=false;}else{image.removeAttribute("src");image.hidden=true;}}
    const state=$("designerSaveState");if(state){state.textContent=designerDirty?"● CAMBIOS SIN GUARDAR":"● DISEÑO GUARDADO";state.classList.toggle("is-dirty",designerDirty);}
  }
  function collectDesignerFormSafe(){
    const d=normalizeDesign(designerDesign||{});
    ["designAccent","designBackground","designPanel","designText","designFont","designBadge","designHeroTitle","designHeroSubtitle","designHeroCta"].forEach(id=>{if(!$(id))return;});
    if($("designAccent"))d.theme={accent:$("designAccent").value,background:$("designBackground").value,panel:$("designPanel").value,text:$("designText").value,font:$("designFont").value};
    if($("designBadge"))d.content={...d.content,badge:$("designBadge").value,hero_title:$("designHeroTitle").value,hero_subtitle:$("designHeroSubtitle").value,hero_cta:$("designHeroCta").value,hero_image_path:designerImagePath||d.content.hero_image_path};
    return d;
  }
  function switchDesignerMode(mode){document.querySelectorAll("[data-designer-mode]").forEach(b=>b.classList.toggle("active",b.dataset.designerMode===mode));$("designerVisualMode").classList.toggle("active",mode==="visual");$("designerLayoutMode").classList.toggle("active",mode==="layout");$("designerLayoutMode").hidden=mode!=="layout";}
  async function saveDesignerDesign(e){if(e)e.preventDefault();const btn=$("saveDesignBtn");btn.disabled=true;message("designerMessage","Guardando diseño…");
    try{
      let d=collectDesignerForm();
      if(designerImageFile){const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp"})[designerImageFile.type]||"img";const path=`store-design/hero-${Date.now()}.${ext}`;const {error:uploadError}=await supabase.storage.from("product-images").upload(path,designerImageFile,{upsert:false,contentType:designerImageFile.type,cacheControl:"3600"});if(uploadError)throw uploadError;d.content.hero_image_path=path;designerImagePath=path;designerImageFile=null;$("designImagePreview").textContent="Imagen subida y guardada en la nube.";}
      const {error}=await supabase.rpc("save_zero_shop_design",{p_design:d});if(error)throw error;designerDesign=d;settings={...settings,design:d};designerDirty=false;message("designerMessage","Diseño guardado. Ya puedes verlo en la tienda pública.",true);toast("Diseño de tienda actualizado.");updateDesignerPreview();
    }catch(err){message("designerMessage",err.message||"No se pudo guardar el diseño.");}finally{btn.disabled=false;}
  }
  async function saveDesignerLayout(){const d=collectDesignerForm();const {error}=await supabase.rpc("save_zero_shop_design",{p_design:d});if(error){message("layoutMessage",error.message);return;}designerDesign=d;settings={...settings,design:d};designerDirty=false;message("layoutMessage","Distribución guardada correctamente.",true);toast("Distribución actualizada.");updateDesignerPreview();}
  function moveSection(row,direction){const list=$("designerSectionList");const sibling=direction==="up"?row.previousElementSibling:row.nextElementSibling;if(!sibling)return;if(direction==="up")list.insertBefore(row,sibling);else list.insertBefore(sibling,row);}
  function bindDesigner(){
    $("designerForm").addEventListener("input",()=>{designerDirty=true;updateDesignerPreview();});
    $("designerForm").addEventListener("submit",saveDesignerDesign);
    $("resetDesignBtn").addEventListener("click",()=>{if(!confirm("¿Restaurar los colores y textos originales del diseñador? Después tendrás que guardar los cambios."))return;designerDesign=normalizeDesign({});designerImagePath=null;designerImageFile=null;if(designerObjectUrl){URL.revokeObjectURL(designerObjectUrl);designerObjectUrl=null;}designerDirty=true;renderDesignerForm();designerDirty=true;updateDesignerPreview();});
    $("designHeroImage").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;if(!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>5*1024*1024){toast("Elige JPG, PNG o WEBP de máximo 5 MB.");e.target.value="";return;}designerImageFile=f;if(designerObjectUrl)URL.revokeObjectURL(designerObjectUrl);designerObjectUrl=URL.createObjectURL(f);designerDirty=true;$("designImagePreview").textContent=`Imagen seleccionada: ${f.name} (se subirá al guardar)`;updateDesignerPreview();});
    document.querySelectorAll("[data-designer-mode]").forEach(b=>b.addEventListener("click",()=>switchDesignerMode(b.dataset.designerMode)));
    $("designerSectionList").addEventListener("click",e=>{const b=e.target.closest("[data-move]");if(b){moveSection(b.closest(".designer-section-row"),b.dataset.move);designerDirty=true;updateDesignerPreview();}});
    $("designerSectionList").addEventListener("change",e=>{if(e.target.matches('input[type="checkbox"]')){designerDirty=true;updateDesignerPreview();}});
    let dragged=null;$("designerSectionList").addEventListener("dragstart",e=>{dragged=e.target.closest(".designer-section-row");if(dragged)e.dataTransfer.effectAllowed="move";});
    $("designerSectionList").addEventListener("dragover",e=>{e.preventDefault();const target=e.target.closest(".designer-section-row");if(target&&dragged&&target!==dragged){const r=target.getBoundingClientRect();const after=e.clientY>r.top+r.height/2;target.parentNode.insertBefore(dragged,after?target.nextSibling:target);designerDirty=true;updateDesignerPreview();}});
    $("designerSectionList").addEventListener("drop",e=>{e.preventDefault();dragged=null;});
    $("saveLayoutBtn").addEventListener("click",saveDesignerLayout);
  }
  function clearForm(){
    $("productForm").reset();$("productId").value="";$("productActive").checked=true;
    editingImagePath=null;originalImagePath=null;pendingImage=null;$("productImage").value="";
    $("imagePreview").innerHTML="<span>▧</span><b>Vista previa</b><small>JPG, PNG, WEBP o GIF · máximo 5 MB</small>";
    $("removeImageBtn").hidden=true;$("productFormTitle").textContent="Agregar producto";
  }
  function previewFile(file){
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)){message("productMessage","Formato no compatible. Usa JPG, PNG, WEBP o GIF.");return;}
    if(file.size>5*1024*1024){message("productMessage","La imagen supera 5 MB.");return;}
    pendingImage=file;
    const reader=new FileReader();reader.onload=()=>{$("imagePreview").innerHTML=`<img src="${reader.result}" alt="Vista previa"><b>Imagen seleccionada</b><small>Se subirá a la nube al guardar.</small>`;$("removeImageBtn").hidden=false;};reader.readAsDataURL(file);
  }
  function editProduct(id){
    const p=products.find(x=>x.id===id);if(!p)return;
    showTab("products");$("productId").value=p.id;$("productCategory").value=p.category;$("productName").value=p.name;
    $("productDuration").value=p.duration||"";$("productModality").value=p.modality||"";$("productDescription").value=p.description||"";
    $("productPrice").value=p.price;$("productStock").value=p.stock??"";$("productActive").checked=!!p.active;
    editingImagePath=p.image_path;originalImagePath=p.image_path;pendingImage=null;$("productImage").value="";
    if(editingImagePath){$("imagePreview").innerHTML=`<img src="${safe(imageUrl(editingImagePath))}" alt="Imagen actual"><b>Imagen actual</b>`;$("removeImageBtn").hidden=false;}
    else{$("imagePreview").innerHTML="<span>▧</span><b>Sin imagen</b><small>Agrega una foto o sticker.</small>";$("removeImageBtn").hidden=true;}
    $("productFormTitle").textContent="Editar producto";
    $("productForm").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function uploadImage(productId){
    if(!pendingImage)return editingImagePath;
    const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif" })[pendingImage.type]||"img";
    const path=`${productId}/${Date.now()}.${ext}`;
    const {error}=await supabase.storage.from("product-images").upload(path,pendingImage,{upsert:false,contentType:pendingImage.type,cacheControl:"3600"});
    if(error)throw error;
    return path;
  }
  async function saveProduct(e){
    e.preventDefault();$("saveProductBtn").disabled=true;message("productMessage","Guardando producto…");
    const id=$("productId").value||crypto.randomUUID();
    let newPath=editingImagePath;
    let uploadedPath=null;
    try{
      if(pendingImage){newPath=await uploadImage(id);uploadedPath=newPath;}
      const row={id,category:$("productCategory").value.trim(),name:$("productName").value.trim(),
        duration:$("productDuration").value.trim()||"—",modality:$("productModality").value.trim(),
        description:$("productDescription").value.trim(),price:Number($("productPrice").value),
        stock:$("productStock").value===""?null:Number($("productStock").value),
        active:$("productActive").checked,image_path:newPath};
      const {error}=await supabase.from("products").upsert(row);
      if(error)throw error;
      if(originalImagePath&&newPath!==originalImagePath)await supabase.storage.from("product-images").remove([originalImagePath]);
      message("productMessage","Producto guardado correctamente.",true);toast("Producto guardado.");clearForm();await loadProducts();
    }catch(err){
      if(uploadedPath)await supabase.storage.from("product-images").remove([uploadedPath]);
      message("productMessage",err.message||"No se pudo guardar el producto.");
    }
    finally{$("saveProductBtn").disabled=false;}
  }
  async function deleteProducts(ids){
    if(!ids.length)return;
    if(!confirm(`¿Eliminar ${ids.length} producto(s) del catálogo? Los pedidos anteriores conservarán el nombre y el precio registrados.`))return;
    const old=products.filter(p=>ids.includes(p.id));
    const {error}=await supabase.from("products").delete().in("id",ids);
    if(error){toast(error.message);return;}
    const paths=old.map(p=>p.image_path).filter(Boolean);
    if(paths.length)await supabase.storage.from("product-images").remove(paths);
    ids.forEach(id=>selected.delete(id));toast("Productos eliminados.");await loadProducts();
  }
  function exportCsv(){
    const cols=["category","name","duration","modality","description","price","stock","active"];
    const lines=[cols.join(","),...products.map(p=>cols.map(k=>`"${String(p[k]??"").replace(/"/g,'""')}"`).join(","))];
    const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="zero-shop-catalogo.csv";a.click();URL.revokeObjectURL(a.href);
  }
  function parseCsv(text){
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
      else if(c===","&&!quoted){row.push(field);field="";}
      else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);field="";if(row.some(x=>x.trim()))rows.push(row);row=[];}
      else field+=c;}
    row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
  }
  async function importCsvFile(file){
    const text=await file.text(),rows=parseCsv(text);if(rows.length<2)throw new Error("El CSV no contiene productos.");
    const headers=rows.shift().map(x=>x.replace(/^\uFEFF/,"").trim().toLowerCase());
    const required=["category","name","price"];if(required.some(k=>!headers.includes(k)))throw new Error("El CSV necesita columnas category, name y price.");
    const get=(r,k)=>{const i=headers.indexOf(k);return i<0?"":String(r[i]??"").trim();};
    const payload=rows.map(r=>({category:get(r,"category"),name:get(r,"name"),duration:get(r,"duration")||"—",modality:get(r,"modality"),description:get(r,"description"),
      price:Number(get(r,"price").replace(/[$\s]/g,"")),stock:get(r,"stock")===""?null:Number(get(r,"stock")),active:!["false","0","no"].includes(get(r,"active").toLowerCase())}))
      .filter(p=>p.category&&p.name&&Number.isFinite(p.price)&&p.price>=0);
    if(!payload.length)throw new Error("No se encontraron filas válidas.");
    const {error}=await supabase.from("products").upsert(payload,{onConflict:"category,name,duration,modality"});
    if(error)throw error;await loadProducts();toast(`${payload.length} productos importados o actualizados.`);
  }
  async function callTeamFunction(payload){
    // Esta tienda usa la Edge Function publicada en Supabase como "dynamic-service".
    const {data,error}=await supabase.functions.invoke("dynamic-service",{body:payload});
    if(error){
      let detail=error.message||"No se pudo completar la operación.";
      try{const context=error.context;if(context&&typeof context.json==="function"){const body=await context.json();if(body?.error)detail=body.error;}}catch{}
      throw new Error(detail);
    }
    if(data?.error)throw new Error(data.error);
    return data;
  }
  async function loadTeamMembers(){
    if(currentUserRole!=="admin")return;
    const list=$("teamMembersList");if(list)list.innerHTML='<div class="empty-list">Cargando usuarios…</div>';
    try{
      const data=await callTeamFunction({action:"list"});
      // dynamic-service devuelve { users: [{ id, email, role, confirmed }] }.
      teamMembers=(data.users||[])
        .filter(user=>["admin","editor"].includes(user.role))
        .map(user=>({
          user_id:user.id,
          email:user.email||"Correo no disponible",
          role:user.role,
          confirmed:!!user.confirmed,
          is_current_user:user.id===currentUserId
        }));
      renderTeamMembers();
    }catch(err){
      if(list)list.innerHTML=`<div class="empty-list">${safe(err.message)}. Comprueba que la función dynamic-service esté publicada.</div>`;
    }
  }
  function renderTeamMembers(){
    const list=$("teamMembersList");if(!list)return;
    const admins=teamMembers.filter(member=>member.role==="admin").length;
    const editors=teamMembers.filter(member=>member.role==="editor").length;
    if($("teamAdminCount"))$("teamAdminCount").textContent=admins;
    if($("teamEditorCount"))$("teamEditorCount").textContent=editors;
    if($("teamTotalCount"))$("teamTotalCount").textContent=teamMembers.length;
    const query=($("teamSearch")?.value||"").trim().toLowerCase();
    const visibleMembers=teamMembers.filter(member=>(member.email||"").toLowerCase().includes(query));
    list.innerHTML=visibleMembers.map(member=>{
      const isSelf=!!member.is_current_user;
      const roleLabel=member.role==="admin"?"Administrador":"Editor";
      const accountState=member.confirmed?"Correo confirmado":"Invitación pendiente";
      return `<article class="team-member"><div class="team-member-main"><strong>${safe(member.email)}</strong><span class="team-role-pill ${member.role==="admin"?"admin":""}">${roleLabel}</span>${isSelf?'<span class="team-self-label">✓ Tu cuenta actual</span>':""}<small>${accountState}</small></div><div class="team-member-actions"><select data-team-role="${safe(member.user_id)}" aria-label="Rol de ${safe(member.email)}"><option value="editor" ${member.role==="editor"?"selected":""}>Editor</option><option value="admin" ${member.role==="admin"?"selected":""}>Administrador</option></select><button type="button" class="btn btn-soft btn-sm" data-team-save="${safe(member.user_id)}" ${isSelf?"disabled":""}>Guardar rol</button><button type="button" class="btn btn-danger btn-sm" data-team-remove="${safe(member.user_id)}" ${isSelf?"disabled":""}>Quitar</button></div></article>`;
    }).join("")||(query?'<div class="empty-list">No encontramos integrantes con ese correo.</div>':'<div class="empty-list">Todavía no hay administradores ni editores registrados.</div>');
  }
  function updateInviteRolePreview(){
    const role=$("teamInviteRole")?.value||"editor";
    const box=$("roleChoicePreview");if(!box)return;
    const isAdmin=role==="admin";
    box.innerHTML=`<span class="team-role-pill ${isAdmin?"admin":""}">${isAdmin?"ADMINISTRADOR":"EDITOR"}</span><p>${isAdmin?"Tendrá control total de pedidos, configuración, catálogo, diseño y gestión del equipo.":"Podrá modificar productos, inventario, imágenes y el diseño visual de la tienda."}</p>`;
  }
  async function inviteTeamMember(e){
    e.preventDefault();const btn=$("inviteTeamBtn");btn.disabled=true;message("teamInviteMessage","Preparando invitación…");
    try{const result=await callTeamFunction({action:"invite",email:$("teamInviteEmail").value.trim(),role:$("teamInviteRole").value});message("teamInviteMessage",result.message||"Operación completada.",true);$("teamInviteEmail").value="";await loadTeamMembers();}
    catch(err){message("teamInviteMessage",err.message);}
    finally{btn.disabled=false;}
  }
  async function updateTeamRole(userId){
    const select=document.querySelector(`[data-team-role="${CSS.escape(userId)}"]`);if(!select)return;
    try{const result=await callTeamFunction({action:"set-role",user_id:userId,role:select.value});message("teamListMessage",result.message||"Permisos actualizados.",true);await loadTeamMembers();}
    catch(err){message("teamListMessage",err.message);}
  }
  async function removeTeamMember(userId){
    const member=teamMembers.find(x=>x.user_id===userId);if(!member)return;
    if(!confirm(`¿Retirar el acceso de administrador/editor de ${member.email}? Su cuenta seguirá existiendo, pero dejará de tener acceso al panel del equipo.`))return;
    try{const result=await callTeamFunction({action:"revoke",user_id:userId});message("teamListMessage",result.message||"Permisos retirados.",true);await loadTeamMembers();}
    catch(err){message("teamListMessage",err.message);}
  }
  function startRealtime(){
    let channel=supabase.channel("zero-shop-admin").on("postgres_changes",{event:"*",schema:"public",table:"products"},()=>loadProducts());
    if(currentUserRole==="admin")channel=channel.on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>loadOrders());
    channel.subscribe();
  }
  async function setInvitedUserPassword(e){
    e.preventDefault();
    const password=$("newTeamPassword").value;
    const confirmation=$("confirmTeamPassword").value;
    if(password.length<8){message("passwordSetupMessage","La contraseña debe tener al menos 8 caracteres.");return;}
    if(password!==confirmation){message("passwordSetupMessage","Las contraseñas no coinciden.");return;}
    const btn=$("saveTeamPasswordBtn");btn.disabled=true;message("passwordSetupMessage","Guardando contraseña…");
    const {data,error}=await supabase.auth.updateUser({password});
    btn.disabled=false;
    if(error){message("passwordSetupMessage",error.message);return;}
    message("passwordSetupMessage","Contraseña guardada. Abriendo el panel…",true);
    try{history.replaceState({},document.title,location.pathname+location.search);}catch{}
    $("passwordSetupPanel").hidden=true;
    await enterApp(data.user);
  }
  function bind(){
    $("setupPasswordForm").addEventListener("submit",setInvitedUserPassword);
    $("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginBtn").disabled=true;setLoginMessage("Validando acceso…");
      const {data,error}=await supabase.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
      $("loginBtn").disabled=false;if(error){setLoginMessage(error.message);return;}await enterApp(data.user);});
    $("logoutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();location.reload();});
    document.querySelectorAll(".admin-nav[data-tab]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
    document.querySelectorAll("[data-go-tab]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.goTab)));
    $("productForm").addEventListener("submit",saveProduct);$("resetProductBtn").addEventListener("click",clearForm);
    $("productImage").addEventListener("change",e=>previewFile(e.target.files[0]));
    $("removeImageBtn").addEventListener("click",()=>{editingImagePath=null;pendingImage=null;$("productImage").value="";$("imagePreview").innerHTML="<span>▧</span><b>Imagen quitada</b>";$("removeImageBtn").hidden=true;});
    $("productSearch").addEventListener("input",renderProducts);
    $("adminProductList").addEventListener("change",e=>{if(e.target.matches("[data-select]")){e.target.checked?selected.add(e.target.dataset.select):selected.delete(e.target.dataset.select);$("selectedCount").textContent=`${selected.size} seleccionados`;$("deleteSelectedBtn").disabled=!selected.size;}});
    $("selectAllBtn").addEventListener("click",()=>{const q=$("productSearch").value.toLowerCase();products.filter(p=>`${p.name} ${p.category} ${p.modality}`.toLowerCase().includes(q)).forEach(p=>selected.add(p.id));renderProducts();});
    $("deleteSelectedBtn").addEventListener("click",()=>deleteProducts([...selected]));
    $("exportProductsBtn").addEventListener("click",exportCsv);
    $("importCsv").addEventListener("change",async e=>{try{await importCsvFile(e.target.files[0]);}catch(err){toast(err.message);}e.target.value="";});
    $("orderStatusFilter").addEventListener("change",renderOrders);$("paymentFilter").addEventListener("change",renderOrders);
    $("refreshOrders").addEventListener("click",loadOrders);$("refreshDashboard").addEventListener("click",async()=>{await Promise.all([loadProducts(),loadOrders()]);});
    $("settingsForm").addEventListener("submit",saveSettings);$("inviteTeamForm").addEventListener("submit",inviteTeamMember);$("refreshTeamBtn").addEventListener("click",loadTeamMembers);$("teamSearch")?.addEventListener("input",renderTeamMembers);$("teamInviteRole")?.addEventListener("change",updateInviteRolePreview);updateInviteRolePreview();$("teamMembersList").addEventListener("click",e=>{const save=e.target.closest("[data-team-save]");const remove=e.target.closest("[data-team-remove]");if(save)updateTeamRole(save.dataset.teamSave);if(remove)removeTeamMember(remove.dataset.teamRemove);});bindDesigner();
  }
  async function start(){
    if(!window.zeroSupabaseReady){$("loginPanel").querySelector("p").textContent="Primero conecta Supabase: configura config.js y ejecuta el SQL de configuración. Después crea una cuenta administradora.";return;}
    bind();
    const inviteFlow=!!window.zeroAuthInviteFlow||/(?:type=invite|type=recovery)/i.test((location.hash||"")+(location.search||""));
    const {data}=await supabase.auth.getSession();
    if(data.session&&inviteFlow){$("loginPanel").hidden=true;$("passwordSetupPanel").hidden=false;}
    else if(data.session)await enterApp(data.session.user);
    supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"){$("adminApp").hidden=true;$("passwordSetupPanel").hidden=true;$("loginPanel").hidden=false;}
    });
  }
  start();
})();
