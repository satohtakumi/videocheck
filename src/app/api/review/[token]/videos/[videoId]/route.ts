import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// クライアント（非ログイン）がOK/NGを行うエンドポイント
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; videoId: string }> }
) {
  const { token, videoId } = await params
  const supabase = createServiceClient()

  // share_token でプロジェクトを検証
  const { data: project } = await supabase
    .from('projects')
    .select('id, share_expires_at')
    .eq('share_token', token)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Invalid share link' }, { status: 404 })
  }

  if (project.share_expires_at && new Date(project.share_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
  }

  // 動画がこのプロジェクトに属するか確認
  const { data: video } = await supabase
    .from('videos')
    .select('id, status')
    .eq('id', videoId)
    .eq('project_id', project.id)
    .single()

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const { status, rejection_reason } = await request.json()

  // 動画ステータスを更新
  const { data: updatedVideo, error: videoError } = await supabase
    .from('videos')
    .update({ status, ...(rejection_reason ? { rejection_reason } : {}) })
    .eq('id', videoId)
    .select()
    .single()

  if (videoError) {
    return NextResponse.json({ error: videoError.message }, { status: 500 })
  }

  // プロジェクトステータスを連動更新
  if (status === 'rejected') {
    // NGが出たら → 修正中
    await supabase
      .from('projects')
      .update({ status: 'in_revision' })
      .eq('id', project.id)
  } else if (status === 'approved') {
    // OKなら → 全動画が承認済みかチェック
    const { data: allVideos } = await supabase
      .from('videos')
      .select('id, status')
      .eq('project_id', project.id)

    const allApproved = allVideos?.every(v =>
      v.id === videoId ? true : v.status === 'approved'
    ) ?? false

    await supabase
      .from('projects')
      .update({ status: allApproved ? 'approved' : 'pending_review' })
      .eq('id', project.id)
  }

  return NextResponse.json({ video: updatedVideo })
}
