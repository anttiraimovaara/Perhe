// Netlify-funktio: ottaa sanellun tekstin ja palauttaa siistityt,
// erilliset rivit. Anthropic-avain on vain täällä palvelimella.

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY puuttuu' }) }
  }

  let text = '', category = 'shopping', mode = 'items', today = '', members = []
  try {
    const body = JSON.parse(event.body || '{}')
    text = (body.text || '').slice(0, 4000)
    category = body.category || 'shopping'
    mode = ['title', 'event'].includes(body.mode) ? body.mode : 'items'
    today = (body.today || '').slice(0, 10)
    members = Array.isArray(body.members) ? body.members.slice(0, 12) : []
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Virheellinen pyyntö' }) }
  }
  if (!text.trim()) {
    const empty = mode === 'title' ? { title: '' } : mode === 'event' ? { event: null } : { items: [] }
    return { statusCode: 200, body: JSON.stringify(empty) }
  }

  // ---- Tila 0: poimi kalenteritapahtuma sanellusta puheesta ----
  if (mode === 'event') {
    const fiWeekdays = ['sunnuntai','maanantai','tiistai','keskiviikko','torstai','perjantai','lauantai']
    const weekday = today ? fiWeekdays[new Date(today + 'T12:00:00').getDay()] : ''
    const eventPrompt = `Tänään on ${today} (${weekday}). Käyttäjä saneli perheen kalenteritapahtuman.
Poimi siitä JSON-objekti tarkalleen näillä avaimilla:
{"title": "...", "date": "YYYY-MM-DD", "time": "HH:MM" tai null, "who": "..." tai null}
- title: lyhyt siisti otsikko suomeksi, iso alkukirjain.
- date: päivämäärä. Tulkitse suomalaiset ilmaukset suhteessa tähän päivään: "tänään", "huomenna", "ylihuomenna", "lauantaina", "ensi tiistai", "ensi viikolla". Jos vuotta ei mainita, käytä lähintä tulevaa päivää.
- time: kellonaika 24h-muodossa, tai null jos koko päivä. "kuudelta"=18:00, "puoli kahdeksan"=19:30, "aamukymmeneltä"=10:00.
- who: yksi näistä nimistä jos mainittu: ${members.join(', ')}. Tai "Koko perhe" jos koko perheen meno. Muuten null. Tulkitse taivutukset (esim. "Iisakin" -> "Iisakki").
Palauta VAIN JSON-objekti, ei muuta.

Sanelu: """${text}"""`
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{ role: 'user', content: eventPrompt }],
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        return { statusCode: 502, body: JSON.stringify({ error: 'Claude-virhe', detail: errText }) }
      }
      const data = await res.json()
      const raw = data?.content?.[0]?.text || '{}'
      const match = raw.match(/\{[\s\S]*\}/)
      let ev = null
      try { ev = JSON.parse(match ? match[0] : raw) } catch { ev = null }
      if (ev) {
        ev.title = String(ev.title || '').trim().slice(0, 120)
        ev.date = /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : null
        ev.time = /^\d{1,2}:\d{2}$/.test(ev.time || '') ? ev.time : null
        ev.who = ev.who ? String(ev.who).trim().slice(0, 40) : null
      }
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: ev }),
      }
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: String(err) }) }
    }
  }

  // ---- Tila 1: siisti listan nimi yhdeksi lyhyeksi otsikoksi ----
  if (mode === 'title') {
    const titlePrompt = `Käyttäjä saneli nimen uudelle listalle. Tee siitä yksi lyhyt, siisti otsikko suomeksi.
Korkeintaan 4 sanaa. Iso alkukirjain. Poista täytesanat. Älä lisää lainausmerkkejä tai pistettä.
Palauta VAIN otsikko, ei muuta.

Sanelu: """${text}"""`
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 64,
          messages: [{ role: 'user', content: titlePrompt }],
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        return { statusCode: 502, body: JSON.stringify({ error: 'Claude-virhe', detail: errText }) }
      }
      const data = await res.json()
      let title = (data?.content?.[0]?.text || '').trim()
      title = title.replace(/^["'“”]+|["'“”.]+$/g, '').trim().slice(0, 60)
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      }
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: String(err) }) }
    }
  }

  // ---- Tila 2: pilko puhe erillisiksi riveiksi ----
  const ohje = category === 'todo'
    ? 'Teksti on perheen tehtävälistalle saneltua puhetta. Pilko se erillisiksi tehtäviksi.'
    : 'Teksti on kauppalistalle saneltua puhetta. Pilko se erillisiksi ostettaviksi tuotteiksi.'

  const prompt = `${ohje}
Palauta JSON-taulukko merkkijonoista, jossa jokainen rivi on yksi lyhyt, siisti kohta suomeksi.
Yhdistä määrät tuotteeseen (esim. "2 litraa maitoa"). Poista täytesanat ("öö", "siis", "ja sitten").
Älä lisää mitään mitä tekstissä ei ole. Älä numeroi. Palauta VAIN JSON-taulukko, ei muuta.

Teksti: """${text}"""`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { statusCode: 502, body: JSON.stringify({ error: 'Claude-virhe', detail: errText }) }
    }

    const data = await res.json()
    const raw = data?.content?.[0]?.text || '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    let items = []
    try { items = JSON.parse(match ? match[0] : raw) } catch { items = [] }
    items = (Array.isArray(items) ? items : [])
      .map(s => String(s).trim())
      .filter(Boolean)
      .slice(0, 50)

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) }
  }
}
