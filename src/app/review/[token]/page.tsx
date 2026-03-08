import { ReviewListClient } from './ReviewListClient'
import { createServiceClient } from '@/lib/supabase/server'

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

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
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

  // 全動画の署名付きURLを並列生成（逐次→並列で高速化）
  await Promise.all(
    (project.videos ?? []).map(async (video: { storage_path: string; signed_url?: string | null }) => {
      const { data } = await supabase.storage
        .from('videos')
        .createSignedUrl(video.storage_path, 3600)
      video.signed_url = data?.signedUrl ?? null
    })
  )

  return <ReviewListClient project={project} token={token} />
}
