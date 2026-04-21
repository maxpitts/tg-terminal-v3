import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol   = searchParams.get('symbol')?.toUpperCase()
  const regime   = searchParams.get('regime')
  const source   = searchParams.get('source')
  const resolved = searchParams.get('resolved')
  const limit    = Math.min(parseInt(searchParams.get('limit') || '50'), 500)

  let query = supabaseAdmin
    .from('signals')
    .select('*')
    .order('time', { ascending: false })
    .limit(limit)

  if (symbol)   query = query.eq('symbol', symbol)
  if (regime)   query = query.eq('regime', regime)
  if (source)   query = query.eq('source', source)
  if (resolved !== null && resolved !== undefined) {
    query = query.eq('resolved', resolved === 'true')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: data.length, data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { symbol, source, signal_type, confidence, regime, timeframe, price_at_signal, target_price, stop_price, payload, user_id } = body

  if (!symbol || !source || !signal_type) {
    return NextResponse.json({ error: 'symbol, source, and signal_type are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('signals')
    .insert({ time: new Date().toISOString(), symbol: symbol.toUpperCase(), source, signal_type, confidence, regime, timeframe, price_at_signal, target_price, stop_price, payload, user_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}