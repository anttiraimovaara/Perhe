import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { colorFor } from '../config'
import Icon from '../Icon'
import { ymd, parseYmd, addDays, startOfDay, expand } from './Calendar'

const WD_SHORT = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la']

export default function Today() {
  const [events, setEvents] = useState([])
  const [last, setLast] = useState(null)

  async function load() {
    const { data: ev } = await supabase.from('events').select('*')
    setEvents(ev || [])

    const { data: it } = await supabase.from('items')
      .select('text, created_at, added_by, list_id').order('created_at', { ascending: false }).limit(1)
    const { data: le } = await supabase.from('events')
      .select('title, created_at, created_by').order('created_at', { ascending: false }).limit(1)
    const cand = []
    if (it && it[0]) cand.push({ type: 'item', ...it[0] })
    if (le && le[0]) cand.push({ type: 'event', ...le[0] })
    cand.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    let top = cand[0] || null
    if (top && top.type === 'item' && top.list_id) {
      const { data: l } = await supabase.from('lists').select('title').eq('id', top.list_id).single()
      top = { ...top, listTitle: l?.title }
    }
    setLast(top)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const today = startOfDay(new Date())
  const sortOcc = arr => arr.sort((a, b) => {
    const da = ymd(a.occ), db = ymd(b.occ)
    if (da !== db) return da < db ? -1 : 1
    return (a.event_time || '99') < (b.event_time || '99') ? -1 : 1
  })

  const soon = sortOcc(expand(events, today, addDays(today, 1)))
  const birthdays = sortOcc(expand(events.filter(e => e.recur === 'yearly'), today, addDays(today, 14)))

  function dayLabel(d) {
    const diff = Math.round((startOfDay(d) - today) / 86400000)
    if (diff === 0) return 'Tänään'
    if (diff === 1) return 'Huomenna'
    return `${WD_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`
  }

  const nothing = soon.length === 0 && birthdays.length === 0 && !last

  return (
    <div className="today-card">
      <div className="today-head"><Icon name="calendar" size={18} color="#854F0B" /> Tänään</div>

      {soon.length > 0 ? soon.map((o, i) => {
        const c = colorFor(o.who)
        return (
          <div key={o.id + i} className="today-row">
            <span className="today-bar" style={{ background: c.color }} />
            <span className="today-when">{dayLabel(o.occ)} {o.event_time ? o.event_time.slice(0, 5) : ''}</span>
            <span className="today-text">{o.title}{o.who ? ` · ${o.who}` : ''}</span>
          </div>
        )
      }) : <div className="today-empty">Ei tapahtumia tänään tai huomenna.</div>}

      {birthdays.length > 0 && (
        <>
          <div className="today-sub">Tulevat syntymäpäivät</div>
          {birthdays.map((o, i) => (
            <div key={'b' + o.id + i} className="today-row">
              <span className="today-bar" style={{ background: '#D4537E' }} />
              <span className="today-when">{dayLabel(o.occ)}</span>
              <span className="today-text">{o.title}</span>
            </div>
          ))}
        </>
      )}

      {last && (
        <div className="today-last">
          <Icon name="plus" size={14} color="#6b6a64" />
          <span>
            Viimeksi lisätty: <strong>{last.type === 'item' ? last.text : last.title}</strong>
            {last.type === 'item'
              ? (last.listTitle ? ` (${last.listTitle})` : '')
              : ' (kalenteri)'}
            {(last.added_by || last.created_by) ? ` – ${last.added_by || last.created_by}` : ''}
          </span>
        </div>
      )}

      {nothing && <div className="today-empty">Ei vielä mitään – aloita lisäämällä lista tai tapahtuma.</div>}
    </div>
  )
}
