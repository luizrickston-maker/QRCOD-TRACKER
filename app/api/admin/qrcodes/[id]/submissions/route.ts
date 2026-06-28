import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getAdminUser } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/qrcodes/[id]/submissions
// Query params: page (default 0), limit (default 20)
export async function GET(request: NextRequest, { params }: Params) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '0')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = page * limit

  const supabase = createServiceClient()

  const { data: submissions, count, error } = await supabase
    .from('submissions')
    .select(`
      id,
      created_at,
      time_to_complete_seconds,
      scan_id,
      submission_answers (
        question_label,
        answer
      )
    `, { count: 'exact' })
    .eq('qr_code_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    submissions: submissions ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}
