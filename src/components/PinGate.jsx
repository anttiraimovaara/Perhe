import { useState } from 'react'
import { FAMILY_PIN } from '../config'

export default function PinGate({ onOk }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (pin === FAMILY_PIN) onOk()
    else { setError(true); setPin('') }
  }

  return (
    <div className="center">
      <h2>Perheen työtila</h2>
      <p>Syötä perheen yhteinen koodi.</p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <input
          className="pin-input" type="password" inputMode="numeric" autoFocus
          value={pin} onChange={e => { setPin(e.target.value); setError(false) }}
          placeholder="••••"
        />
        {error && <p style={{ color: '#A32D2D' }}>Väärä koodi, yritä uudelleen.</p>}
        <button className="btn primary" type="submit" disabled={!pin}>Avaa</button>
      </form>
    </div>
  )
}
