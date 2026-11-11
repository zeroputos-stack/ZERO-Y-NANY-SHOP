
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
    'profiles',
    'products',
    'store_settings',
    'orders',
    'order_items',
    'reviews'
)
ORDER BY table_name, ordinal_position;
