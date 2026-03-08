import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      videos (
        *,
        feedbacks (
          *,
          feedback_replies (*)
        )
      )
    `)
    .eq('share_token', token)
    .single()

  if (error || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Check expiry
  if (project.share_expires_at && new Date(project.share_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
  }

  // Sort videos by display_order
  if (project.videos) {
    project.videos.sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
    project.videos.forEach((v: { feedbacks?: { timestamp_seconds: number }[] }) => {
      if (v.feedbacks) {
        v.feedbacks.sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
      }
    })
  }

  // Generate signed URLs for videos
  for (const video of project.videos ?? []) {
    const { data } = await supabase.storage
      .from('videos')
      .createSignedUrl(video.storage_path, 3600) // 1 hour
    video.signed_url = data?.signedUrl ?? null
  }

  return NextResponse.json({ project })
}
