import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Public endpoint — no auth needed (used by clients via share link)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { video_id, type, timestamp_seconds, text, author_name } = body

  if (!video_id || timestamp_seconds === undefined || !text) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('feedbacks')
    .insert({
      video_id,
      type: type || 'memo',
      timestamp_seconds,
      text,
      author_name: author_name || null,
      is_resolved: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data })
}
