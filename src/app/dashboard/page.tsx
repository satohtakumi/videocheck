import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Film, Clock, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, VIDEO_STATUS_LABELS, VIDEO_STATUS_COLORS, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import type { Project, ProjectStatus, VideoStatus } from '@/types/database'

type VideoRow = {
  id: string
  title: string
  status: VideoStatus
  created_at: string
  project_id: string
  project_name: string
  client_name: string
}

const VIDEO_STATUS_CARDS: { status: VideoStatus; label: string; icon: React.ReactNode; bg: string; border: string; activeBorder: string }[] = [
  {
    status: 'pending',
    label: '確認待ち',
    icon: <Clock size={16} />,
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    activeBorder: 'border-yellow-500 ring-2 ring-yellow-200',
  },
  {
    status: 'rejected',
    label: '差し戻し（修正中）',
    icon: <XCircle size={16} />,
    bg: 'bg-red-50',
    border: 'border-red-200',
    activeBorder: 'border-red-500 ring-2 ring-red-200',
  },
  {
    status: 'approved',
    label: '承認済み',
    icon: <CheckCircle size={16} />,
    bg: 'bg-green-50',
    border: 'border-green-200',
    activeBorder: 'border-green-500 ring-2 ring-green-200',
  },
]

const VIDEO_STATUS_TEXT: Record<VideoStatus, string> = {
  pending: 'text-yellow-700',
  rejected: 'text-red-700',
  approved: 'text-green-700',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { status: filterParam, view } = await searchParams
  const videoStatusFilter = (filterParam as VideoStatus) || null
  const showVideoView = videoStatusFilter !== null || view === 'videos'

  // プロジェクト一覧（プロジェクトビュー用）
  const { data: projects } = await supabase
    .from('projects')
    .select('*, videos(id, status, title)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // 動画ステータス集計
  const videoCounts: Record<VideoStatus, number> = { pending: 0, approved: 0, rejected: 0 }
  const allVideos: VideoRow[] = []

  projects?.forEach(p => {
    (p.videos as { id: string; title: string; status: VideoStatus; created_at?: string }[] ?? []).forEach(v => {
      videoCounts[v.status]++
      allVideos.push({
        id: v.id,
        title: v.title,
        status: v.status,
        created_at: v.created_at ?? '',
        project_id: p.id,
        project_name: p.name,
        client_name: p.client_name,
      })
    })
  })

  // 動画フィルタリング
  const filteredVideos = videoStatusFilter
    ? allVideos.filter(v => v.status === videoStatusFilter)
    : allVideos

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-gray-500 text-sm mt-1">プロジェクト・動画の進捗確認</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          新規プロジェクト
        </Link>
      </div>

      {/* ビュー切り替えタブ */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <Link
          href="/dashboard"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !showVideoView ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          プロジェクト一覧
        </Link>
        <Link
          href="/dashboard?view=videos"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            showVideoView ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          動画ステータス
        </Link>
      </div>

      {showVideoView ? (
        /* ===== 動画ステータスビュー ===== */
        <>
          {/* 動画ステータスカード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {VIDEO_STATUS_CARDS.map(({ status, label, icon, bg, border, activeBorder }) => {
              const isActive = videoStatusFilter === status
              const count = videoCounts[status]
              return (
                <Link
                  key={status}
                  href={isActive ? '/dashboard?view=videos' : `/dashboard?status=${status}`}
                  className={`block bg-white rounded-xl border p-4 transition-all hover:shadow-md ${
                    isActive ? activeBorder + ' shadow-md' : border + ' hover:border-gray-300'
                  }`}
                >
                  <div className={`flex items-center justify-between mb-3`}>
                    <span className="text-sm font-medium text-gray-600">{label}</span>
                    <span className={`p-1.5 rounded-lg ${bg}`}>
                      <span className={VIDEO_STATUS_TEXT[status]}>{icon}</span>
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className={`text-3xl font-bold ${isActive ? VIDEO_STATUS_TEXT[status] : 'text-gray-900'}`}>
                      {count}
                      <span className="text-base font-normal text-gray-400 ml-1">本</span>
                    </div>
                    {count > 0 && (
                      <span className={`text-xs mb-1 ${isActive ? VIDEO_STATUS_TEXT[status] : 'text-gray-400'}`}>
                        {isActive ? '▼ 絞込中' : 'クリックで絞込'}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* 絞り込み中ラベル */}
          {videoStatusFilter && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600">
                絞り込み中:
                <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${VIDEO_STATUS_COLORS[videoStatusFilter]}`}>
                  {VIDEO_STATUS_LABELS[videoStatusFilter]}
                </span>
              </span>
              <Link href="/dashboard?view=videos" className="text-xs text-gray-400 hover:text-gray-600 underline">
                すべて表示
              </Link>
            </div>
          )}

          {/* 動画リスト */}
          {filteredVideos.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <Film size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">
                {videoStatusFilter
                  ? `${VIDEO_STATUS_LABELS[videoStatusFilter]}の動画はありません`
                  : '動画がまだありません'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">動画タイトル</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">プロジェクト</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">クライアント</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVideos.map(video => (
                    <tr key={video.id} className="hover:bg-blue-50 transition-colors cursor-pointer">
                      <td className="p-0">
                        <Link href={`/dashboard/projects/${video.project_id}`} className="block px-6 py-4 font-medium text-gray-900 text-sm">
                          {video.title}
                        </Link>
                      </td>
                      <td className="p-0 hidden sm:table-cell">
                        <Link href={`/dashboard/projects/${video.project_id}`} className="block px-6 py-4 text-sm text-gray-500">
                          {video.project_name}
                        </Link>
                      </td>
                      <td className="p-0 hidden md:table-cell">
                        <Link href={`/dashboard/projects/${video.project_id}`} className="block px-6 py-4 text-sm text-gray-500">
                          {video.client_name}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={`/dashboard/projects/${video.project_id}`} className="block px-6 py-4">
                          <Badge className={VIDEO_STATUS_COLORS[video.status]}>
                            {VIDEO_STATUS_LABELS[video.status]}
                          </Badge>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <ExternalLink size={15} className="text-gray-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* ===== プロジェクト一覧ビュー ===== */
        <>
          {/* プロジェクトステータス集計カード */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {(['draft', 'pending_review', 'in_revision', 'approved'] as ProjectStatus[]).map(status => {
              const count = projects?.filter(p => p.status === status).length ?? 0
              return (
                <div key={status} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">{PROJECT_STATUS_LABELS[status]}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                </div>
              )
            })}
          </div>

          {!projects || projects.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <div className="bg-blue-50 rounded-full p-4 inline-flex mb-4">
                <Film size={32} className="text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">プロジェクトがありません</h2>
              <p className="text-gray-500 text-sm mb-6">
                最初のプロジェクトを作成して動画レビューを始めましょう
              </p>
              <Link
                href="/dashboard/projects/new"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                プロジェクトを作成
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">プロジェクト名</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">クライアント</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">動画数</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">期限</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">更新日</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">リンク</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projects.map((project: Project & { videos: { id: string }[] }) => (
                    <tr key={project.id} className="hover:bg-blue-50 transition-colors cursor-pointer">
                      <td className="p-0">
                        <Link href={`/dashboard/projects/${project.id}`} className="block px-6 py-4 font-medium text-gray-900 text-sm">
                          {project.name}
                        </Link>
                      </td>
                      <td className="p-0 hidden sm:table-cell">
                        <Link href={`/dashboard/projects/${project.id}`} className="block px-6 py-4 text-sm text-gray-500">
                          {project.client_name}
                        </Link>
                      </td>
                      <td className="p-0 hidden md:table-cell">
                        <Link href={`/dashboard/projects/${project.id}`} className="block px-6 py-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Film size={14} />
                            {project.videos?.length ?? 0} / 10
                          </div>
                        </Link>
                      </td>
                      <td className="p-0 hidden md:table-cell">
                        <Link href={`/dashboard/projects/${project.id}`} className="block px-6 py-4 text-sm text-gray-500">
                          {project.deadline ? formatDate(project.deadline) : '—'}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={`/dashboard/projects/${project.id}`} className="block px-6 py-4">
                          <Badge className={PROJECT_STATUS_COLORS[project.status as ProjectStatus]}>
                            {PROJECT_STATUS_LABELS[project.status]}
                          </Badge>
                        </Link>
                      </td>
                      <td className="p-0 hidden lg:table-cell">
                        <Link href={`/dashboard/projects/${project.id}`} className="block px-6 py-4 text-sm text-gray-500">
                          {formatDate(project.updated_at)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CopyLinkButton shareToken={project.share_token} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
