import { ReviewClient } from '../ReviewClient'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-2xl font-bold mb-2">{message}</h1>
        <p className="text-gray-400">このリンクは無効です</p>
      </div>
    </div>
  )
}

export default async function VideoReviewPage({
  params,
}: {
  params: Promise<{ token: string; videoId: string }>
}) {
  const { token, videoId } = await params
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
    return <ErrorPage message="ページが見つかりません" />
  }

  if (project.share_expires_at && new Date(project.share_expires_at) < new Date()) {
    return <ErrorPage message="リンクの有効期限が切れています" />
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
      .createSignedUrl(video.storage_path, 3600)
    ;(video as { signed_url?: string | null }).signed_url = data?.signedUrl ?? null
  }

  const videoIndex = (project.videos ?? []).findIndex((v: { id: string }) => v.id === videoId)
  if (videoIndex === -1) notFound()

  return <ReviewClient project={project} initialVideoIndex={videoIndex} token={token} />
}
