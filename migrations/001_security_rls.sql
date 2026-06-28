-- ============================================================
-- MIGRATION 001 — ENDURECIMENTO DE RLS (SEGURANÇA)
-- Execute no Supabase SQL Editor.
--
-- Contexto: o app acessa TODAS as tabelas via service role
-- (server-side), que ignora RLS. As políticas "públicas" abaixo
-- davam acesso direto pela ANON KEY (que é pública, embutida no
-- cliente), permitindo a qualquer um:
--   - ler todos os questionários/perguntas pela REST API
--   - inserir lixo/spam em scans, submissions, ux_events
-- Removemos essas políticas. RLS continua HABILITADO; sem
-- políticas, a anon key não tem nenhum acesso às tabelas, e o
-- service role continua funcionando normalmente.
-- ============================================================

DROP POLICY IF EXISTS "public_read_active_qrcodes"  ON public.qr_codes;
DROP POLICY IF EXISTS "public_read_questionnaires"   ON public.questionnaires;
DROP POLICY IF EXISTS "public_read_questions"        ON public.questions;
DROP POLICY IF EXISTS "public_insert_scans"          ON public.scans;
DROP POLICY IF EXISTS "public_insert_submissions"    ON public.submissions;
DROP POLICY IF EXISTS "public_insert_answers"        ON public.submission_answers;
DROP POLICY IF EXISTS "public_insert_ux_events"      ON public.ux_events;

-- Garante que o RLS permanece habilitado em todas as tabelas
-- (nenhuma política => nenhum acesso via anon/authenticated;
--  apenas service role passa).
ALTER TABLE public.qr_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaires     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ux_events          ENABLE ROW LEVEL SECURITY;

-- As views (v_qr_conversion, etc.) são lidas apenas via service
-- role no dashboard admin, então também ficam protegidas.
