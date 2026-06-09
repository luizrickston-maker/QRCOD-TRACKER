import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'

// GET /api/admin/qrcodes — lista todos os QR codes com stats
export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('v_qr_conversion')
    .select('*')
    .order('created_at', { ascending: false, referencedTable: 'qr_codes' })

  if (error) {
    // Fallback se a view não existir
    const { data: fallback } = await supabase
      .from('qr_codes')
      .select('*')
      .order('created_at', { ascending: false })
    return NextResponse.json(fallback ?? [])
  }

  return NextResponse.json(data ?? [])
}

// POST /api/admin/qrcodes — cria novo QR code + questionário padrão
export async function POST(request: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, brand_name, slug: rawSlug } = body

  if (!name || !rawSlug) {
    return NextResponse.json({ error: 'name e slug são obrigatórios' }, { status: 400 })
  }

  const slug = slugify(rawSlug)
  const supabase = createServiceClient()

  // Verifica slug único
  const { data: existing } = await supabase
    .from('qr_codes')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Slug já existe. Escolha outro.' }, { status: 409 })
  }

  // Cria QR code
  const { data: qr, error: qrError } = await supabase
    .from('qr_codes')
    .insert({ name, brand_name: brand_name || 'Questionário', slug })
    .select()
    .single()

  if (qrError) {
    return NextResponse.json({ error: qrError.message }, { status: 500 })
  }

  // Cria questionário padrão associado
  const { data: questionnaire, error: qError } = await supabase
    .from('questionnaires')
    .insert({
      qr_code_id: qr.id,
      title: `Formulário — ${name}`,
      description: 'Preencha os campos abaixo.',
      submit_label: 'Enviar',
    })
    .select()
    .single()

  if (qError) {
    console.error('[create-questionnaire]', qError.message)
  }

  // Cria perguntas padrão
  if (questionnaire) {
    await supabase.from('questions').insert([
      {
        questionnaire_id: questionnaire.id,
        label: 'Nome completo',
        type: 'text',
        placeholder: 'Seu nome',
        required: true,
        sort_order: 0,
      },
      {
        questionnaire_id: questionnaire.id,
        label: 'E-mail',
        type: 'email',
        placeholder: 'seu@email.com',
        required: true,
        sort_order: 1,
      },
      {
        questionnaire_id: questionnaire.id,
        label: 'Telefone / WhatsApp',
        type: 'phone',
        placeholder: '(00) 00000-0000',
        required: false,
        sort_order: 2,
      },
    ])
  }

  return NextResponse.json({ qr, questionnaire }, { status: 201 })
}
