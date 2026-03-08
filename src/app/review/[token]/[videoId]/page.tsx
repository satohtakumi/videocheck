import { ReviewClient } from '../ReviewClient'
import { notFound } from 'next/navigation'

export default async function VideoReviewPage({
  params,
}: {
  params: Promise<{ token: string; videoId: string }>
}) {
  const { token, videoId } = await params

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/review/${token}`,
    { cache: 'no-store' }
  )

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: '' }))
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">
            {error === 'Share link has expired' ? 'リンクの有効期限が切れています' : 'ページが見つかりません'}
          </h1>
          <p className="text-gray-400">このリンクは無効です</p>
        </div>
      </div>
    )
  }

  const { project } = await res.json()

  const videoIndex = (project.videos ?? []).findIndex((v: { id: string }) => v.id === videoId)
  if (videoIndex === -1) notFound()

  return <ReviewClient project={project} initialVideoIndex={videoIndex} token={token} />
}
