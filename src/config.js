// Perheenjäsenet. Jokaisella oma väri ja nimikirjaimet avataria varten.
export const FAMILY = [
  { name: 'Antti',   color: '#185FA5', bg: '#E6F1FB' },
  { name: 'Katja',   color: '#993556', bg: '#FBEAF0' },
  { name: 'Iisakki', color: '#0F6E56', bg: '#E1F5EE' },
  { name: 'Eelis',   color: '#854F0B', bg: '#FAEEDA' },
  { name: 'Meea',    color: '#534AB7', bg: '#EEEDFE' },
  { name: 'Petra',   color: '#993C1D', bg: '#FAECE7' },
]

// Etusivun kategoriat. shopping ja todo ovat käytössä, muut tulossa.
export const CATEGORIES = [
  { id: 'shopping', title: 'Kauppalista',  icon: 'cart',     color: '#185FA5', bg: '#E6F1FB', ready: true },
  { id: 'todo',     title: 'Tehtävät',     icon: 'check',    color: '#0F6E56', bg: '#E1F5EE', ready: true },
  { id: 'notes',    title: 'Muistilistat', icon: 'notes',    color: '#534AB7', bg: '#EEEDFE', ready: true },
  { id: 'calendar', title: 'Kalenteri',    icon: 'calendar', color: '#854F0B', bg: '#FAEEDA', ready: true },
  { id: 'polls',    title: 'Demokratia',   icon: 'poll',     color: '#1D9E75', bg: '#E1F5EE', ready: true },
  { id: 'notices',  title: 'Ilmoitukset',  icon: 'megaphone',color: '#D85A30', bg: '#FAECE7', ready: true },
]

export const FAMILY_PIN = import.meta.env.VITE_FAMILY_PIN || '1234'

// "Koko perhe" -valinta kalenterissa
export const KOKO_PERHE = { name: 'Koko perhe', color: '#5F5E5A', bg: '#F1EFE8' }

// Palauta henkilön väri nimellä (myös "Koko perhe")
export function colorFor(name) {
  if (name === KOKO_PERHE.name) return KOKO_PERHE
  return FAMILY.find(f => f.name === name) || { name, color: '#5F5E5A', bg: '#F1EFE8' }
}
