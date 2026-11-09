# ZERO Y NANY - SHOP CLOUD

Versión preparada para publicar ZERO Y NANY - SHOP como tienda real con Supabase + Vercel.

## Incluye

- Tienda pública adaptable a celular y computadora.
- Catálogo en la nube con actualización en tiempo real.
- Panel administrativo con inicio de sesión por correo y contraseña.
- Roles de administrador y editor protegidos por Row Level Security (RLS).
- Gestión de equipo: invitar administradores y editores por correo, cambiar roles y revocar accesos desde el panel.
- Invitaciones seguras mediante Supabase Edge Function; la service role key nunca se expone al navegador.
- Alta, edición, ocultar, eliminación individual y múltiple de productos.
- Fotos y stickers de producto almacenados en Supabase Storage.
- Control de precios y existencias.
- Carrito y checkout de pedidos.
- Validación de stock y precios del lado de PostgreSQL al crear un pedido.
- Panel de pedidos: datos del cliente, artículos, estado del pedido y estado del pago.
- Configuración de nombre de tienda, WhatsApp, anuncio e instrucciones de pago.
- Importación y exportación CSV.
- Catálogo inicial de 53 opciones importado de la versión anterior.

## Lo que NO está conectado todavía

No se puede publicar una base de datos real sin que el propietario cree su proyecto Supabase y aporte la URL y publishable key del proyecto. Este ZIP contiene el código y el SQL, pero no crea cuentas externas ni despliega el sitio por sí solo.

La versión registra pedidos y coordina el pago manualmente por WhatsApp. No procesa tarjetas ni transferencias automáticamente.

## Configuración paso a paso

### 1. Crear el proyecto de Supabase

1. Entra a https://supabase.com/ y crea una cuenta.
2. Crea un proyecto llamado `zero-shop`.
3. Guarda la contraseña de base de datos en un gestor seguro.
4. En el proyecto, abre **SQL Editor**.

### 2. Crear tablas, seguridad, imágenes y catálogo

1. Abre el archivo `supabase/schema.sql` de este ZIP.
2. Copia todo el contenido y ejecútalo en SQL Editor.
3. El script crea las tablas, políticas RLS, el bucket `product-images`, la función de pedidos y carga las 53 opciones iniciales.

El catálogo inicial se carga con existencias `NULL` (por confirmar). Ajusta el stock real desde el panel antes de ofrecer disponibilidad exacta.

### 3. Crear la cuenta administradora

1. En Supabase abre **Authentication > Users**.
2. Crea un usuario con tu correo y una contraseña fuerte.
3. Copia el correo que registraste.
4. En SQL Editor ejecuta este comando sustituyendo el correo:

```sql
insert into public.profiles (user_id, role)
select id, 'admin'
from auth.users
where email = 'TU_CORREO';
```

5. Entra al panel de la tienda en `/admin.html` con ese correo y contraseña.

No hay registro público de administradores. No compartas tu contraseña.

### 4. Conectar la página

1. En Supabase abre **Project Settings > API** (o **Data API / API Keys**, según la interfaz).
2. Copia la **Project URL**.
3. Copia la **Publishable key** (`sb_publishable_...`) o la anon key pública heredada.
4. Abre `config.js` y reemplaza:

```js
window.ZERO_CONFIG = {
  supabaseUrl: "PEGA_AQUI_TU_SUPABASE_PROJECT_URL",
  supabasePublishableKey: "PEGA_AQUI_TU_SUPABASE_PUBLISHABLE_KEY"
};
```

La publishable/anon key se usa en el navegador y no es una contraseña. La seguridad depende de las políticas RLS instaladas por el SQL.

**Nunca uses ni publiques `service_role`, secret key o contraseña de base de datos en `config.js`.**

### 5. Probar localmente

En una terminal dentro de la carpeta del proyecto:

```bash
python -m http.server 8000
```

Abre `http://localhost:8000`.

La carga por `file://` no es recomendable porque algunos navegadores bloquean recursos y sesiones.

### 6. Publicar en Vercel

1. Sube la carpeta a un repositorio privado de GitHub.
2. Entra a https://vercel.com/new e importa el repositorio.
3. Framework preset: **Other**.
4. Build command: vacío.
5. Output directory: `.` (raíz).
6. Pulsa Deploy.
7. En Supabase, abre **Authentication > URL Configuration** y registra tu dominio de Vercel en Site URL y Redirect URLs.
8. Comparte el dominio público con tus clientes.

También puedes usar otro hosting estático HTTPS. No necesitas poner credenciales de servidor en Vercel porque la conexión usa la publishable key y RLS.

## Rutas

- Tienda: `/`
- Panel privado: `/admin.html`

## Operación diaria

- Agregar o editar producto: Panel > Productos.
- Subir imagen: seleccionar JPG, PNG, WEBP o GIF en el editor. Se guarda en Storage.
- Eliminar productos: botón individual o selección múltiple.
- Ajustar stock: editar el campo Stock. Vacío = por confirmar; 0 = agotado.
- Ver pedidos: Panel > Pedidos.
- Cambiar estado de pedido o pago: selectores dentro de cada pedido.
- Actualizar WhatsApp y las instrucciones de pago: Panel > Ajustes.

## Seguridad y operación

- RLS protege los datos; el navegador nunca recibe la secret/service role key.
- Los clientes solo leen productos activos y ajustes públicos.
- Los pedidos se crean mediante una función SQL que valida el precio y bloquea filas al descontar stock.
- Al cancelar un pedido desde el panel, otra función SQL devuelve automáticamente las existencias reservadas una sola vez.
- Administradores: acceso completo. Editores: productos, inventario, imágenes y diseñador. Pedidos, ajustes generales y gestión de usuarios: solo administradores.
- Usa HTTPS y una contraseña fuerte. Activa MFA en la cuenta administradora.
- Ofrece únicamente bienes o servicios que tengas autorización para comercializar.
- Haz respaldos periódicos desde Supabase.

## Soporte

Si una consulta falla, revisa la pestaña Logs de Supabase y que las políticas RLS del archivo SQL se hayan ejecutado sin errores.


## Diseñador sin código
El panel incluye un editor visual para textos, colores, tipografía e imagen principal, además de un editor de distribución para reordenar y ocultar secciones. En proyectos ya creados ejecuta `supabase/designer-migration.sql` en Supabase SQL Editor. En instalaciones nuevas usa el `supabase/schema.sql` actualizado.


## Gestión de administradores y editores

El panel incluye **Usuarios y permisos**. Solo las cuentas con rol `admin` pueden invitar usuarios o cambiar permisos.

- **Administrador:** administra equipo, productos, inventario, imágenes, pedidos, ajustes generales y diseño.
- **Editor:** administra productos, inventario, imágenes y diseño. No puede ver pedidos, cambiar ajustes generales ni gestionar usuarios.
- Al invitar un correo nuevo, Supabase envía un enlace para que la persona acepte y configure su contraseña.
- Si el correo ya pertenece a un usuario de este proyecto, el sistema le asigna el rol seleccionado sin crear una cuenta duplicada.
- El panel permite cambiar el rol y revocar el acceso. No permite que un administrador se quite a sí mismo ni que se elimine al último administrador.

### Si ya creaste el proyecto y ejecutaste el SQL anterior

1. **No vuelvas a ejecutar `schema.sql` completo.** Tus tablas y productos ya existen.
2. En Supabase abre **SQL Editor > New query**.
3. Abre `supabase/team-roles-migration.sql`, copia todo su contenido, pégalo y pulsa **Run**. Esta migración conserva las cuentas y roles actuales; las dos cuentas que ya están como `admin` seguirán siendo administradoras.
4. Despliega la función `manage-team` como se indica abajo.
5. Sustituye los archivos del sitio por los de esta versión y vuelve a desplegarlo en Vercel.

### Desplegar la función segura para invitar usuarios

La API de administración de usuarios de Supabase requiere una clave privilegiada. Por seguridad, esa clave se usa exclusivamente dentro de una Edge Function y nunca en `config.js` ni en el navegador.

1. En Supabase abre **Edge Functions** y elige **Deploy a new function** / **Create function**.
2. Nombra la función exactamente `manage-team`.
3. En el editor de la función, reemplaza el ejemplo por el contenido completo de `supabase/functions/manage-team/index.ts` y despliega.
4. La función utiliza las variables de entorno administradas por Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Si el panel de secretos indica que falta `SUPABASE_SERVICE_ROLE_KEY`, agrégala en **Edge Functions > Secrets** desde el panel de Supabase. No la pegues en ningún archivo público ni en el chat.
5. Cuando publiques la tienda en Vercel, en **Authentication > URL Configuration** agrega el dominio de Vercel a **Redirect URLs**, por ejemplo `https://tu-tienda.vercel.app/**`. La función redirige al usuario invitado a `/admin.html` para que configure su contraseña.

El archivo `supabase/config.toml` mantiene la verificación JWT activada para `manage-team`. La función verifica además que quien la invoque tenga rol `admin`.

### Uso del panel

1. Entra a `/admin.html` con una de las cuentas administradoras existentes.
2. Abre **Usuarios y permisos**.
3. Escribe el correo y selecciona **Editor** o **Administrador**.
4. Pulsa **Enviar invitación**. Si es una cuenta nueva, la persona recibirá el correo para configurar su contraseña.
5. Los usuarios y sus permisos aparecerán en **Equipo actual**.

Si el menú no aparece o la invitación falla, comprueba que la migración SQL y la Edge Function `manage-team` estén desplegadas en el mismo proyecto Supabase que utiliza `config.js`.
