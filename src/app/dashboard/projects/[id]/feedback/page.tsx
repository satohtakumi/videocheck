import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { FeedbackListClient } from './FeedbackListClient'

export default async function FeedbackListPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: project } = await supabase
    .from('projects')
    .select(`
      id, name, client_name,
      videos (
        id, title, display_order, storage_path,
        feedbacks (
          *,
          feedback_replies (*)
        )
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  // Sort
  if (project.videos) {
    project.videos.sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
    project.videos.forEach((v: { feedbacks?: { timestamp_seconds: number }[] }) => {
      if (v.feedbacks) {
        v.feedbacks.sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
      }
    })
  }

  // 署名付きURLを生成
  const serviceClient = createServiceClient()
  const videosWithUrls = await Promise.all(
    (project.videos ?? []).map(async (v: { storage_path: string; [key: string]: unknown }) => {
      const { data } = await serviceClient.storage
        .from('videos')
        .createSignedUrl(v.storage_path, 3600)
      return { ...v, signed_url: data?.signedUrl ?? null }
    })
  )

  const projectWithUrls = { ...project, videos: videosWithUrls }

  return <FeedbackListClient project={projectWithUrls as Parameters<typeof FeedbackListClient>[0]['project']} projectId={id} />
}
