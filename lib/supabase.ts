import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

// New QuantaBase exports
export const supabase = createClient(url, anon)
export const supabaseAdmin = createClient(url, service)

// Legacy exports for old T&G routes
export const createServerSupabase = () => createClient(url, service)
export const createBrowserSupabase = () => createClient(url, anon)
export default supabase