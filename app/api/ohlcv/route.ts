import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/ohlcv?symbol=SPY&timeframe=5m&limit=500&from=2024-01-01&to=2024-12-31
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const symbol    = searchParams.get('symbol')?.toUpperCase()
  const timeframe = searchParams.get('timeframe') || '1d'
  const limit     = Math.min(parseInt(searchParams.get('limit') || '500'), 5000)
  const from      = searchParams.get('from')
  const to        = searchParams.get('to')

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('ohlcv')
    .select('time, open, high, low, close, volume, vwap')
    .eq('symbol', symbol)
    .eq('timeframe', timeframe)
    .order('time', { ascending: false })
    .limit(limit)

  if (from) query = query.gte('time', from)
  if (to)   query = query.lte('time', to)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    symbol,
    timeframe,
    count: data.length,
    data: data.reverse(), // return chronological order
  })
}
