import { NextRequest, NextResponse } from 'next/server'

import { createAdminSupabase } from '@/lib/admin-supabase'

export async function POST(request: NextRequest) {
  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const body = await request.json()
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : ''
  const invitedBy = typeof body.invitedBy === 'string' ? body.invitedBy.trim() : ''
  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''

  if (!roomId || !invitedBy || !userId) {
    return NextResponse.json({ error: 'roomId, invitedBy and userId required' }, { status: 400 })
  }

  const { data: inviter, error: inviterError } = await supabase
    .from('topic_room_members')
    .select('id,role')
    .eq('room_id', roomId)
    .eq('user_id', invitedBy)
    .maybeSingle()

  if (inviterError) {
    return NextResponse.json({ error: inviterError.message }, { status: 500 })
  }

  if (!inviter?.id) {
    return NextResponse.json({ error: '你未係呢個 Room 成員' }, { status: 403 })
  }

  const { data: friendship, error: friendshipError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', invitedBy)
    .eq('following_id', userId)
    .maybeSingle()

  if (friendshipError) {
    return NextResponse.json({ error: friendshipError.message }, { status: 500 })
  }

  if (!friendship) {
    return NextResponse.json({ error: '請先加對方做好友' }, { status: 403 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,username,display_name')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!profile?.id) {
    return NextResponse.json({ error: '搵唔到呢位好友' }, { status: 404 })
  }

  const { data: existing, error: existingError } = await supabase
    .from('topic_room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  if (existing?.id) {
    return NextResponse.json({ member: existing, profile, alreadyMember: true })
  }

  const { data, error } = await supabase
    .from('topic_room_members')
    .insert({
      room_id: roomId,
      user_id: userId,
      role: 'member',
    })
    .select('id,room_id,user_id,role')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ member: data, profile, alreadyMember: false })
}
