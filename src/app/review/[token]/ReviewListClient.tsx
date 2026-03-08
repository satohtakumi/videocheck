'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock, MessageSquare, Play, Film } from 'lucide-react'
import type { Project, Video, Feedback, VideoStatus } from '@/types/database'

type VideoWithUrl = Omit<Video, 'feedbacks'> & { signed_url: string | null; feedbacks: Feedback[] }
type ProjectWithVideos = Omit<Project, 'videos'> & { videos: VideoWithUrl[] }

interface Props {
  project: ProjectWithVideos
  token: string
}

const STATUS_CONFIG: Record<VideoStatus, { label: string; color: string; Icon: typeof Clock }> = {
  pending:  { label: '確認待ち', color: 'bg-yellow-100 text-yellow-700', Icon: Clock },
  approved: { label: '承認済み', color: 'bg-green-100 text-green-700',  Icon: CheckCircle },
  rejected: { label: '差し戻し', color: 'bg-red-100 text-red-700',     Icon: XCircle },
}

export function ReviewListClient({ project, token }: Props) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="bg-blue-600 rounded-lg p-2 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-white text-base">{project.name}</h1>
            <p className="text-xs text-gray-400">{project.client_name}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white">動画一覧</h2>
          <p className="text-sm text-gray-400 mt-1">
            確認したい動画をクリックしてレビューしてください
          </p>
        </div>

        {project.videos.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-16 text-center">
            <Film size={40} className="mx-auto mb-3 text-gray-600" />
            <p className="text-gray-500">動画がまだアップロードされていません</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {project.videos.map((video) => {
              const cfg = STATUS_CONFIG[video.status] ?? STATUS_CONFIG.pending
              const { Icon } = cfg
              const feedbackCount = video.feedbacks?.length ?? 0

              return (
                <button
                  key={video.id}
                  onClick={() => router.push(`/review/${token}/${video.id}`)}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-lg hover:shadow-blue-900/20 transition-all group text-left"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gray-800 relative overflow-hidden">
                    {video.signed_url ? (
                      <video
                        src={video.signed_url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film size={36} className="text-gray-600" />
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-white/20 rounded-full p-4 backdrop-blur-sm">
                        <Play size={28} className="text-white" fill="white" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <p className="font-medium text-white text-sm truncate mb-3">{video.title}</p>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>
                      {feedbackCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MessageSquare size={11} />
                          {feedbackCount}件のFB
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
