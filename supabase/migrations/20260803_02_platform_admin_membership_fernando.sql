-- Membresía platform_super_admin para el usuario administrador de la plataforma
INSERT INTO public.trade_marketplace_actor_members (actor_id, user_id, role_id, activo, invited_by, notas)
VALUES (
  '283d106e-30e3-4e1d-8e3d-069e4a6e4f61',   -- actor: TrabFlow (platform)
  'cf1000d3-80bc-4bdd-a9df-b8a0f0462c77',   -- user: fercarboc@gmail.com
  '3385654b-a106-4bde-8d0d-05802b6688bf',   -- role: platform_super_admin
  true,
  'cf1000d3-80bc-4bdd-a9df-b8a0f0462c77',
  'Administrador fundador de la plataforma TrabFlow'
)
ON CONFLICT (actor_id, user_id) DO UPDATE
  SET role_id  = EXCLUDED.role_id,
      activo   = true,
      notas    = EXCLUDED.notas;
