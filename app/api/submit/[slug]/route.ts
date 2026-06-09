import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/submit/[slug]
// Recebe o formulário preenchido e salva no banco
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { scan_id, answers, time_to_complete_seconds } = body

    const supabase = createServiceClient()

    // Busca qr_code pelo slug
    const { data: qr, error: qrError } = await supabase
      .from('qr_codes')
      .select('id, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (qrError || !qr) {
      return NextResponse.json(
        { error: 'Formulário não encontrado ou inativo.' },
        { status: 404 }
      )
    }

    // Cria submission
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .insert({
        scan_id: scan_id ?? null,
        qr_code_id: qr.id,
        time_to_complete_seconds: time_to_complete_seconds ?? null,
      })
      .select()
      .single()

    if (subError || !submission) {
      return NextResponse.json(
        { error: 'Erro ao salvar respostas.' },
        { status: 500 }
      )
    }

    // Salva as respostas individuais
    if (Array.isArray(answers) && answers.length > 0) {
      const rows = answers.map((a: { question_id: string; question_label: string; answer: string }) => ({
        submission_id: submission.id,
        question_id: a.question_id ?? null,
        question_label: a.question_label,
        answer: a.answer ?? '',
      }))

      await supabase.from('submission_answers').insert(rows)
    }

    return NextResponse.json({ ok: true, submission_id: submission.id })
  } catch (error) {
    console.error('[submit-api]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
