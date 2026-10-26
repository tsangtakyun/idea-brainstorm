import { NextRequest, NextResponse } from 'next/server'

import { createAdminSupabase } from '@/lib/admin-supabase'

function normalizeUsername(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/^@/, '').toLowerCase()
    : ''
}

export async function POST(request: NextRequest) {
  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const body = await request.json()
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : ''
  const invitedBy = typeof body.invitedBy === 'string' ? body.invitedBy.trim() : ''
  const username = normalizeUsername(body.username)

  if (!workspaceId || !invitedBy || !username) {
    return NextResponse.json({ error: 'workspaceId, invitedBy and username required' }, { status: 400 })
  }

  const { data: inviter, error: inviterError } = await supabase
    .from('workspace_members')
    .select('id,role,status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', invitedBy)
    .eq('status', 'active')
    .maybeSingle()

  if (inviterError) {
    return NextResponse.json({ error: inviterError.message }, { status: 500 })
  }

  if (!inviter?.id) {
    return NextResponse.json({ error: '你未係呢個 workspace 成員' }, { status: 403 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,username,display_name')
    .eq('username', username)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!profile?.id) {
    return NextResponse.json({ error: `搵唔到 @${username}` }, { status: 404 })
  }

  const { data: existing, error: existingError } = await supabase
    .from('workspace_members')
    .select('id,status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('workspace_members')
      .update({
        role: 'member',
        status: 'active',
        display_name: profile.display_name || profile.username,
        invited_by: invitedBy,
      })
      .eq('id', existing.id)
      .select('id,user_id,email,display_name,role,status')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ member: data, alreadyMember: true })
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: profile.id,
      email: null,
      display_name: profile.display_name || profile.username,
      role: 'member',
      status: 'active',
      invited_by: invitedBy,
    })
    .select('id,user_id,email,display_name,role,status')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ member: data, alreadyMember: false })
}
