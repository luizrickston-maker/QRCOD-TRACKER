import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import QuestionnaireClient from './QuestionnaireClient'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ scan?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('brand_name')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  return {
    title: qr?.brand_name ?? 'Questionário',
    description: 'Preencha o formulário.',
  }
}

export default async function QuestionnairePage({ params, searchParams }: Props) {
  const { slug } = await params
  const { scan } = await searchParams

  const supabase = createServiceClient()

  // Busca QR code + questionnaire + questions
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('id, slug, brand_name, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!qr) return notFound()

  const { data: questionnaire } = await supabase
    .from('questionnaires')
    .select('*')
    .eq('qr_code_id', qr.id)
    .single()

  const { data: questions } = questionnaire
    ? await supabase
        .from('questions')
        .select('*')
        .eq('questionnaire_id', questionnaire.id)
        .order('sort_order', { ascending: true })
    : { data: [] }

  return (
    <QuestionnaireClient
      slug={slug}
      brandName={qr.brand_name}
      questionnaire={questionnaire}
      questions={questions ?? []}
      scanId={scan ?? null}
    />
  )
}
