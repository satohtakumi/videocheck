import { ReviewListClient } from './ReviewListClient'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

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

  return <ReviewListClient project={project} token={token} />
}
