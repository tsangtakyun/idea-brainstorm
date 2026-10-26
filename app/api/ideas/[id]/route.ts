import { NextRequest, NextResponse } from 'next/server'

import { createAdminSupabase } from '@/lib/admin-supabase'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Idea id required' }, { status: 400 })
  }

  const update = await req.json()
  const allowed = [
    'title',
    'topic',
    'summary',
    'description',
    'tags',
    'country',
    'region',
    'place_name',
    'place_address',
    'shop_highlights',
    'thumb',
    'updated_at',
  ]
  const payload = Object.fromEntries(
    Object.entries(update).filter(([key]) => allowed.includes(key))
  )

  const { data, error } = await supabase
    .from('ideas')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ idea: data })
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Idea id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ideas')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, id })
}
