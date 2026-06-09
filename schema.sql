-- ============================================================
-- QR TRACKER MVP — DATABASE SCHEMA
-- Execute no Supabase SQL Editor (em ordem)
-- ============================================================

-- --------------------------------------------------------
-- EXTENSIONS
-- --------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------
-- TABELA: qr_codes
-- Cada QR code gerado pelo sistema
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,        -- parte da URL: /q/[slug]
  name          TEXT NOT NULL,               -- nome interno (ex: "Cartão Evento 2025")
  brand_name    TEXT NOT NULL DEFAULT 'Questionário', -- exibido ao usuário
  is_locked     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER qr_codes_updated_at
  BEFORE UPDATE ON public.qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------
-- TABELA: questionnaires
-- Um questionário por QR code
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questionnaires (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id      UUID NOT NULL UNIQUE REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Preencha o formulário',
  description     TEXT,
  submit_label    TEXT NOT NULL DEFAULT 'Enviar',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER questionnaires_updated_at
  BEFORE UPDATE ON public.questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------
-- TABELA: questions
-- Perguntas do questionário (ordem configurável)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id  UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN (
                      'text', 'email', 'phone', 'textarea',
                      'select', 'radio', 'checkbox', 'number'
                    )),
  options           JSONB,             -- para select/radio/checkbox: ["Opção A","Opção B"]
  placeholder       TEXT,
  required          BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_questionnaire ON public.questions(questionnaire_id, sort_order);

-- --------------------------------------------------------
-- TABELA: scans
-- Cada acesso à rota /q/[slug]
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id    UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  ip            TEXT,
  user_agent    TEXT,
  referrer      TEXT,
  city          TEXT,
  region        TEXT,
  country       TEXT,
  country_code  TEXT,
  latitude      NUMERIC(10,6),
  longitude     NUMERIC(10,6),
  device_type   TEXT CHECK (device_type IN ('mobile', 'desktop', 'tablet', 'unknown')),
  browser       TEXT,
  browser_version TEXT,
  os            TEXT,
  os_version    TEXT,
  is_bot        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scans_qr_code ON public.scans(qr_code_id, created_at DESC);
CREATE INDEX idx_scans_created ON public.scans(created_at DESC);
CREATE INDEX idx_scans_is_bot ON public.scans(is_bot);

-- --------------------------------------------------------
-- TABELA: submissions
-- Questionário enviado com sucesso
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submissions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id                  UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  qr_code_id               UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  time_to_complete_seconds INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submissions_qr_code ON public.submissions(qr_code_id, created_at DESC);
CREATE INDEX idx_submissions_scan ON public.submissions(scan_id);

-- --------------------------------------------------------
-- TABELA: submission_answers
-- Respostas individuais por pergunta
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submission_answers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  question_id    UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  question_label TEXT NOT NULL, -- snapshot do label no momento da submissão
  answer         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_answers_submission ON public.submission_answers(submission_id);

-- --------------------------------------------------------
-- TABELA: ux_events
-- Eventos de interação do usuário no questionário
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ux_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     UUID,             -- pode ser nulo se scan falhou
  event_type  TEXT NOT NULL CHECK (event_type IN (
                'focus', 'blur', 'field_time', 'rage_click', 'abandon', 'submit'
              )),
  field_name  TEXT,
  metadata    JSONB,            -- {duration_ms, click_count, last_field, etc.}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ux_events_scan ON public.ux_events(scan_id);
CREATE INDEX idx_ux_events_type ON public.ux_events(event_type);

-- --------------------------------------------------------
-- ROW LEVEL SECURITY
-- Tabelas públicas (leitura/escrita via service role apenas)
-- O frontend usa a service role key para operações server-side
-- --------------------------------------------------------
ALTER TABLE public.qr_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaires     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ux_events          ENABLE ROW LEVEL SECURITY;

-- Service role bypassa RLS automaticamente.
-- Políticas abaixo permitem leitura pública das tabelas necessárias
-- para renderizar o questionário (sem autenticação do usuário final).

-- Leitura pública de qr_codes ativos (para a página do questionário)
CREATE POLICY "public_read_active_qrcodes"
  ON public.qr_codes FOR SELECT
  USING (is_active = TRUE);

-- Leitura pública de questionnaires (renderização do formulário)
CREATE POLICY "public_read_questionnaires"
  ON public.questionnaires FOR SELECT
  USING (TRUE);

-- Leitura pública de questions (renderização do formulário)
CREATE POLICY "public_read_questions"
  ON public.questions FOR SELECT
  USING (TRUE);

-- Inserção pública em scans (anon pode inserir)
CREATE POLICY "public_insert_scans"
  ON public.scans FOR INSERT
  WITH CHECK (TRUE);

-- Inserção pública em submissions
CREATE POLICY "public_insert_submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (TRUE);

-- Inserção pública em submission_answers
CREATE POLICY "public_insert_answers"
  ON public.submission_answers FOR INSERT
  WITH CHECK (TRUE);

-- Inserção pública em ux_events
CREATE POLICY "public_insert_ux_events"
  ON public.ux_events FOR INSERT
  WITH CHECK (TRUE);

-- --------------------------------------------------------
-- VIEWS ÚTEIS PARA O DASHBOARD
-- --------------------------------------------------------

-- View: resumo de conversão por QR code
CREATE OR REPLACE VIEW public.v_qr_conversion AS
SELECT
  q.id,
  q.name,
  q.slug,
  q.is_active,
  q.is_locked,
  COUNT(DISTINCT s.id) FILTER (WHERE s.is_bot = FALSE) AS total_scans,
  COUNT(DISTINCT sub.id)                                AS total_submissions,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT s.id) FILTER (WHERE s.is_bot = FALSE) > 0
      THEN (COUNT(DISTINCT sub.id)::NUMERIC /
            COUNT(DISTINCT s.id) FILTER (WHERE s.is_bot = FALSE)) * 100
      ELSE 0
    END, 1
  ) AS conversion_rate
FROM public.qr_codes q
LEFT JOIN public.scans s     ON s.qr_code_id = q.id
LEFT JOIN public.submissions sub ON sub.qr_code_id = q.id
GROUP BY q.id;

-- View: scans por dia (últimos 30 dias)
CREATE OR REPLACE VIEW public.v_daily_scans AS
SELECT
  DATE(created_at) AS scan_date,
  qr_code_id,
  COUNT(*) FILTER (WHERE is_bot = FALSE) AS scan_count
FROM public.scans
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), qr_code_id
ORDER BY scan_date;

-- View: distribuição de dispositivos
CREATE OR REPLACE VIEW public.v_device_stats AS
SELECT
  qr_code_id,
  device_type,
  COUNT(*) AS count
FROM public.scans
WHERE is_bot = FALSE
GROUP BY qr_code_id, device_type;

-- View: top cidades
CREATE OR REPLACE VIEW public.v_city_stats AS
SELECT
  qr_code_id,
  city,
  country,
  COUNT(*) AS count
FROM public.scans
WHERE is_bot = FALSE AND city IS NOT NULL
GROUP BY qr_code_id, city, country
ORDER BY count DESC;
