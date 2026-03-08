import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  pending_review: 'レビュー待ち',
  in_revision: '修正中',
  approved: '承認済み',
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_review: 'bg-blue-100 text-blue-700',
  in_revision: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
}

export const VIDEO_STATUS_LABELS: Record<string, string> = {
  pending: 'レビュー中',
  approved: '承認',
  rejected: '差し戻し',
}

export const VIDEO_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}
