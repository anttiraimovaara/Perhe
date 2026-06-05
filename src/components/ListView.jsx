import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import Icon from '../Icon'
import Dictation from './Dictation'

export default function ListView({ list, user, onBack }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef(null)
  const pendingImageItem = useRef(null)

  async function load() {
    const { data } = await supabase
      .from('items').select('*')
      .eq('list_id', list.id)
      .order('checked', { ascending: true })
      .order('position', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel('items-' + list.id)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${list.id}` },
        load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [list.id])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 1800) }

  // Lisää yksi tai useampi rivi (sanelu/Claude voi palauttaa monta)
  async function addItems(texts) {
    const rows = texts.map((t, i) => ({
      list_id: list.id, text: t, added_by: user.name,
      position: Date.now() + i,
    }))
    if (rows.length === 0) return
    setItems(prev => [...prev, ...rows.map(r => ({ ...r, id: 'tmp-' + r.position, checked: false }))])
    await supabase.from('items').insert(rows)
  }

  async function addTyped(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    await addItems([t])
  }

  async function toggle(item) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i))
    await supabase.from('items').update({ checked: !item.checked }).eq('id', item.id)
  }

  async function removeItem(item) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    await supabase.from('items').delete().eq('id', item.id)
  }

  function pickImage(item) {
    pendingImageItem.current = item
    fileRef.current?.click()
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const item = pendingImageItem.current
    if (!file || !item) return
    setBusy(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${list.id}/${item.id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('kuvat').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('kuvat').getPublicUrl(path)
      await supabase.from('items').update({ image_url: data.publicUrl }).eq('id', item.id)
      load()
    } catch (err) {
      showToast('Kuvan lisäys epäonnistui')
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  // Sanelu -> Claude-funktio -> erilliset rivit
  async function onDictation(rawText) {
    if (!rawText.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/.netlify/functions/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, category: list.category }),
      })
      if (res.ok) {
        const { items: cleaned } = await res.json()
        await addItems(cleaned)
        showToast(`Lisätty ${cleaned.length} riviä`)
      } else {
        // Varakeino jos funktio ei vastaa: pilko rivinvaihdoista/pilkuista
        const fallback = rawText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
        await addItems(fallback)
        showToast('Lisätty (ilman siistimistä)')
      }
    } catch (err) {
      const fallback = rawText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
      await addItems(fallback)
    } finally {
      setBusy(false)
    }
  }

  const openItems = items.filter(i => !i.checked)
  const doneItems = items.filter(i => i.checked)

  return (
    <>
      <div className="topbar">
        <button className="iconbtn" onClick={onBack}><Icon name="back" /></button>
        <h1>{list.title}</h1>
      </div>

      <div className="page" style={{ paddingBottom: 8 }}>
        {loading && <div className="spinner">Ladataan…</div>}
        {!loading && items.length === 0 && (
          <div className="empty">Tyhjä lista. Lisää rivejä kirjoittamalla tai sanelemalla.</div>
        )}

        {openItems.map(item => (
          <ItemRow key={item.id} item={item} onToggle={toggle} onRemove={removeItem} onImage={pickImage} />
        ))}

        {doneItems.length > 0 && (
          <div className="sub" style={{ color: 'var(--text-muted)', margin: '16px 0 8px', fontSize: 13 }}>
            Valmiit ({doneItems.length})
          </div>
        )}
        {doneItems.map(item => (
          <ItemRow key={item.id} item={item} onToggle={toggle} onRemove={removeItem} onImage={pickImage} />
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={onFile} />

      <div className="toolbar">
        <form className="grow" onSubmit={addTyped} style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Lisää rivi…" value={text}
            onChange={e => setText(e.target.value)} style={{ flex: 1 }} />
          <button className="btn primary" type="submit" disabled={!text.trim()}>
            <Icon name="plus" size={20} color="#fff" />
          </button>
        </form>
        <Dictation onResult={onDictation} disabled={busy} />
      </div>

      {toast && <div className="toast">{toast}</div>}
      {busy && <div className="toast" style={{ bottom: 140 }}>Käsitellään…</div>}
    </>
  )
}

function ItemRow({ item, onToggle, onRemove, onImage }) {
  return (
    <div className={'item' + (item.checked ? ' done' : '')}>
      <button className={'check' + (item.checked ? ' on' : '')} onClick={() => onToggle(item)}>
        {item.checked && <Icon name="check" size={16} color="#fff" stroke={3} />}
      </button>
      <div className="txt">
        {item.text}
        {item.added_by && <div className="who">{item.added_by}</div>}
        {item.image_url && <img className="item-thumb" src={item.image_url} alt="" />}
      </div>
      <button className="iconbtn" onClick={() => onImage(item)} title="Lisää kuva">
        <Icon name="camera" size={20} color="#9b9a93" />
      </button>
      <button className="del" onClick={() => onRemove(item)} title="Poista">
        <Icon name="x" size={18} color="#9b9a93" />
      </button>
    </div>
  )
}
