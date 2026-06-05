import { useState, useEffect } from 'react'
import { FAMILY, CATEGORIES, FAMILY_PIN } from './config'
import Icon from './Icon'
import PinGate from './components/PinGate'
import UserPicker from './components/UserPicker'
import ListsOverview from './components/ListsOverview'
import ListView from './components/ListView'

export default function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('perhe_pin_ok') === FAMILY_PIN)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('perhe_user')
    return FAMILY.find(f => f.name === saved) || null
  })
  // view: { name: 'home' } | { name: 'category', category } | { name: 'list', list }
  const [view, setView] = useState({ name: 'home' })

  useEffect(() => {
    if (user) localStorage.setItem('perhe_user', user.name)
  }, [user])

  if (!unlocked) {
    return <PinGate onOk={() => { localStorage.setItem('perhe_pin_ok', FAMILY_PIN); setUnlocked(true) }} />
  }
  if (!user) {
    return <UserPicker onPick={setUser} />
  }

  if (view.name === 'category') {
    return (
      <ListsOverview
        category={CATEGORIES.find(c => c.id === view.category)}
        user={user}
        onBack={() => setView({ name: 'home' })}
        onOpenList={(list) => setView({ name: 'list', list })}
      />
    )
  }
  if (view.name === 'list') {
    return (
      <ListView
        list={view.list}
        user={user}
        onBack={() => setView({ name: 'category', category: view.list.category })}
      />
    )
  }

  return <Home user={user} onPickUser={() => setUser(null)} onOpen={(id) => setView({ name: 'category', category: id })} />
}

function Home({ user, onPickUser, onOpen }) {
  return (
    <>
      <div className="topbar">
        <h1>Perheen työtila</h1>
        <button className="iconbtn" onClick={onPickUser} title="Vaihda käyttäjä"
          style={{ padding: 0 }}>
          <span className="avatar" style={{ background: user.bg, color: user.color }}>
            {user.name[0]}
          </span>
        </button>
      </div>
      <div className="page">
        <div className="grid2">
          {CATEGORIES.map(c => (
            <button key={c.id} className={'cat-card' + (c.ready ? '' : ' disabled')}
              onClick={() => c.ready && onOpen(c.id)}>
              <span className="cat-icon" style={{ background: c.bg }}>
                <Icon name={c.icon} size={26} color={c.color} />
              </span>
              <span className="cat-title">{c.title}</span>
              {!c.ready && <span className="cat-soon">Tulossa</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
