import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { colorFor } from '../config'
import Icon from '../Icon'

function timeLabel(iso) {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `klo ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getDate()}.${d.getMonth() + 1}. klo ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Announcements({ user, onBack }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')

  async function load() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setList(data || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function post(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    await supabase.from('announcements').insert({ text: t, created_by: user.name })
  }

  async function remove(a) {
    if (a.created_by && a.created_by !== user.name) { alert(`Vain ${a.created_by} voi poistaa tämän ilmoituksen.`); return }
    if (!confirm('Poistetaanko ilmoitus?')) return
    await supabase.from('announcements').delete().eq('id', a.id)
  }

  return (
    <>
      <div className="topbar">
        <button className="iconbtn" onClick={onBack}><Icon name="back" /></button>
        <h1>Ilmoitukset</h1>
      </div>

      <div className="page" style={{ paddingBottom: 8 }}>
        <form className="add-row" onSubmit={post}>
          <input type="text" placeholder="Kirjoita ilmoitus perheelle…" value={text} onChange={e => setText(e.target.value)} />
          <button className="btn primary" type="submit" disabled={!text.trim()}>
            <Icon name="plus" size={20} color="#fff" />
          </button>
        </form>

        {loading && <div className="spinner">Ladataan…</div>}
        {!loading && list.length === 0 && <div className="empty">Ei ilmoituksia. Kirjoita ensimmäinen yllä.</div>}

        {list.map(a => {
          const c = colorFor(a.created_by)
          const canDelete = !a.created_by || a.created_by === user.name
          return (
            <div key={a.id} className="ann-card">
              <span className="avatar" style={{ background: c.bg, color: c.color, flexShrink: 0 }}>{(a.created_by || '?')[0]}</span>
              <div style={{ flex: 1 }}>
                <div className="ann-text">{a.text}</div>
                <div className="ann-meta">{a.created_by || 'Joku'} · {timeLabel(a.created_at)}</div>
              </div>
              {canDelete && (
                <button className="iconbtn" onClick={() => remove(a)} title="Poista">
                  <Icon name="x" size={18} color="#9b9a93" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
