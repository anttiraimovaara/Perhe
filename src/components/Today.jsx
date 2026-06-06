import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { colorFor } from '../config'
import Icon from '../Icon'
import { ymd, parseYmd, addDays, startOfDay, expand } from './Calendar'

const WD_SHORT = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la']

export default function Today() {
  const [events, setEvents] = useState([])
  const [last, setLast] = useState(null)
  const [showFeed, setShowFeed] = useState(false)

  async function load() {
    const { data: ev } = await supabase.from('events').select('*')
    setEvents(ev || [])

    const latest = (q, ascending = false) => q.order('created_at', { ascending }).limit(1)
    const [{ data: it }, { data: le }, { data: an }, { data: po }] = await Promise.all([
      latest(supabase.from('items').select('text, created_at, added_by, list_id')),
      latest(supabase.from('events').select('title, created_at, created_by')),
      latest(supabase.from('announcements').select('text, created_at, created_by')),
      latest(supabase.from('polls').select('question, created_at, created_by')),
    ])
    const cand = []
    if (it && it[0]) cand.push({ type: 'item', label: it[0].text, source: '', created_at: it[0].created_at, who: it[0].added_by, list_id: it[0].list_id })
    if (le && le[0]) cand.push({ type: 'event', label: le[0].title, source: 'kalenteri', created_at: le[0].created_at, who: le[0].created_by })
    if (an && an[0]) cand.push({ type: 'ann', label: an[0].text, source: 'Ilmoitukset', created_at: an[0].created_at, who: an[0].created_by })
    if (po && po[0]) cand.push({ type: 'poll', label: po[0].question, source: 'Demokratia', created_at: po[0].created_at, who: po[0].created_by })
    cand.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    let top = cand[0] || null
    if (top && top.type === 'item' && top.list_id) {
      const { data: l } = await supabase.from('lists').select('title').eq('id', top.list_id).single()
      top = { ...top, source: l?.title || '' }
    }
    setLast(top)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, load)
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
          <span className="today-last-text">
            Viimeksi lisätty: <strong>{last.label}</strong>
            {last.source ? ` (${last.source})` : ''}
            {last.who ? ` – ${last.who}` : ''}
          </span>
          <button className="iconbtn" style={{ padding: 4 }} onClick={() => setShowFeed(true)}
            title="Näytä kaikki lisäykset">
            <Icon name="chevron-right" size={18} color="#6b6a64" />
          </button>
        </div>
      )}

      {nothing && <div className="today-empty">Ei vielä mitään – aloita lisäämällä lista tai tapahtuma.</div>}

      {showFeed && <FeedModal onClose={() => setShowFeed(false)} />}
    </div>
  )
}

function feedTime(iso) {
  const d = new Date(iso), now = new Date(), pad = n => String(n).padStart(2, '0')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return `tänään ${time}`
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `eilen ${time}`
  return `${d.getDate()}.${d.getMonth() + 1}. ${time}`
}

function FeedModal({ onClose }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    (async () => {
      const N = 25
      const [it, le, an, po, ls] = await Promise.all([
        supabase.from('items').select('text,created_at,added_by,list_id').order('created_at', { ascending: false }).limit(N),
        supabase.from('events').select('title,created_at,created_by').order('created_at', { ascending: false }).limit(N),
        supabase.from('announcements').select('text,created_at,created_by').order('created_at', { ascending: false }).limit(N),
        supabase.from('polls').select('question,created_at,created_by').order('created_at', { ascending: false }).limit(N),
        supabase.from('lists').select('id,title'),
      ])
      const lmap = new Map((ls.data || []).map(l => [l.id, l.title]))
      const all = []
      ;(it.data || []).forEach(r => all.push({ icon: 'cart', label: r.text, source: lmap.get(r.list_id) || 'Lista', who: r.added_by, created_at: r.created_at }))
      ;(le.data || []).forEach(r => all.push({ icon: 'calendar', label: r.title, source: 'Kalenteri', who: r.created_by, created_at: r.created_at }))
      ;(an.data || []).forEach(r => all.push({ icon: 'megaphone', label: r.text, source: 'Ilmoitukset', who: r.created_by, created_at: r.created_at }))
      ;(po.data || []).forEach(r => all.push({ icon: 'poll', label: r.question, source: 'Demokratia', who: r.created_by, created_at: r.created_at }))
      all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      setRows(all.slice(0, 60))
    })()
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Viimeksi lisätyt</strong>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        <div className="modal-body">
          {!rows && <div className="spinner">Ladataan…</div>}
          {rows && rows.length === 0 && <div className="empty">Ei lisäyksiä.</div>}
          {rows && rows.map((r, i) => (
            <div key={i} className="feed-row">
              <Icon name={r.icon} size={18} color="#9b9a93" />
              <div className="feed-main">
                <div className="feed-label">{r.label}</div>
                <div className="feed-meta">{r.source}{r.who ? ` · ${r.who}` : ''} · {feedTime(r.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
