import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; videoId: string }> }
) {
  const { token, videoId } = await params
  const supabase = createServiceClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, share_expires_at, user_id')
    .eq('share_token', token)
    .single()

  if (!project) return NextResponse.json({ error: 'Invalid share link' }, { status: 404 })
  if (project.share_expires_at && new Date(project.share_expires_at) < new Date())
    return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })

  const { data: video } = await supabase
    .from('videos')
    .select('id, status, title')
    .eq('id', videoId)
    .eq('project_id', project.id)
    .single()

  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

  const { status, rejection_reason } = await request.json()

  const { data: updatedVideo, error: videoError } = await supabase
    .from('videos')
    .update({ status, ...(rejection_reason !== undefined ? { rejection_reason } : {}) })
    .eq('id', videoId)
    .select()
    .single()

  if (videoError) return NextResponse.json({ error: videoError.message }, { status: 500 })

  if (status === 'rejected') {
    await supabase.from('projects').update({ status: 'in_revision' }).eq('id', project.id)
  } else if (status === 'approved') {
    const { data: allVideos } = await supabase.from('videos').select('id, status').eq('project_id', project.id)
    const allApproved = allVideos?.every(v => v.id === videoId ? true : v.status === 'approved') ?? false
    await supabase.from('projects').update({ status: allApproved ? 'approved' : 'pending_review' }).eq('id', project.id)
  }

  if (resend && project.user_id) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(project.user_id)
      const adminEmail = userData?.user?.email
      if (adminEmail) {
        const isOk = status === 'approved'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'VideoCheck <onboarding@resend.dev>',
          to: adminEmail,
          subject: `[VideoCheck] ${project.name} - ${video.title} に${isOk ? 'OK' : 'NG'}が付きました`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;"><h2 style="color:#1f2937;">${isOk ? '✅ OK（承認）' : '❌ NG（差し戻し）'}</h2><p style="color:#6b7280;font-size:14px;">クライアントがレビューを行いました</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/><table style="width:100%;font-size:14px;color:#374151;"><tr><td style="padding:6px 0;color:#6b7280;">プロジェクト</td><td style="font-weight:600;">${project.name}</td></tr><tr><td style="padding:6px 0;color:#6b7280;">動画</td><td style="font-weight:600;">${video.title}</td></tr><tr><td style="padding:6px 0;color:#6b7280;">判定</td><td style="font-weight:600;color:${isOk ? '#16a34a' : '#dc2626'};">${isOk ? 'OK' : 'NG'}</td></tr>${rejection_reason ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">差し戻し理由</td><td>${rejection_reason}</td></tr>` : ''}</table>${appUrl ? `<div style="margin-top:24px;"><a href="${appUrl}/dashboard/projects/${project.id}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">ダッシュボードで確認</a></div>` : ''}</div>`,
        })
      }
    } catch (e) {
      console.error('Email send failed:', e)
    }
  }

  return NextResponse.json({ video: updatedVideo })
}
