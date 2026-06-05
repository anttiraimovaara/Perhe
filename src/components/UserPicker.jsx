import { FAMILY } from '../config'

export default function UserPicker({ onPick }) {
  return (
    <div className="center">
      <h2>Kuka sinä olet?</h2>
      <p>Valinta muistetaan tällä laitteella.</p>
      <div className="user-grid">
        {FAMILY.map(f => (
          <button key={f.name} className="user-pick" onClick={() => onPick(f)}>
            <span className="avatar-lg" style={{ background: f.bg, color: f.color }}>{f.name[0]}</span>
            <span className="pname">{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
