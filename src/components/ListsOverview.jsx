import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Icon from '../Icon'
import Dictation from './Dictation'

export default function ListsOverview({ category, user, onBack, onOpenList }) {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [counts, setCounts] = useState({})
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('lists').select('*')
      .eq('category', category.id)
      .order('created_at', { ascending: true })
    setLists(data || [])
    setLoading(false)
    // hae avoimien rivien määrät
    const { data: items } = await supabase.from('items').select('list_id, checked')
    const c = {}
    ;(items || []).forEach(i => {
      if (!c[i.list_id]) c[i.list_id] = { open: 0, total: 0 }
      c[i.list_id].total++
      if (!i.checked) c[i.list_id].open++
    })
    setCounts(c)
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel('lists-' + category.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [category.id])

  async function addList(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setNewTitle('')
    await supabase.from('lists').insert({ category: category.id, title, created_by: user.name })
  }

  // Sanele listan nimi -> Claude siistii sen lyhyeksi otsikoksi kenttään
  async function onDictateName(rawText) {
    if (!rawText.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/.netlify/functions/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, mode: 'title' }),
      })
      if (res.ok) {
        const { title } = await res.json()
        setNewTitle(title || rawText.trim())
      } else {
        setNewTitle(rawText.trim())
      }
    } catch {
      setNewTitle(rawText.trim())
    } finally {
      setBusy(false)
    }
  }

  async function removeList(list) {
    // Vain listan tekijä voi poistaa sen (vanhat ilman tekijää sallitaan kaikille)
    if (list.created_by && list.created_by !== user.name) {
      alert(`Vain ${list.created_by} voi poistaa tämän listan.`)
      return
    }
    if (!confirm(`Haluatko varmasti poistaa listan "${list.title}" ja kaikki sen rivit?`)) return
    await supabase.from('lists').delete().eq('id', list.id)
  }

  return (
    <>
      <div className="topbar">
        <button className="iconbtn" onClick={onBack}><Icon name="back" /></button>
        <h1>{category.title}</h1>
      </div>
      <div className="page">
        <form className="add-row" onSubmit={addList}>
          <input type="text" placeholder="Uusi lista, esim. Ruokakauppa"
            value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <Dictation onResult={onDictateName} disabled={busy} />
          <button className="btn primary" type="submit" disabled={!newTitle.trim() || busy}>
            <Icon name="plus" size={20} color="#fff" />
          </button>
        </form>
        {busy && <div className="spinner" style={{ padding: 8 }}>Siistitään nimeä…</div>}

        {loading && <div className="spinner">Ladataan…</div>}
        {!loading && lists.length === 0 && (
          <div className="empty">Ei vielä listoja. Luo ensimmäinen yllä.</div>
        )}

        {lists.map(list => {
          const c = counts[list.id] || { open: 0, total: 0 }
          return (
            <div key={list.id} className="list-card" onClick={() => onOpenList(list)}>
              <span className="cat-icon" style={{ background: category.bg, width: 42, height: 42 }}>
                <Icon name={category.icon} size={22} color={category.color} />
              </span>
              <div className="meta">
                <div className="name">{list.title}</div>
                <div className="sub">
                  {c.total === 0 ? 'Tyhjä' : `${c.open} avoinna · ${c.total} riviä`}
                </div>
              </div>
              {(!list.created_by || list.created_by === user.name) && (
                <button className="iconbtn" onClick={(e) => { e.stopPropagation(); removeList(list) }}>
                  <Icon name="trash" size={20} color="#9b9a93" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
