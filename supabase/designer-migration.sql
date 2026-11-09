-- ZERO Y NANY - SHOP: migración para el diseñador visual y editor de distribución
-- Ejecuta este archivo UNA SOLA VEZ en Supabase > SQL Editor.

alter table public.store_settings
  add column if not exists design jsonb not null default '{}'::jsonb;

update public.store_settings
set design = jsonb_build_object(
  'theme', jsonb_build_object(
    'accent', '#ff315d',
    'background', '#090812',
    'panel', '#151426',
    'text', '#f8f7ff',
    'font', 'Inter'
  ),
  'content', jsonb_build_object(
    'badge', 'TIENDA DIGITAL · ZERO Y NANY - SHOP',
    'hero_title', 'Lo que buscas, en un solo lugar.',
    'hero_subtitle', 'Explora el catálogo, revisa la disponibilidad y envía tu pedido de forma sencilla. Tus compras quedan registradas para darles seguimiento.',
    'hero_cta', 'Explorar catálogo',
    'hero_image_path', null
  ),
  'sections', jsonb_build_object(
    'hero', true, 'catalogo', true, 'como-comprar', true, 'contacto', true
  ),
  'order', jsonb_build_array('hero','catalogo','como-comprar','contacto')
)
where id = 1 and (design is null or design = '{}'::jsonb);

-- La lectura pública y la edición administrativa siguen usando las políticas RLS
-- existentes de store_settings. No se requieren claves secretas en el navegador.
