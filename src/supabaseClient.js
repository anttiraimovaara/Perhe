import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Supabase-ympäristömuuttujat puuttuvat. Täytä .env tai Netlifyn ympäristömuuttujat.')
}

export const supabase = createClient(url, key)
