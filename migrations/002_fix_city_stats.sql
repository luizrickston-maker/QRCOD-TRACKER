-- ============================================================
-- MIGRATION 002 — CORRIGE AGRUPAMENTO DE "TOP CIDADES"
-- Execute no Supabase SQL Editor.
--
-- Problema: a v_city_stats agrupava por (qr_code_id, city, country).
-- A geo da Vercel grava country = NULL (só fornece o código), enquanto
-- o fallback ip-api grava country = 'Brazil'. Resultado: a mesma cidade
-- (ex.: Itaberaba) aparecia em 2 linhas com contagens separadas.
--
-- Correção: agrupar por country_code (consistente = 'BR' nos dois casos)
-- e exibir um nome de país representativo via MAX(country).
-- ============================================================

-- Precisa de DROP: o CREATE OR REPLACE não permite mudar nome/posição
-- de colunas de uma view já existente.
DROP VIEW IF EXISTS public.v_city_stats;

CREATE VIEW public.v_city_stats AS
SELECT
  qr_code_id,
  city,
  country_code,
  MAX(country) AS country,
  COUNT(*) AS count
FROM public.scans
WHERE is_bot = FALSE AND city IS NOT NULL
GROUP BY qr_code_id, city, country_code
ORDER BY count DESC;
