import { useState, useRef } from 'react'
import Icon from '../Icon'

// Web Speech API -sanelu. Toimii iPhonen Safarissa ja Android/desktop Chromessa.
export default function Dictation({ onResult, disabled }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)

  const SR = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  if (!SR) {
    return (
      <button className="btn" disabled title="Sanelu ei ole tuettu tässä selaimessa">
        <Icon name="mic" size={22} color="#9b9a93" />
      </button>
    )
  }

  function start() {
    const rec = new SR()
    rec.lang = 'fi-FI'
    rec.interimResults = false
    rec.continuous = true
    let collected = ''
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) collected += e.results[i][0].transcript + '\n'
      }
    }
    rec.onerror = () => { setListening(false) }
    rec.onend = () => {
      setListening(false)
      if (collected.trim()) onResult(collected.trim())
    }
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  function stop() {
    recRef.current?.stop()
  }

  return (
    <button
      className={'btn' + (listening ? ' primary' : '')}
      onClick={listening ? stop : start}
      disabled={disabled}
      title={listening ? 'Lopeta sanelu' : 'Sanele'}
    >
      <Icon name="mic" size={22} color={listening ? '#fff' : '#185FA5'} />
    </button>
  )
}
