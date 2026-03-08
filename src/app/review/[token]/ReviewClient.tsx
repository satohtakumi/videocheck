'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play, Pause, Volume2, VolumeX,
  Send, CheckCircle, XCircle, Pencil, Trash2, MessageSquare, AlertCircle, ChevronLeft
} from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'
import type { Project, Video, Feedback, FeedbackType, VideoStatus } from '@/types/database'

type VideoWithUrl = Omit<Video, 'feedbacks'> & { signed_url: string | null; feedbacks: Feedback[] }
type ProjectWithVideos = Omit<Project, 'videos'> & { videos: VideoWithUrl[] }

interface Props {
  project: ProjectWithVideos
  initialVideoIndex: number
  token: string
}

export function ReviewClient({ project, initialVideoIndex, token }: Props) {
  const router = useRouter()
  const activeVideo = project.videos[initialVideoIndex]

  const [feedbacks, setFeedbacks] = useState<Feedback[]>(activeVideo?.feedbacks ?? [])
  const [videoStatus, setVideoStatus] = useState<VideoStatus>(activeVideo?.status ?? 'pending')
  const [authorName, setAuthorName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vc_author') ?? ''
    }
    return ''
  })
  const [inputText, setInputText] = useState('')
  const [inputType, setInputType] = useState<FeedbackType>('correction')
  const [submitting, setSubmitting] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const v = videoRef.current
      if (!v) return
      if (e.key === 'ArrowLeft') { v.currentTime = Math.max(0, v.currentTime - 1); e.preventDefault() }
      if (e.key === 'ArrowRight') { v.currentTime = Math.min(v.duration, v.currentTime + 1); e.preventDefault() }
      if (e.key === 'j') { v.currentTime = Math.max(0, v.currentTime - 10); e.preventDefault() }
      if (e.key === 'l') { v.currentTime = Math.min(v.duration, v.currentTime + 10); e.preventDefault() }
      if (e.key === ' ') { v.paused ? v.play().catch(() => {}) : v.pause(); e.preventDefault() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Save author name
  useEffect(() => {
    if (typeof window !== 'undefined' && authorName) {
      localStorage.setItem('vc_author', authorName)
    }
  }, [authorName])

  function handleTimeUpdate() {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
  }

  function handleLoadedMetadata() {
    if (videoRef.current) setDuration(videoRef.current.duration)
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = parseFloat(e.target.value)
    if (videoRef.current) videoRef.current.currentTime = t
    setCurrentTime(t)
  }

  function jumpToTimestamp(seconds: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.pause()
      setPlaying(false)
    }
  }

  async function handleSubmitFeedback() {
    if (!inputText.trim() || !activeVideo) return
    setSubmitting(true)

    const res = await fetch('/api/feedbacks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: activeVideo.id,
        type: inputType,
        timestamp_seconds: currentTime,
        text: inputText.trim(),
        author_name: authorName.trim() || null,
      }),
    })

    if (res.ok) {
      const { feedback } = await res.json()
      setFeedbacks(prev =>
        [...prev, feedback].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
      )
      setInputText('')
    }
    setSubmitting(false)
  }

  async function handleDeleteFeedback(feedbackId: string) {
    if (!confirm('このフィードバックを削除しますか？')) return
    const res = await fetch(`/api/feedbacks/${feedbackId}`, { method: 'DELETE' })
    if (res.ok) {
      setFeedbacks(prev => prev.filter(f => f.id !== feedbackId))
    }
  }

  async function handleEditSubmit(feedbackId: string) {
    const res = await fetch(`/api/feedbacks/${feedbackId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editText }),
    })
    if (res.ok) {
      setFeedbacks(prev => prev.map(f => f.id === feedbackId ? { ...f, text: editText } : f))
      setEditingId(null)
    }
  }

  async function handleApprove() {
    if (!activeVideo) return
    const res = await fetch(`/api/review/${token}/videos/${activeVideo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    if (res.ok) setVideoStatus('approved')
  }

  async function handleReject() {
    if (!activeVideo) return
    const res = await fetch(`/api/review/${token}/videos/${activeVideo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejection_reason: rejectReason }),
    })
    if (res.ok) {
      setVideoStatus('rejected')
      setRejectModal(false)
      setRejectReason('')
    }
  }

  const markerPositions = feedbacks.map(f =>
    duration > 0 ? (f.timestamp_seconds / duration) * 100 : 0
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* 戻るボタン */}
            <button
              onClick={() => router.push(`/review/${token}`)}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm shrink-0"
            >
              <ChevronLeft size={18} />
              <span className="hidden sm:inline">一覧</span>
            </button>

            <div className="bg-blue-600 rounded-lg p-1.5 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-white truncate">{activeVideo?.title}</h1>
              <p className="text-xs text-gray-400">{project.name}</p>
            </div>
          </div>

          {/* Approve/Reject */}
          {activeVideo && (
            <div className="flex items-center gap-2 shrink-0">
              {videoStatus === 'approved' && (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-green-400 bg-green-900/40 border border-green-600 px-4 py-2 rounded-lg">
                  <CheckCircle size={16} /> 承認済み
                </span>
              )}
              {videoStatus === 'rejected' && (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-400 bg-red-900/40 border border-red-600 px-4 py-2 rounded-lg">
                  <XCircle size={16} /> 差し戻し
                </span>
              )}
              {videoStatus === 'pending' && (
                <>
                  <button
                    onClick={handleApprove}
                    className="inline-flex items-center gap-2 text-sm font-bold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-green-900/40"
                  >
                    <CheckCircle size={16} /> OK
                  </button>
                  <button
                    onClick={() => setRejectModal(true)}
                    className="inline-flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-red-900/40"
                  >
                    <XCircle size={16} /> NG
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Video area */}
        <div className="flex-1 flex flex-col bg-black min-h-0">
          {activeVideo?.signed_url ? (
            <div className="flex items-center justify-center relative bg-black" style={{ height: 'calc(100vh - 52px - 80px)' }}>
              <video
                ref={videoRef}
                src={activeVideo.signed_url}
                className="max-h-full max-w-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={() => {
                  videoRef.current?.paused ? videoRef.current?.play().catch(() => {}) : videoRef.current?.pause()
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <div className="text-center">
                <AlertCircle size={48} className="mx-auto mb-3" />
                <p>動画を読み込めませんでした</p>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="bg-gray-900 border-t border-gray-800 px-4 py-3">
            {/* Seekbar with markers */}
            <div className="relative mb-3">
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
              {/* Timeline markers */}
              {markerPositions.map((pos, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 pointer-events-none"
                  style={{ left: `${pos}%` }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => videoRef.current?.paused ? videoRef.current?.play().catch(() => {}) : videoRef.current?.pause()}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  {playing ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; setMuted(m => !m) }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <span className="text-xs text-gray-400 font-mono">
                  {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>←→: ±1s</span>
                <span>J/L: ±10s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Feedback panel */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-800 bg-gray-900 flex flex-col max-h-screen lg:max-h-full overflow-hidden">
          {/* Input area */}
          <div className="p-4 border-b border-gray-800">
            <div className="mb-3">
              <input
                type="text"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="お名前（任意）"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Type toggle */}
            <div className="flex bg-gray-800 rounded-lg p-0.5 mb-3">
              <button
                onClick={() => setInputType('memo')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  inputType === 'memo' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare size={12} className="inline mr-1" />
                メモ
              </button>
              <button
                onClick={() => setInputType('correction')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  inputType === 'correction' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <AlertCircle size={12} className="inline mr-1" />
                修正指示
              </button>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-blue-400 font-mono bg-blue-900/30 px-2 py-0.5 rounded">
                    {formatTimestamp(currentTime)}
                  </span>
                  <span className="text-xs text-gray-500">現在位置</span>
                </div>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmitFeedback()
                  }}
                  placeholder={inputType === 'memo' ? 'メモを入力...' : '修正内容を入力...'}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <button
              onClick={handleSubmitFeedback}
              disabled={submitting || !inputText.trim()}
              className="mt-2 w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Send size={14} />
              {submitting ? '送信中...' : '送信 (Ctrl+Enter)'}
            </button>
          </div>

          {/* Feedback list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {feedbacks.length === 0 ? (
              <div className="text-center text-gray-600 py-8 text-sm">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                <p>フィードバックはまだありません</p>
                <p className="text-xs mt-1">動画を再生しながらメモを追加しましょう</p>
              </div>
            ) : (
              feedbacks.map(fb => (
                <div key={fb.id} className="bg-gray-800 rounded-lg p-3 group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => jumpToTimestamp(fb.timestamp_seconds)}
                        className="text-xs font-mono text-blue-400 hover:text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded transition-colors"
                      >
                        {formatTimestamp(fb.timestamp_seconds)}
                      </button>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        fb.type === 'correction' ? 'bg-orange-900/50 text-orange-400' : 'bg-gray-700 text-gray-400'
                      }`}>
                        {fb.type === 'correction' ? '修正' : 'メモ'}
                      </span>
                      {fb.author_name && (
                        <span className="text-xs text-gray-500">{fb.author_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditingId(fb.id); setEditText(fb.text) }}
                        className="text-gray-500 hover:text-gray-300 p-1"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteFeedback(fb.id)}
                        className="text-gray-500 hover:text-red-400 p-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {editingId === fb.id ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={2}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => handleEditSubmit(fb.id)}
                          className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-gray-400 hover:text-white px-2.5 py-1"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-200 leading-relaxed">{fb.text}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-white mb-1">差し戻し理由</h3>
            <p className="text-sm text-gray-400 mb-4">差し戻す理由を入力してください</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="修正してほしい内容を具体的に..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectModal(false); setRejectReason('') }}
                className="flex-1 border border-gray-600 text-gray-300 rounded-lg py-2 text-sm hover:bg-gray-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleReject}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700"
              >
                差し戻し
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
