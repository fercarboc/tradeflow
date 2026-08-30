-- B01: Deprecar el overload de 3 parámetros de ship_supplier_order
-- El overload de 3 params no guarda tracking_ref en la tabla (bug).
-- El de 5 params es el correcto y es el único que debe existir.

DROP FUNCTION IF EXISTS public.ship_supplier_order(uuid, text, text);;
