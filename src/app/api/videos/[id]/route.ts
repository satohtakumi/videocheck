import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Verify ownership through project
  const { data: video } = await supabase
    .from('videos')
    .select('id, projects(user_id)')
    .eq('id', id)
    .single()

  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('videos')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ video: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get storage path before deleting
  const { data: video } = await supabase
    .from('videos')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete from storage
  const serviceClient = createServiceClient()
  await serviceClient.storage.from('videos').remove([video.storage_path])

  // Delete record
  const { error } = await supabase.from('videos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
