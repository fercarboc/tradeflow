-- B: Instalar extensión unaccent para normalización de tildes en búsqueda
-- Necesaria para comparar "valvula" con "Válvula", "desague" con "desagüe", etc.
-- SCHEMA extensions: aislada del namespace público, accesible vía extensions.unaccent()

CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;
