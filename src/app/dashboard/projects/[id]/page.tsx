import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProjectDetailClient } from './ProjectDetailClient'

export default async function ProjectDetailPage({
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
      *,
      videos (
        *,
        feedbacks (id)
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  // Sort videos by display_order
  if (project.videos) {
    project.videos.sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
  }

  // Generate signed URLs for existing videos
  const serviceClient = createServiceClient()
  const videosWithUrls = await Promise.all(
    (project.videos ?? []).map(async (v: { storage_path: string }) => {
      const { data } = await serviceClient.storage
        .from('videos')
        .createSignedUrl(v.storage_path, 3600)
      return { ...v, signed_url: data?.signedUrl ?? null }
    })
  )

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/review/${project.share_token}`

  return (
    <ProjectDetailClient
      project={{ ...project, videos: videosWithUrls }}
      shareUrl={shareUrl}
    />
  )
}
