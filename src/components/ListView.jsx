import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import Icon from '../Icon'
import Dictation from './Dictation'
import { EventModal } from './Calendar'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const pad = n => String(n).padStart(2, '0')
const todayYmd = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

export default function ListView({ list, user, onBack }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef(null)
  const pendingImageItem = useRef(null)
  const [calItem, setCalItem] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const isTodo = list.category === 'todo'

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

  async function editItem(item, newText) {
    const t = (newText || '').trim()
    if (!t || t === item.text) return
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, text: t } : i))
    await supabase.from('items').update({ text: t }).eq('id', item.id)
  }

  async function removeImage(item) {
    if (!confirm('Poistetaanko liitetty kuva?')) return
    try {
      const marker = '/kuvat/'
      const idx = (item.image_url || '').indexOf(marker)
      if (idx !== -1) {
        const path = decodeURIComponent(item.image_url.slice(idx + marker.length))
        await supabase.storage.from('kuvat').remove([path])
      }
    } catch (err) { console.error('Kuvan poisto epäonnistui:', err) }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, image_url: null, image_by: null } : i))
    await supabase.from('items').update({ image_url: null, image_by: null }).eq('id', item.id)
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
      await supabase.from('items').update({ image_url: data.publicUrl, image_by: user.name }).eq('id', item.id)
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
      let cleaned = null
      const res = await fetch('/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, category: list.category }),
      })
      const ct = res.headers.get('content-type') || ''
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json()
        if (Array.isArray(data.items)) cleaned = data.items
      }
      if (Array.isArray(cleaned) && cleaned.length) {
        await addItems(cleaned)
        showToast(`Lisätty ${cleaned.length} riviä`)
      } else {
        // Siistiminen ei vastannut -> pilko parhaan mukaan ja kerro käyttäjälle
        const fallback = rawText.split(/[\n,]+|\bja\b/).map(s => s.trim()).filter(Boolean)
        await addItems(fallback)
        showToast('Sanelun siistiminen ei vastannut – tarkista ANTHROPIC_API_KEY')
      }
    } catch (err) {
      console.error('Sanelu epäonnistui:', err)
      const fallback = rawText.split(/[\n,]+|\bja\b/).map(s => s.trim()).filter(Boolean)
      await addItems(fallback)
      showToast('Sanelun siistiminen ei vastannut')
    } finally {
      setBusy(false)
    }
  }

  const byPos = (a, b) => (a.position || 0) - (b.position || 0)
  const openItems = items.filter(i => !i.checked).sort(byPos)
  const doneItems = items.filter(i => i.checked).sort(byPos)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )

  async function handleDragEnd(e) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = openItems.map(i => i.id)
    const reordered = arrayMove(openItems, ids.indexOf(active.id), ids.indexOf(over.id))
    const updates = reordered.map((it, idx) => ({ id: it.id, position: (idx + 1) * 1000 }))
    const map = new Map(updates.map(u => [u.id, u.position]))
    setItems(prev => prev.map(i => map.has(i.id) ? { ...i, position: map.get(i.id) } : i))
    for (const u of updates) await supabase.from('items').update({ position: u.position }).eq('id', u.id)
  }

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

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={openItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {openItems.map(item => (
              <SortableItemRow key={item.id} item={item} me={user.name} onToggle={toggle} onRemove={removeItem}
                onImage={pickImage} onEdit={editItem} onRemoveImage={removeImage}
                onCalendar={isTodo ? setCalItem : null} />
            ))}
          </SortableContext>
        </DndContext>

        {doneItems.length > 0 && (
          <button className="done-toggle" onClick={() => setShowDone(v => !v)}>
            <Icon name={showDone ? 'chevron-down' : 'chevron-right'} size={18} color="#9b9a93" />
            Valmiit ({doneItems.length})
          </button>
        )}
        {showDone && doneItems.map(item => (
          <ItemRow key={item.id} item={item} me={user.name} onToggle={toggle} onRemove={removeItem}
            onImage={pickImage} onEdit={editItem} onRemoveImage={removeImage}
            onCalendar={isTodo ? setCalItem : null} />
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*"
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

      {calItem && (
        <EventModal user={user}
          initial={{ title: calItem.text, event_date: todayYmd() }}
          onClose={() => setCalItem(null)}
          onSaved={() => { setCalItem(null); showToast('Lisätty kalenteriin') }} />
      )}
    </>
  )
}

function SortableItemRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id })
  const dragStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }
  return <ItemRow {...props} dragRef={setNodeRef} dragStyle={dragStyle} handleProps={{ ...attributes, ...listeners }} />
}

function ItemRow({ item, me, onToggle, onRemove, onImage, onCalendar, onEdit, onRemoveImage, dragRef, dragStyle, handleProps }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(item.text)
  const [showImg, setShowImg] = useState(false)
  const [expanded, setExpanded] = useState(false)
  // Vain rivin lisääjä saa muokata/poistaa (vanhat ilman lisääjää sallitaan kaikille)
  const canModify = !item.added_by || item.added_by === me
  // Kuvan saa poistaa sen lisääjä tai rivin tekijä
  const canDeleteImage = item.image_url && (item.image_by === me || item.added_by === me || !item.added_by)

  function saveEdit() { onEdit(item, val); setEditing(false) }

  return (
    <div ref={dragRef} style={dragStyle} className={'item' + (item.checked ? ' done' : '')}>
      <button className={'check' + (item.checked ? ' on' : '')} onClick={() => onToggle(item)}>
        {item.checked && <Icon name="check" size={16} color="#fff" stroke={3} />}
      </button>
      <div className="item-body">
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={val} autoFocus onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
                style={{ flex: 1 }} />
              <button className="btn primary" onClick={saveEdit} title="Tallenna">
                <Icon name="check" size={16} color="#fff" stroke={3} />
              </button>
            </div>
            {item.image_url && canDeleteImage && (
              <button className="btn" style={{ color: '#A32D2D', alignSelf: 'flex-start' }}
                onClick={() => { setEditing(false); onRemoveImage(item) }}>
                <Icon name="trash" size={16} color="#A32D2D" /> &nbsp;Poista kuva
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={'item-text' + (expanded ? '' : ' clamp2')} onClick={() => setExpanded(e => !e)}>
              {item.text}
            </div>
            <div className="item-foot">
              <span className="who">{item.added_by || ''}</span>
              <span className="item-actions">
                {item.image_url && (
                  <button className="thumb-btn" onClick={() => setShowImg(true)} title="Näytä kuva">
                    <img className="item-thumb-sm" src={item.image_url} alt="" />
                  </button>
                )}
                {canModify && (
                  <button className="iconbtn" onClick={() => { setVal(item.text); setEditing(true) }} title="Muokkaa">
                    <Icon name="edit" size={18} color="#9b9a93" />
                  </button>
                )}
                {onCalendar && (
                  <button className="iconbtn" onClick={() => onCalendar(item)} title="Lisää kalenteriin">
                    <Icon name="calendar" size={18} color="#9b9a93" />
                  </button>
                )}
                <button className="iconbtn" onClick={() => onImage(item)} title="Lisää kuva">
                  <Icon name="camera" size={18} color="#9b9a93" />
                </button>
                {canModify && (
                  <button className="iconbtn" onClick={() => onRemove(item)} title="Poista">
                    <Icon name="x" size={18} color="#9b9a93" />
                  </button>
                )}
                {handleProps && (
                  <button className="iconbtn drag-handle" {...handleProps} title="Järjestä" aria-label="Järjestä">
                    <Icon name="grip" size={18} color="#9b9a93" />
                  </button>
                )}
              </span>
            </div>
          </>
        )}
      </div>

      {showImg && (
        <div className="lightbox" onClick={() => setShowImg(false)}>
          <img src={item.image_url} alt="" onClick={e => e.stopPropagation()} />
          <div className="lightbox-actions" onClick={e => e.stopPropagation()}>
            {canDeleteImage && (
              <button className="btn" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
                onClick={() => { setShowImg(false); onRemoveImage(item) }}>
                <Icon name="trash" size={18} color="#fff" /> &nbsp;Poista kuva
              </button>
            )}
            <button className="btn" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
              onClick={() => setShowImg(false)}>Sulje</button>
          </div>
        </div>
      )}
    </div>
  )
}
