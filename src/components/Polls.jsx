import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Icon from '../Icon'

export default function Polls({ user, onBack }) {
  const [polls, setPolls] = useState([])
  const [options, setOptions] = useState([])
  const [votes, setVotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function load() {
    const [{ data: p }, { data: o }, { data: v }] = await Promise.all([
      supabase.from('polls').select('*').order('created_at', { ascending: false }),
      supabase.from('poll_options').select('*').order('position', { ascending: true }),
      supabase.from('votes').select('*'),
    ])
    setPolls(p || []); setOptions(o || []); setVotes(v || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('polls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function vote(poll, option) {
    if (poll.closed) return
    const mine = votes.filter(v => v.poll_id === poll.id && v.voter === user.name)
    const existing = mine.find(v => v.option_id === option.id)
    if (poll.multi) {
      if (existing) await supabase.from('votes').delete().eq('id', existing.id)
      else await supabase.from('votes').insert({ poll_id: poll.id, option_id: option.id, voter: user.name })
    } else {
      if (mine.length) await supabase.from('votes').delete().eq('poll_id', poll.id).eq('voter', user.name)
      if (!existing) await supabase.from('votes').insert({ poll_id: poll.id, option_id: option.id, voter: user.name })
    }
    load()
  }

  async function toggleClosed(poll) {
    await supabase.from('polls').update({ closed: !poll.closed }).eq('id', poll.id)
  }
  async function removePoll(poll) {
    if (!confirm(`Poistetaanko äänestys "${poll.question}"?`)) return
    await supabase.from('polls').delete().eq('id', poll.id)
  }

  return (
    <>
      <div className="topbar">
        <button className="iconbtn" onClick={onBack}><Icon name="back" /></button>
        <h1>Demokratia</h1>
      </div>

      <div className="page">
        <button className="btn primary" style={{ width: '100%', marginBottom: 16 }} onClick={() => setCreating(true)}>
          <Icon name="plus" size={20} color="#fff" /> &nbsp;Uusi äänestys
        </button>

        {loading && <div className="spinner">Ladataan…</div>}
        {!loading && polls.length === 0 && <div className="empty">Ei vielä äänestyksiä. Luo ensimmäinen yllä.</div>}

        {polls.map(poll => (
          <PollCard key={poll.id} poll={poll} user={user}
            options={options.filter(o => o.poll_id === poll.id)}
            votes={votes.filter(v => v.poll_id === poll.id)}
            onVote={vote} onToggleClosed={toggleClosed} onRemove={removePoll} />
        ))}
      </div>

      {creating && <CreatePoll user={user} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
    </>
  )
}

function PollCard({ poll, user, options, votes, onVote, onToggleClosed, onRemove }) {
  const counts = {}
  options.forEach(o => { counts[o.id] = votes.filter(v => v.option_id === o.id) })
  const max = Math.max(1, ...options.map(o => counts[o.id].length))
  const canManage = !poll.created_by || poll.created_by === user.name

  return (
    <div className="poll-card">
      <div className="poll-q">
        {poll.question}
        {poll.closed && <span className="poll-badge">Suljettu</span>}
      </div>
      <div className="poll-meta">{poll.multi ? 'Voit valita useita' : 'Yksi ääni'}{poll.created_by ? ` · ${poll.created_by}` : ''}</div>

      {options.map(o => {
        const voters = counts[o.id]
        const mine = voters.some(v => v.voter === user.name)
        const pct = Math.round((voters.length / max) * 100)
        return (
          <button key={o.id} className={'poll-opt' + (mine ? ' mine' : '')} onClick={() => onVote(poll, o)} disabled={poll.closed}>
            <span className="poll-bar" style={{ width: pct + '%' }} />
            <span className="poll-opt-row">
              <span className="poll-opt-text">
                {mine && <Icon name="check" size={15} color="#0F6E56" stroke={3} />} {o.text}
              </span>
              <span className="poll-count">{voters.length}</span>
            </span>
            {voters.length > 0 && <span className="poll-voters">{voters.map(v => v.voter).join(', ')}</span>}
          </button>
        )
      })}

      {canManage && (
        <div className="poll-actions">
          <button className="btn" onClick={() => onToggleClosed(poll)}>{poll.closed ? 'Avaa uudelleen' : 'Sulje äänestys'}</button>
          <button className="btn" style={{ color: '#A32D2D' }} onClick={() => onRemove(poll)}>
            <Icon name="trash" size={16} color="#A32D2D" />
          </button>
        </div>
      )}
    </div>
  )
}

function CreatePoll({ user, onClose, onSaved }) {
  const [question, setQuestion] = useState('')
  const [opts, setOpts] = useState(['', ''])
  const [multi, setMulti] = useState(false)
  const [busy, setBusy] = useState(false)

  function setOpt(i, val) { setOpts(prev => prev.map((o, j) => j === i ? val : o)) }
  function addOpt() { setOpts(prev => [...prev, '']) }
  function removeOpt(i) { setOpts(prev => prev.filter((_, j) => j !== i)) }

  async function save(e) {
    e.preventDefault()
    const q = question.trim()
    const clean = opts.map(o => o.trim()).filter(Boolean)
    if (!q || clean.length < 2) { alert('Anna kysymys ja vähintään kaksi vaihtoehtoa.'); return }
    setBusy(true)
    const { data: poll, error } = await supabase.from('polls')
      .insert({ question: q, multi, created_by: user.name }).select().single()
    if (error) { setBusy(false); alert('Tallennus epäonnistui: ' + error.message); return }
    await supabase.from('poll_options').insert(clean.map((text, i) => ({ poll_id: poll.id, text, position: i })))
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Uusi äänestys</strong>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        <form onSubmit={save} className="modal-body">
          <input type="text" placeholder="Kysymys, esim. Mitä syödään lauantaina?" value={question}
            autoFocus onChange={e => setQuestion(e.target.value)} />

          <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Vaihtoehdot</div>
          {opts.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="text" placeholder={`Vaihtoehto ${i + 1}`} value={o} onChange={e => setOpt(i, e.target.value)} style={{ flex: 1 }} />
              {opts.length > 2 && (
                <button type="button" className="iconbtn" onClick={() => removeOpt(i)}><Icon name="x" size={18} color="#9b9a93" /></button>
              )}
            </div>
          ))}
          <button type="button" className="btn" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={addOpt}>
            <Icon name="plus" size={16} color="#185FA5" /> &nbsp;Lisää vaihtoehto
          </button>

          <label className="row-check" style={{ marginTop: 14 }}>
            <input type="checkbox" checked={multi} onChange={e => setMulti(e.target.checked)} /> Salli useita valintoja
          </label>

          <button type="submit" className="btn primary" style={{ marginTop: 16 }} disabled={busy}>Luo äänestys</button>
        </form>
      </div>
    </div>
  )
}
