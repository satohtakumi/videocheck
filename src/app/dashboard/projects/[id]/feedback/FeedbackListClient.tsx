'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, CheckCircle, Circle, Filter, MessageSquare, AlertCircle, Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { formatTimestamp, formatDate } from '@/lib/utils'
import type { Feedback } from '@/types/database'

interface VideoWithFeedbacks {
  id: string
  title: string
  display_order: number
  storage_path: string
  signed_url: string | null
  feedbacks: (Feedback & { feedback_replies: { id: string; text: string; author_name: string | null }[] })[]
}

interface Props {
  project: {
    id: string
    name: string
    client_name: string
    videos: VideoWithFeedbacks[]
  }
  projectId: string
}

export function FeedbackListClient({ project, projectId }: Props) {
  const [filterType, setFilterType] = useState<'all' | 'memo' | 'correction'>('all')
  const [filterResolved, setFilterResolved] = useState<'all' | 'resolved' | 'unresolved'>('all')
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>()
    project.videos.forEach(v => v.feedbacks.forEach(f => { if (f.is_resolved) ids.add(f.id) }))
    return ids
  })
  const [activeVideo, setActiveVideo] = useState<string>('all')

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)

  const activeVideoObj = activeVideo !== 'all'
    ? project.videos.find(v => v.id === activeVideo) ?? null
    : null

  function jumpToTimestamp(seconds: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.pause()
      setPlaying(false)
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = parseFloat(e.target.value)
    if (videoRef.current) videoRef.current.currentTime = t
    setCurrentTime(t)
  }

  const allFeedbacks = project.videos.flatMap(v =>
    v.feedbacks.map(f => ({ ...f, videoTitle: v.title, videoId: v.id }))
  )

  const filtered = allFeedbacks.filter(f => {
    if (activeVideo !== 'all' && f.videoId !== activeVideo) return false
    if (filterType !== 'all' && f.type !== filterType) return false
    if (filterResolved === 'resolved' && !resolvedIds.has(f.id)) return false
    if (filterResolved === 'unresolved' && resolvedIds.has(f.id)) return false
    return true
  })

  const markerPositions = activeVideoObj
    ? activeVideoObj.feedbacks
        .filter(f => {
          if (filterType !== 'all' && f.type !== filterType) return false
          return true
        })
        .map(f => duration > 0 ? (f.timestamp_seconds / duration) * 100 : 0)
    : []

  async function toggleResolved(feedbackId: string) {
    const isNowResolved = !resolvedIds.has(feedbackId)
    const res = await fetch(`/api/feedbacks/${feedbackId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_resolved: isNowResolved }),
    })
    if (res.ok) {
      setResolvedIds(prev => {
        const next = new Set(prev)
        if (isNowResolved) next.add(feedbackId)
        else next.delete(feedbackId)
        return next
      })
    }
  }

  function exportCSV() {
    const rows = [
      ['動画', 'タイムスタンプ', 'タイプ', 'テキスト', '投稿者', '対応済み', '日時'],
      ...filtered.map(f => [
        f.videoTitle,
        formatTimestamp(f.timestamp_seconds),
        f.type === 'correction' ? '修正指示' : 'メモ',
        f.text,
        f.author_name ?? '',
        resolvedIds.has(f.id) ? '済' : '未',
        formatDate(f.created_at),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name}_feedback.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          プロジェクトに戻る
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">フィードバック一覧</h1>
            <p className="text-gray-500 text-sm mt-1">{project.name} — {project.client_name}</p>
          </div>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download size={15} />
            CSV書き出し
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-gray-400" />
            <span className="text-sm text-gray-500">絞り込み:</span>
          </div>

          {/* Video filter */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => { setActiveVideo('all'); setCurrentTime(0); setDuration(0); setPlaying(false) }}
              className={`px-2.5 py-1 rounded-md transition-colors ${activeVideo === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              全動画
            </button>
            {project.videos.map(v => (
              <button
                key={v.id}
                onClick={() => { setActiveVideo(v.id); setCurrentTime(0); setDuration(0); setPlaying(false) }}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${activeVideo === v.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {v.title.length > 15 ? v.title.slice(0, 15) + '…' : v.title}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
            {(['all', 'memo', 'correction'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-md transition-colors ${filterType === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t === 'all' ? '全て' : t === 'memo' ? 'メモ' : '修正指示'}
              </button>
            ))}
          </div>

          {/* Resolved filter */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
            {(['all', 'unresolved', 'resolved'] as const).map(r => (
              <button
                key={r}
                onClick={() => setFilterResolved(r)}
                className={`px-2.5 py-1 rounded-md transition-colors ${filterResolved === r ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {r === 'all' ? '全て' : r === 'unresolved' ? '未対応' : '対応済み'}
              </button>
            ))}
          </div>

          <span className="text-sm text-gray-400 ml-auto">{filtered.length}件</span>
        </div>
      </div>

      {/* Video player (shown when a specific video is selected) */}
      {activeVideoObj && activeVideoObj.signed_url && (
        <div className="bg-gray-900 rounded-xl overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
            <span className="text-sm text-gray-300 font-medium">{activeVideoObj.title}</span>
            <span className="text-xs text-gray-500">クリックでその秒数にジャンプ</span>
          </div>
          <div className="flex flex-col lg:flex-row">
            {/* Video */}
            <div className="flex-1 bg-black flex items-center justify-center" style={{ maxHeight: '360px' }}>
              <video
                ref={videoRef}
                src={activeVideoObj.signed_url}
                className="max-h-[360px] max-w-full object-contain"
                onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime) }}
                onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration) }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={() => { videoRef.current?.paused ? videoRef.current?.play().catch(() => {}) : videoRef.current?.pause() }}
              />
            </div>

            {/* Feedback jump list */}
            <div className="w-full lg:w-72 bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col">
              <div className="px-3 py-2 border-b border-gray-800">
                <span className="text-xs text-gray-400">フィードバック一覧 ({activeVideoObj.feedbacks.length}件)</span>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
                {activeVideoObj.feedbacks.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-8">フィードバックなし</p>
                ) : (
                  activeVideoObj.feedbacks.map(fb => (
                    <button
                      key={fb.id}
                      onClick={() => jumpToTimestamp(fb.timestamp_seconds)}
                      className={`w-full text-left px-3 py-2.5 border-b border-gray-800 hover:bg-gray-800 transition-colors group ${
                        Math.abs(currentTime - fb.timestamp_seconds) < 2 ? 'bg-gray-800' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-blue-400 group-hover:text-blue-300">
                          {formatTimestamp(fb.timestamp_seconds)}
                        </span>
                        <span className={`text-xs px-1 rounded ${
                          fb.type === 'correction' ? 'text-orange-400 bg-orange-900/30' : 'text-gray-400 bg-gray-700'
                        }`}>
                          {fb.type === 'correction' ? '修正' : 'メモ'}
                        </span>
                        {resolvedIds.has(fb.id) && (
                          <CheckCircle size={10} className="text-green-500 ml-auto" />
                        )}
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{fb.text}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="px-4 py-3 border-t border-gray-800">
            {/* Seekbar with markers */}
            <div className="relative mb-2">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 appearance-none bg-gray-700 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                style={{
                  background: duration > 0
                    ? `linear-gradient(to right, #3b82f6 ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%)`
                    : '#374151',
                }}
              />
              {markerPositions.map((pos, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 pointer-events-none"
                  style={{ left: `${pos}%` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => videoRef.current?.paused ? videoRef.current?.play().catch(() => {}) : videoRef.current?.pause()}
                className="text-white hover:text-blue-400 transition-colors"
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; setMuted(m => !m) }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <span className="text-xs text-gray-400 font-mono">
                {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Feedback list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <MessageSquare size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">フィードバックがありません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="w-10 px-4 py-3"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">時刻</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-20">種別</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">動画</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">コメント</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell w-24">投稿者</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell w-28">日時</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(fb => (
                <tr
                  key={fb.id}
                  className={`hover:bg-gray-50 transition-colors ${resolvedIds.has(fb.id) ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleResolved(fb.id)}
                      className={`transition-colors ${resolvedIds.has(fb.id) ? 'text-green-500 hover:text-gray-400' : 'text-gray-300 hover:text-green-500'}`}
                      title={resolvedIds.has(fb.id) ? '未対応に戻す' : '対応済みにする'}
                    >
                      {resolvedIds.has(fb.id) ? <CheckCircle size={18} /> : <Circle size={18} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {activeVideo === fb.videoId ? (
                      <button
                        onClick={() => jumpToTimestamp(fb.timestamp_seconds)}
                        className="text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline"
                        title="動画のこの位置にジャンプ"
                      >
                        {formatTimestamp(fb.timestamp_seconds)}
                      </button>
                    ) : (
                      <span className="text-sm font-mono text-blue-600">
                        {formatTimestamp(fb.timestamp_seconds)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${
                      fb.type === 'correction'
                        ? 'bg-orange-50 text-orange-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {fb.type === 'correction' ? <AlertCircle size={10} /> : <MessageSquare size={10} />}
                      {fb.type === 'correction' ? '修正' : 'メモ'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell truncate max-w-[140px]">
                    {fb.videoTitle}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900 leading-relaxed">{fb.text}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell">
                    {fb.author_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                    {formatDate(fb.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
