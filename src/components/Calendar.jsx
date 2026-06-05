import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { FAMILY, KOKO_PERHE, colorFor } from '../config'
import Icon from '../Icon'
import Dictation from './Dictation'

// ---------- Päivämääräapurit (paikallinen aika, ei aikavyöhykesotkua) ----------
const pad = n => String(n).padStart(2, '0')
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addMonthsClamped(d, n) {
  const x = new Date(d)
  const day = x.getDate()
  x.setDate(1); x.setMonth(x.getMonth() + n)
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, last))
  return x
}
const MONTHS = ['Tammikuu','Helmikuu','Maaliskuu','Huhtikuu','Toukokuu','Kesäkuu','Heinäkuu','Elokuu','Syyskuu','Lokakuu','Marraskuu','Joulukuu']
const WD_SHORT = ['su','ma','ti','ke','to','pe','la']
const WD_HEAD = ['ma','ti','ke','to','pe','la','su']
const monIndex = d => (d.getDay() + 6) % 7   // ma=0 ... su=6

// Laajenna toistuvat tapahtumat esiintymiksi annetulle aikavälille
function expand(events, rangeStart, rangeEnd) {
  const out = []
  for (const ev of events) {
    const start = parseYmd(ev.event_date)
    const until = ev.recur_until ? parseYmd(ev.recur_until) : null
    if (ev.recur === 'none' || !ev.recur) {
      if (start >= rangeStart && start <= rangeEnd) out.push({ ...ev, occ: start })
      continue
    }
    let d = new Date(start), guard = 0
    while (d <= rangeEnd && guard < 800) {
      if (d >= rangeStart && (!until || d <= until)) out.push({ ...ev, occ: new Date(d) })
      if (until && d > until) break
      d = ev.recur === 'weekly' ? addDays(d, 7) : addMonthsClamped(d, 1)
      guard++
    }
  }
  return out
}

export default function Calendar({ user, onBack }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [selected, setSelected] = useState(ymd(new Date()))
  const [modal, setModal] = useState(null)  // null | { event }

  async function load() {
    const { data, error } = await supabase.from('events').select('*')
    if (error) console.error('Tapahtumien haku epäonnistui:', error)
    setEvents(data || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Kuukauden ruudukko (maanantaista)
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const gridStart = addDays(first, -monIndex(first))
    const arr = []
    for (let i = 0; i < 42; i++) arr.push(addDays(gridStart, i))
    return arr
  }, [month])

  // Esiintymät kuukausiruudukolle
  const monthOcc = useMemo(() => {
    if (!cells.length) return {}
    const map = {}
    expand(events, startOfDay(cells[0]), startOfDay(cells[cells.length - 1])).forEach(o => {
      const k = ymd(o.occ); (map[k] = map[k] || []).push(o)
    })
    return map
  }, [events, cells])

  // Tulevat tapahtumat (tästä päivästä ~4 kk eteenpäin)
  const upcoming = useMemo(() => {
    const today = startOfDay(new Date())
    const occ = expand(events, today, addDays(today, 120))
    occ.sort((a, b) => {
      const da = ymd(a.occ), db = ymd(b.occ)
      if (da !== db) return da < db ? -1 : 1
      return (a.event_time || '99') < (b.event_time || '99') ? -1 : 1
    })
    return occ
  }, [events])

  const selectedOcc = selected ? (monthOcc[selected] || []).slice().sort(
    (a, b) => (a.event_time || '99') < (b.event_time || '99') ? -1 : 1) : []

  function relLabel(dateStr) {
    const d = parseYmd(dateStr), t = startOfDay(new Date())
    const diff = Math.round((d - t) / 86400000)
    if (diff === 0) return 'Tänään'
    if (diff === 1) return 'Huomenna'
    return `${WD_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`
  }

  return (
    <>
      <div className="topbar">
        <button className="iconbtn" onClick={onBack}><Icon name="back" /></button>
        <h1>Kalenteri</h1>
      </div>

      <div className="page" style={{ paddingBottom: 8 }}>
        {/* Kuukausiotsikko + navigointi */}
        <div className="cal-head">
          <button className="iconbtn" onClick={() => setMonth(addMonthsClamped(month, -1))}><Icon name="back" /></button>
          <div className="cal-title">{MONTHS[month.getMonth()]} {month.getFullYear()}</div>
          <button className="iconbtn" onClick={() => setMonth(addMonthsClamped(month, 1))}
            style={{ transform: 'rotate(180deg)' }}><Icon name="back" /></button>
        </div>

        {/* Viikonpäivät */}
        <div className="cal-grid cal-week">
          {WD_HEAD.map(w => <div key={w} className="cal-wd">{w}</div>)}
        </div>

        {/* Päiväruudukko */}
        <div className="cal-grid">
          {cells.map((d, i) => {
            const key = ymd(d)
            const inMonth = d.getMonth() === month.getMonth()
            const isToday = key === ymd(new Date())
            const isSel = key === selected
            const occ = monthOcc[key] || []
            const dots = [...new Set(occ.map(o => colorFor(o.who).color))].slice(0, 3)
            return (
              <button key={i} className={'cal-day' + (inMonth ? '' : ' off') + (isSel ? ' sel' : '') + (isToday ? ' today' : '')}
                onClick={() => setSelected(key)}>
                <span className="cal-num">{d.getDate()}</span>
                <span className="cal-dots">{dots.map((c, j) => <span key={j} className="dot" style={{ background: c }} />)}</span>
              </button>
            )
          })}
        </div>

        {/* Valitun päivän tapahtumat */}
        {selected && (
          <div className="cal-day-panel">
            <div className="cal-day-title">{relLabel(selected)}</div>
            {selectedOcc.length === 0 && <div className="sub" style={{ color: 'var(--text-muted)', fontSize: 14 }}>Ei tapahtumia.</div>}
            {selectedOcc.map((o, i) => <EventRow key={o.id + i} occ={o} onClick={() => setModal({ event: o })} />)}
            <button className="btn" style={{ marginTop: 10, width: '100%' }}
              onClick={() => setModal({ event: { event_date: selected } })}>
              <Icon name="plus" size={18} color="#185FA5" /> &nbsp;Lisää tälle päivälle
            </button>
          </div>
        )}

        {/* Tulevat tapahtumat */}
        <h2 style={{ fontSize: 17, margin: '22px 0 10px' }}>Tulevat tapahtumat</h2>
        {loading && <div className="spinner">Ladataan…</div>}
        {!loading && upcoming.length === 0 && <div className="empty">Ei tulevia tapahtumia.</div>}
        {upcoming.map((o, i) => {
          const dateStr = ymd(o.occ)
          const prev = i > 0 ? ymd(upcoming[i - 1].occ) : null
          return (
            <div key={o.id + i}>
              {dateStr !== prev && <div className="cal-group">{relLabel(dateStr)}</div>}
              <EventRow occ={o} onClick={() => setModal({ event: o })} />
            </div>
          )
        })}
      </div>

      <div className="toolbar">
        <button className="btn primary grow" onClick={() => setModal({ event: { event_date: selected || ymd(new Date()) } })}>
          <Icon name="plus" size={20} color="#fff" /> &nbsp;Uusi tapahtuma
        </button>
      </div>

      {modal && (
        <EventModal user={user} initial={modal.event}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
    </>
  )
}

function EventRow({ occ, onClick }) {
  const c = colorFor(occ.who)
  return (
    <div className="event-row" onClick={onClick}>
      <span className="event-bar" style={{ background: c.color }} />
      <span className="event-time">{occ.event_time ? occ.event_time.slice(0, 5) : 'Koko päivä'}</span>
      <span className="event-main">
        <span className="event-title">{occ.title}{occ.recur && occ.recur !== 'none' ? ' ↻' : ''}</span>
        {occ.who && <span className="event-who" style={{ color: c.color }}>{occ.who}</span>}
      </span>
    </div>
  )
}

function EventModal({ user, initial, onClose, onSaved }) {
  const isEdit = !!initial.id
  const [title, setTitle] = useState(initial.title || '')
  const [date, setDate] = useState(initial.event_date || ymd(new Date()))
  const [allDay, setAllDay] = useState(!initial.event_time)
  const [time, setTime] = useState(initial.event_time ? initial.event_time.slice(0, 5) : '12:00')
  const [who, setWho] = useState(initial.who || '')
  const [note, setNote] = useState(initial.note || '')
  const [recur, setRecur] = useState(initial.recur || 'none')
  const [until, setUntil] = useState(initial.recur_until || '')
  const [busy, setBusy] = useState(false)

  async function onDictate(rawText) {
    if (!rawText.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/.netlify/functions/cleanup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, mode: 'event', today: ymd(new Date()), members: FAMILY.map(f => f.name) }),
      })
      if (res.ok) {
        const { event: ev } = await res.json()
        if (ev) {
          if (ev.title) setTitle(ev.title)
          if (ev.date) setDate(ev.date)
          if (ev.time) { setTime(ev.time); setAllDay(false) } else setAllDay(true)
          if (ev.who) setWho(ev.who)
        }
      }
    } catch { /* jätetään lomake ennalleen */ }
    finally { setBusy(false) }
  }

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    const row = {
      title: title.trim(), event_date: date,
      event_time: allDay ? null : time,
      who: who || null, note: note.trim() || null,
      recur, recur_until: recur === 'none' ? null : (until || null),
    }
    const { error } = isEdit
      ? await supabase.from('events').update(row).eq('id', initial.id)
      : await supabase.from('events').insert({ ...row, created_by: user.name })
    setBusy(false)
    if (error) {
      console.error('Tallennus epäonnistui:', error)
      alert('Tallennus epäonnistui: ' + (error.message || error.code || 'tuntematon virhe') +
        '\n\nTarkista, että ajoit supabase/calendar.sql Supabasessa.')
      return
    }
    onSaved()
  }

  async function remove() {
    const msg = recur !== 'none'
      ? `Poistetaanko toistuva tapahtuma "${title}" kaikkine esiintymineen?`
      : `Poistetaanko tapahtuma "${title}"?`
    if (!confirm(msg)) return
    setBusy(true)
    await supabase.from('events').delete().eq('id', initial.id)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{isEdit ? 'Muokkaa tapahtumaa' : 'Uusi tapahtuma'}</strong>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>

        <form onSubmit={save} className="modal-body">
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Otsikko, esim. Iisakin jalkapallo" value={title}
              onChange={e => setTitle(e.target.value)} autoFocus style={{ flex: 1 }} />
            <Dictation onResult={onDictate} disabled={busy} />
          </div>
          {busy && <div className="sub" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Käsitellään saneltua…</div>}

          <label className="fld">Päivä
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>

          <label className="row-check">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} /> Koko päivä
          </label>
          {!allDay && (
            <label className="fld">Kello
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </label>
          )}

          <label className="fld">Kuka
            <select value={who} onChange={e => setWho(e.target.value)}>
              <option value="">(ei henkilöä)</option>
              <option value={KOKO_PERHE.name}>{KOKO_PERHE.name}</option>
              {FAMILY.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
          </label>

          <label className="fld">Toisto
            <select value={recur} onChange={e => setRecur(e.target.value)}>
              <option value="none">Ei toistu</option>
              <option value="weekly">Joka viikko</option>
              <option value="monthly">Joka kuukausi</option>
            </select>
          </label>
          {recur !== 'none' && (
            <label className="fld">Toisto päättyy (valinnainen)
              <input type="date" value={until} onChange={e => setUntil(e.target.value)} />
            </label>
          )}

          <label className="fld">Muistiinpano (valinnainen)
            <input type="text" placeholder="esim. paikka" value={note} onChange={e => setNote(e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {isEdit && <button type="button" className="btn" onClick={remove} disabled={busy}
              style={{ color: '#A32D2D' }}><Icon name="trash" size={18} color="#A32D2D" /></button>}
            <button type="submit" className="btn primary grow" disabled={busy || !title.trim()}>Tallenna</button>
          </div>
        </form>
      </div>
    </div>
  )
}
