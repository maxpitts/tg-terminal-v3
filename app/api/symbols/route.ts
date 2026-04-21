import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/symbols?search=APP&asset_type=equity&sector=Technology&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const search     = searchParams.get('search')?.toUpperCase()
  const asset_type = searchParams.get('asset_type')
  const sector     = searchParams.get('sector')
  const limit      = Math.min(parseInt(searchParams.get('limit') || '50'), 500)

  let query = supabaseAdmin
    .from('symbols')
    .select('symbol, name, exchange, asset_type, sector, is_active')
    .eq('is_active', true)
    .order('symbol')
    .limit(limit)

  if (search) {
    query = query.or(`symbol.ilike.${search}%,name.ilike.%${search}%`)
  }
  if (asset_type) query = query.eq('asset_type', asset_type)
  if (sector)     query = query.eq('sector', sector)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: data.length, data })
}
