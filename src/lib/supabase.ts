import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ryygnjuuoqgikhklgyqh.supabase.co'
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0HEGj5YMZ24nO5GN7Ps3GQ_Z6bCYilf'

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in environment or fallback')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' }
})
