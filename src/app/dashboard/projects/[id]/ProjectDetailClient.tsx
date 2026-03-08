'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Upload, Copy, Check, ExternalLink, Film, Trash2,
  Link2, ChevronDown
} from 'lucide-react'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, VIDEO_STATUS_LABELS, VIDEO_STATUS_COLORS, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Project, Video, ProjectStatus } from '@/types/database'

const PROJECT_STATUSES: ProjectStatus[] = ['draft', 'pending_review', 'in_revision', 'approved']

type VideoWithExtras = Omit<Video, ''> & { feedbacks: { id: string }[]; signed_url: string | null }

interface Props {
  project: Omit<Project, 'videos'> & { videos: VideoWithExtras[] }
  shareUrl: string
}

interface UploadingFile {
  name: string
  progress: number   // 0-100
  done: boolean
  error: boolean
}

export function ProjectDetailClient({ project: initialProject, shareUrl: initialShareUrl }: Props) {
  const router = useRouter()
  const [project, setProject] = useState(initialProject)
  const [shareUrl, setShareUrl] = useState(initialShareUrl)

  // ブラウザのオリジンを使って正確なURLを構築（NEXT_PUBLIC_APP_URL不要）
  useEffect(() => {
    setShareUrl(`${window.location.origin}/review/${initialProject.share_token}`)
  }, [initialProject.share_token])
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [statusDropdown, setStatusDropdown] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isUploading = uploadingFiles.some(f => !f.done && !f.error)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = 5 - project.videos.length
    if (files.length > remaining) {
      alert(`あと${remaining}本まで追加できます`)
      return
    }

    // 初期状態を設定
    setUploadingFiles(files.map(f => ({ name: f.name, progress: 0, done: false, error: false })))

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('ログインが必要です'); setUploadingFiles([]); return }

    let anyError = false
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()
      const storagePath = `${user.id}/${project.id}/${Date.now()}.${ext}`

      // ① Supabase Storageへ直接アップロード（XHRで進捗取得）
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${storagePath}`

      const uploadError = await new Promise<string | null>((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 90)
            setUploadingFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, progress: pct } : f
            ))
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(null)
          else resolve(`HTTP ${xhr.status}: ${xhr.responseText}`)
        })
        xhr.addEventListener('error', () => resolve('ネットワークエラー'))
        xhr.open('POST', uploadUrl)
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.send(file)
      })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        anyError = true
        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, error: true, done: true } : f
        ))
        continue
      }

      // ② メタデータをDBに保存（残り10%）
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          title: file.name.replace(/\.[^/.]+$/, ''),
          storage_path: storagePath,
          display_order: project.videos.length + i,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        let message = `DB保存エラー (${res.status})`
        try { const j = JSON.parse(text); if (j.error) message = j.error } catch {}
        alert(message)
        anyError = true
        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, error: true, done: true } : f
        ))
      } else {
        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 100, done: true } : f
        ))
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = ''

    if (!anyError) {
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3500)
    }

    // 1秒後にリフレッシュしてUI更新
    setTimeout(() => {
      setUploadingFiles([])
      router.refresh()
    }, 1200)
  }

  async function handleDelete(videoId: string) {
    if (!confirm('この動画を削除しますか？')) return
    setDeletingId(videoId)
    await fetch(`/api/videos/${videoId}`, { method: 'DELETE' })
    setDeletingId(null)
    router.refresh()
  }

  async function handleStatusChange(status: ProjectStatus) {
    setStatusDropdown(false)
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setProject(p => ({ ...p, status }))
    }
  }

  async function handleDeleteProject() {
    if (!confirm('プロジェクトを削除しますか？この操作は元に戻せません。')) return
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/dashboard')
  }

  async function copyShareUrl() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyVideoUrl(videoId: string) {
    await navigator.clipboard.writeText(`${shareUrl}/${videoId}`)
    setCopiedVideoId(videoId)
    setTimeout(() => setCopiedVideoId(null), 2000)
  }

  return (
    <div>
      {/* Upload success toast */}
      {uploadSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <Check size={14} />
          </div>
          <div>
            <p className="font-medium text-sm">アップロードが完了しました</p>
            <p className="text-xs text-green-100 mt-0.5">動画が正常に保存されました</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          ダッシュボードに戻る
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-500 text-sm mt-1">
              クライアント: {project.client_name}
              {project.deadline && ` • 期限: ${formatDate(project.deadline)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Status selector */}
            <div className="relative">
              <button
                onClick={() => setStatusDropdown(!statusDropdown)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${PROJECT_STATUS_COLORS[project.status]} transition-colors`}
              >
                {PROJECT_STATUS_LABELS[project.status]}
                <ChevronDown size={14} />
              </button>
              {statusDropdown && (
                <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-36">
                  {PROJECT_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${project.status === s ? 'font-medium' : ''}`}
                    >
                      {PROJECT_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteProject}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Videos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Film size={18} />
                動画 ({project.videos.length}/5)
              </h2>
              {project.videos.length < 5 && (
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload size={14} />
                  動画を追加
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* アップロード進捗 */}
            {uploadingFiles.length > 0 && (
              <div className="mb-3 space-y-2">
                {uploadingFiles.map((uf, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${uf.error ? 'border-red-200 bg-red-50' : 'border-blue-100 bg-blue-50'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {uf.done && !uf.error ? (
                          <Check size={14} className="text-green-500 shrink-0" />
                        ) : uf.error ? (
                          <span className="text-red-500 text-xs shrink-0">✕</span>
                        ) : (
                          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                        )}
                        <span className="text-xs text-gray-700 truncate">{uf.name}</span>
                      </div>
                      <span className={`text-xs font-medium ml-2 shrink-0 ${uf.error ? 'text-red-600' : uf.done ? 'text-green-600' : 'text-blue-600'}`}>
                        {uf.error ? 'エラー' : uf.done ? '完了' : `${uf.progress}%`}
                      </span>
                    </div>
                    {!uf.error && (
                      <div className="h-1.5 bg-white rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${uf.done ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${uf.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {project.videos.length === 0 && uploadingFiles.length === 0 ? (
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium text-gray-600">動画をアップロード</p>
                <p className="text-xs text-gray-400 mt-1">MP4, MOV, WebM / 最大1GB / 最大5本</p>
              </div>
            ) : (
              <div className="space-y-3">
                {project.videos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    {video.signed_url ? (
                      <video
                        src={video.signed_url}
                        className="w-20 h-14 object-cover rounded bg-gray-200 shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-14 bg-gray-200 rounded flex items-center justify-center shrink-0">
                        <Film size={20} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{video.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={VIDEO_STATUS_COLORS[video.status]}>
                          {VIDEO_STATUS_LABELS[video.status]}
                        </Badge>
                        {video.feedbacks?.length > 0 && (
                          <span className="text-xs text-gray-400">
                            FB: {video.feedbacks.length}件
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyVideoUrl(video.id)}
                      className="text-gray-400 hover:text-blue-600 shrink-0"
                      title="この動画のリンクをコピー"
                    >
                      {copiedVideoId === video.id
                        ? <Check size={14} className="text-green-600" />
                        : <Link2 size={14} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(video.id)}
                      disabled={deletingId === video.id}
                      className="text-gray-400 hover:text-red-600 shrink-0"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}

                {project.videos.length < 5 && uploadingFiles.length === 0 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full border-2 border-dashed border-gray-200 rounded-lg p-4 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload size={14} />
                    さらに追加 (あと{5 - project.videos.length}本)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Share & Info */}
        <div className="space-y-4">
          {/* Share link */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Link2 size={18} />
              クライアント共有リンク
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-600 min-w-0"
              />
              <Button size="sm" variant="outline" onClick={copyShareUrl}>
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </Button>
            </div>
            <Link
              href={shareUrl}
              target="_blank"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
            >
              <ExternalLink size={12} />
              プレビューを開く
            </Link>
          </div>

          {/* Feedback summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">フィードバック</h2>
              <Link
                href={`/dashboard/projects/${project.id}/feedback`}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                一覧を見る
              </Link>
            </div>
            {project.videos.reduce((acc, v) => acc + (v.feedbacks?.length ?? 0), 0) === 0 ? (
              <p className="text-sm text-gray-400">フィードバックはまだありません</p>
            ) : (
              <div className="space-y-2">
                {project.videos.map(v => (
                  v.feedbacks?.length > 0 && (
                    <div key={v.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 truncate flex-1">{v.title}</span>
                      <span className="text-sm font-medium text-gray-900 ml-2">
                        {v.feedbacks.length}件
                      </span>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
