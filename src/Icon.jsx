// Pienet inline-SVG-ikonit (ei ulkoisia riippuvuuksia).
const PATHS = {
  cart: 'M6 6h15l-1.5 9h-12zM6 6L5 3H2m4 3l1.5 9m0 0a2 2 0 100 4 2 2 0 000-4m9 0a2 2 0 100 4 2 2 0 000-4',
  check: 'M4 12.5l5 5 11-11',
  notes: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
  camera: 'M3 8h4l2-2h6l2 2h4v12H3zM12 11a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  x: 'M6 6l12 12M18 6L6 18',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 3h-5l-.3 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.4h5l.3-2.4a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z',
  edit: 'M4 20h4L18.5 9.5l-4-4L4 16v4zM13.5 6.5l4 4',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  grip: 'M5 9h14M5 15h14',
  poll: 'M6 20V10M12 20V4M18 20v-7',
  megaphone: 'M4 10v4h3l9 5V5L7 10H4zM18 9a3 3 0 010 6',
}

export default function Icon({ name, size = 24, color = 'currentColor', stroke = 2, style }) {
  const d = PATHS[name] || ''
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true">
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  )
}
