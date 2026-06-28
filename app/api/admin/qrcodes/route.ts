import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getAdminUser } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'

// GET /api/admin/qrcodes — lista todos os QR codes com stats
export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Query qr_codes directly and manually compute stats
  const { data: qrcodes, error: qrError } = await supabase
    .from('qr_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (qrError || !qrcodes) {
    return NextResponse.json([])
  }

  // Get conversion stats from the view
  const { data: convData } = await supabase
    .from('v_qr_conversion')
    .select('id, total_scans, total_submissions, conversion_rate')

  const statsMap = new Map<string, { total_scans: number; total_submissions: number; conversion_rate: number }>()
  for (const row of convData ?? []) {
    statsMap.set(row.id, {
      total_scans: Number(row.total_scans ?? 0),
      total_submissions: Number(row.total_submissions ?? 0),
      conversion_rate: Number(row.conversion_rate ?? 0),
    })
  }

  const result = qrcodes.map((qr: { id: string; [key: string]: unknown }) => {
    const stats = statsMap.get(qr.id)
    return {
      ...qr,
      total_scans: stats?.total_scans ?? 0,
      total_submissions: stats?.total_submissions ?? 0,
      conversion_rate: stats?.conversion_rate ?? 0,
    }
  })

  return NextResponse.json(result)
}

// POST /api/admin/qrcodes — cria novo QR code + questionário padrão
export async function POST(request: NextRequest) {
  const user = await getAdminUser()
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
    console.error('[qrcode-create]', qrError.message)
    return NextResponse.json({ error: 'Erro ao criar QR Code.' }, { status: 500 })
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
