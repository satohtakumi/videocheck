'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  shareToken: string
}

export function CopyLinkButton({ shareToken }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/review/${shareToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="クライアント共有リンクをコピー"
      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    >
      {copied
        ? <Check size={15} className="text-green-600" />
        : <Copy size={15} />}
    </button>
  )
}
