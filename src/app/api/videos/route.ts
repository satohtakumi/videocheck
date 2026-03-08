import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// File is uploaded directly from client to Supabase Storage — this route only saves metadata

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { project_id, title, storage_path, display_order } = await request.json()

    if (!project_id || !storage_path) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Check video count
    const { count } = await supabase
      .from('videos')
      .select('id', { count: 'exact' })
      .eq('project_id', project_id)

    if ((count ?? 0) >= 10) {
      return NextResponse.json({ error: '動画は最大10本まで登録できます' }, { status: 400 })
    }

    // Save video record
    const { data: video, error: dbError } = await supabase
      .from('videos')
      .insert({
        project_id,
        title: title || storage_path.split('/').pop(),
        storage_path,
        display_order: display_order ?? 0,
        status: 'pending',
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB insert error:', dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // プロジェクトを「レビュー待ち」に自動更新（下書きの場合のみ）
    await supabase
      .from('projects')
      .update({ status: 'pending_review' })
      .eq('id', project_id)
      .eq('status', 'draft')

    return NextResponse.json({ video })
  } catch (err) {
    console.error('Unexpected error in /api/videos:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '予期しないエラーが発生しました' },
      { status: 500 }
    )
  }
}
