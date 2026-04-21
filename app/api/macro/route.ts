import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/macro?indicators=CPI,FEDFUNDS,VIX&days=90
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const indicators = searchParams.get('indicators')?.split(',').map(i => i.trim().toUpperCase())
  const days       = parseInt(searchParams.get('days') || '90')
  const limit      = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = supabaseAdmin
    .from('macro_data')
    .select('time, indicator, value, prev_value, source, frequency')
    .gte('time', from)
    .order('time', { ascending: false })
    .limit(limit)

  if (indicators?.length) {
    query = query.in('indicator', indicators)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by indicator for easier consumption
  const grouped: Record<string, any[]> = {}
  for (const row of data) {
    if (!grouped[row.indicator]) grouped[row.indicator] = []
    grouped[row.indicator].push(row)
  }

  return NextResponse.json({ count: data.length, data: grouped })
}
