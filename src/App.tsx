import { useState, useRef, useEffect, useCallback } from 'react'
import { sortBooks, groupByMonth, loadPref, savePref, type SortOrder } from './lib/shelf'

// ── Types ──────────────────────────────────────────────────────────────────
type Genre = 'All' | 'Nonfiction' | 'Fiction' | 'Sci-Fi' | 'Mystery & Thriller' | 'Fantasy' | 'Romance' | 'History'
const GENRES: Genre[] = ['All', 'Nonfiction', 'Fiction', 'Sci-Fi', 'Mystery & Thriller', 'Fantasy', 'Romance', 'History']
const BOOK_GENRES = GENRES.slice(1) as Exclude<Genre, 'All'>[]

type ViewMode = 'Covers' | 'Spines'

const GENRE_SPINE_COLORS: Record<Exclude<Genre,'All'>, string> = {
  'Nonfiction':        '#a0b4c8',
  'Fiction':           '#e8c4c4',
  'Sci-Fi':            '#b0b4e0',
  'Mystery & Thriller':'#7a5c7a',
  'Fantasy':           '#a8c4a8',
  'Romance':           '#e0a8b8',
  'History':           '#c8b480',
}

interface Book {
  id: string
  title: string
  author: string
  genre: Exclude<Genre, 'All'>
  dateYear: string
  dateMonth: string
  dateDay: string
  rating: number
  reflection: string
  reflectionEditedAt: string
  coverUrl: string
  coverColor: string
  spineWidth: number
  spineHeight: number
  spineLean: number
  offset: number
  isNew?: boolean
}

// ── Persistence (localStorage) ─────────────────────────────────────────────
const BOOKS_KEY = 'bookArchive.books.v1'
const VIEW_KEY = 'bookArchive.view.v1'

function loadBooks(): Book[] {
  try {
    const raw = localStorage.getItem(BOOKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((b: Book) => ({ ...b, isNew: false })) : []
  } catch { return [] }
}

function saveBooks(books: Book[]) {
  try {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books.map(({ isNew, ...rest }) => rest)))
  } catch {
    alert("Couldn't save your books: browser storage is full (large cover images can cause this). Try smaller cover images.")
  }
}

function loadView(): ViewMode {
  try { return localStorage.getItem(VIEW_KEY) === 'Spines' ? 'Spines' : 'Covers' } catch { return 'Covers' }
}
function formatDate(year: string, month: string, day: string) {
  if (!year) return ''
  if (!month) return year
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const m = months[parseInt(month) - 1] || ''
  if (!day) return `${m} ${year}`
  return `${m} ${day}, ${year}`
}

function todayLabel() {
  const d = new Date()
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0
}

// ── Book search (Google Books first, Open Library as backup) ───────────────
interface SearchResult { key: string; title: string; author: string; year: string; coverUrl: string }

async function searchGoogleBooks(query: string): Promise<SearchResult[]> {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&printType=books&fields=items(id,volumeInfo(title,authors,publishedDate,imageLinks/thumbnail))`)
  if (!res.ok) throw new Error('google books failed')
  const data = await res.json()
  return (data.items || []).slice(0, 4).map((item: any) => ({
    key: item.id as string,
    title: (item.volumeInfo?.title as string) || '',
    author: (item.volumeInfo?.authors as string[] | undefined)?.[0] || '',
    year: String(item.volumeInfo?.publishedDate || '').slice(0, 4),
    coverUrl: ((item.volumeInfo?.imageLinks?.thumbnail as string) || '').replace('http://', 'https://'),
  }))
}

async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
  const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=4&fields=key,title,author_name,first_publish_year,cover_i`)
  const data = await res.json()
  return (data.docs || []).slice(0, 4).map((doc: Record<string, unknown>) => ({
    key: doc.key as string, title: doc.title as string,
    author: (doc.author_name as string[] | undefined)?.[0] || '',
    year: String(doc.first_publish_year || ''),
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
  }))
}

async function searchBooks(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return []
  try {
    const r = await searchGoogleBooks(query)
    if (r.length) return r
  } catch { /* fall through to Open Library */ }
  try { return await searchOpenLibrary(query) } catch { return [] }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const PASTELS = ['linear-gradient(160deg,#e8d5c4,#c9b5a2)','linear-gradient(160deg,#c4d5e0,#a2b9c9)','linear-gradient(160deg,#d5c4e0,#b5a2c9)','linear-gradient(160deg,#c4e0d5,#a2c9b9)','linear-gradient(160deg,#e0d5c4,#c9b9a2)','linear-gradient(160deg,#e0c4c4,#c9a2a2)','linear-gradient(160deg,#c4e0c4,#a2c9a2)']
let pastelIdx = 0
function nextPastel() { return PASTELS[pastelIdx++ % PASTELS.length] }
function randBetween(min: number, max: number) { return min + Math.floor(Math.random() * (max - min + 1)) }

// ── AnimatedCount ──────────────────────────────────────────────────────────
function AnimatedCount({ count }: { count: number }) {
  const [display, setDisplay] = useState(count)
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => { setDisplay(count); setAnimKey(k => k + 1) }, [count])
  return (
    <span key={animKey} style={{ display: 'inline-block', animation: 'countChange 0.3s ease forwards', color: 'var(--accent)', fontSize: 12, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
      {display} {display === 1 ? 'volume' : 'volumes'}
    </span>
  )
}

// ── StarRating ─────────────────────────────────────────────────────────────
function StarRating({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hovered, setHovered] = useState(0)
  return (
    <span style={{ display: 'flex', gap: 4 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} onClick={() => onChange?.(s)} onMouseEnter={() => onChange && setHovered(s)} onMouseLeave={() => onChange && setHovered(0)}
          style={{ fontSize: size, cursor: onChange ? 'pointer' : 'default', color: (hovered || value) >= s ? '#c4956a' : 'rgba(150,130,115,0.3)', transition: 'color 0.15s, transform 0.1s', transform: hovered === s ? 'scale(1.2)' : 'scale(1)', display: 'inline-block', lineHeight: 1 }}>★</span>
      ))}
    </span>
  )
}

// ── FallbackCover ──────────────────────────────────────────────────────────
function FallbackCover({ title, author, color, width, height }: { title: string; author: string; color: string; width: number; height: number }) {
  return (
    <div style={{ width, height, background: color, borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 8px', textAlign: 'center', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.4)', flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(90deg,rgba(255,255,255,0.25),transparent)' }} />
      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: width * 0.09, fontWeight: 500, color: '#3a2a22', lineHeight: 1.3, wordBreak: 'break-word' }}>{title}</span>
      {author && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: width * 0.065, color: 'rgba(60,40,30,0.7)', marginTop: 6 }}>{author}</span>}
    </div>
  )
}

// ── Ruled textarea ─────────────────────────────────────────────────────────
function ReflectionTextarea({ value, onChange, minRows = 12, autoFocus }: {
  value: string; onChange: (v: string) => void; minRows?: number; autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (autoFocus && ref.current) { ref.current.focus(); ref.current.setSelectionRange(value.length, value.length) }
  }, [autoFocus])

  const grow = () => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = ref.current.scrollHeight + 'px'
  }
  useEffect(() => { grow() }, [value])

  const words = wordCount(value)

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        value={value}
        onChange={e => { onChange(e.target.value); grow() }}
        placeholder="Start writing…"
        style={{
          width: '100%',
          minHeight: minRows * 27,
          resize: 'none',
          background: 'rgba(255,251,246,0.7)',
          border: '1px solid rgba(200,180,165,0.35)',
          borderRadius: 16,
          padding: 20,
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 16,
          lineHeight: '27px',
          color: 'var(--text)',
          outline: 'none',
          transition: 'box-shadow 0.15s',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 26px, rgba(160,130,100,0.08) 26px, rgba(160,130,100,0.08) 27px)',
          backgroundPositionY: '20px',
          overflow: 'auto',
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(180,150,130,0.2)'; e.target.style.borderColor = 'rgba(180,140,110,0.5)' }}
        onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'rgba(200,180,165,0.35)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 2px' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Optional</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-muted)' }}>{words} {words === 1 ? 'word' : 'words'}</span>
      </div>
    </div>
  )
}

// ── BookCard (Covers view) ─────────────────────────────────────────────────
function BookCard({ book, onSelect, isNew }: { book: Book; onSelect: () => void; isNew?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const w = 200, h = 300
  return (
    <div onClick={onSelect} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', marginTop: book.offset, flexShrink: 0, animation: isNew ? 'slideLeft 0.4s ease forwards' : undefined, transition: 'transform 0.25s ease', transform: hovered ? 'translateY(-12px) scale(1.06)' : 'none', zIndex: hovered ? 10 : 1 }}>
      <div style={{ position: 'relative', width: w, height: h, borderRadius: 4, boxShadow: hovered ? '0 24px 48px rgba(0,0,0,0.3), 0 0 30px rgba(180,150,130,0.4)' : '0 10px 30px rgba(0,0,0,0.18)', transition: 'box-shadow 0.25s ease', animation: isNew ? 'glowPulse 0.8s ease 0.3s' : undefined }}>
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} style={{ width: w, height: h, objectFit: 'cover', borderRadius: 4, display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <FallbackCover title={book.title} author={book.author} color={book.coverColor} width={w} height={h} />
        )}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: 'linear-gradient(90deg,rgba(255,255,255,0.25),transparent)', borderRadius: '4px 0 0 4px', pointerEvents: 'none' }} />
      </div>
      <div style={{ marginTop: 10, textAlign: 'center', maxWidth: w, opacity: hovered ? 1 : 0, transform: hovered ? 'translateY(0)' : 'translateY(4px)', transition: 'opacity 0.2s ease, transform 0.2s ease', pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{book.author}</div>
        {book.dateYear && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{formatDate(book.dateYear, book.dateMonth, book.dateDay)}</div>}
      </div>
    </div>
  )
}

// ── SpineCard (Spines view) ────────────────────────────────────────────────
function SpineCard({ book, onSelect, isNew, hoveredId, setHoveredId }: {
  book: Book; onSelect: () => void; isNew?: boolean
  hoveredId: string | null; setHoveredId: (id: string | null) => void
}) {
  const isHovered = hoveredId === book.id
  const isDimmed = hoveredId !== null && !isHovered
  const spineColor = GENRE_SPINE_COLORS[book.genre]
  const isDark = spineColor.startsWith('#7') || spineColor.startsWith('#6') || spineColor.startsWith('#5')
  const textColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(50,30,25,0.85)'
  const lineColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(50,30,25,0.2)'
  const w = book.spineWidth, h = book.spineHeight

  return (
    <div onClick={onSelect} onMouseEnter={() => setHoveredId(book.id)} onMouseLeave={() => setHoveredId(null)}
      style={{ position: 'relative', flexShrink: 0, cursor: 'pointer', width: w, height: h, transform: `${isHovered ? 'translateY(-24px) scale(1.04)' : 'translateY(0) scale(1)'} rotate(${book.spineLean}deg)`, transition: 'transform 0.25s ease, opacity 0.25s ease, filter 0.25s ease', opacity: isDimmed ? 0.7 : 1, animation: isNew ? 'slideLeft 0.4s ease forwards' : undefined, zIndex: isHovered ? 10 : 1, marginRight: 2, filter: isDimmed ? 'brightness(0.85)' : 'brightness(1)' }}>
      <div style={{ position: 'absolute', inset: 0, background: spineColor, borderRadius: '3px 3px 0 0', boxShadow: isHovered ? `4px 0 20px rgba(0,0,0,0.3), 0 0 20px ${spineColor}80` : '2px 0 8px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg,rgba(255,255,255,0.2),transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 16, left: 6, right: 6, height: 1, background: lineColor }} />
        <div style={{ position: 'absolute', bottom: 20, left: 6, right: 6, height: 1, background: lineColor }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: 'Cormorant Garamond, serif', fontSize: Math.min(20, w * 0.36), fontWeight: 600, color: textColor, letterSpacing: '0.03em', maxHeight: h - 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>{book.title}</div>
        </div>
        {book.author && (
          <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: 'Inter, sans-serif', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: textColor, opacity: 0.6, maxHeight: 60, overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.author}</div>
          </div>
        )}
      </div>
      {isHovered && (
        <div style={{ position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(248,244,240,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(200,180,165,0.3)', borderRadius: 100, padding: '6px 14px', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeSlideIn 0.15s ease', zIndex: 20 }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{book.title}</span>
          {book.author && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-muted)' }}>{book.author}</span>}
          {book.rating > 0 && <span style={{ fontSize: 11, color: '#c4956a' }}>{'★'.repeat(book.rating)}</span>}
        </div>
      )}
    </div>
  )
}

// ── EmptyShelf ─────────────────────────────────────────────────────────────
function EmptyShelf({ genre, onAdd }: { genre: Genre; onAdd: () => void }) {
  const isFiltered = genre !== 'All'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flex: 1, paddingBottom: 40 }}>
      {!isFiltered && (
        <>
          <div style={{ display: 'flex', gap: 20, marginBottom: 32, alignItems: 'flex-end' }}>
            {[1,2,3].map(i => <div key={i} style={{ width: 120, height: 180, borderRadius: 4, border: '2px dashed rgba(150,130,120,0.25)', opacity: 0.35 + i * 0.07, marginTop: i === 2 ? -12 : i === 1 ? 8 : 0 }} />)}
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 400, color: 'var(--text)', marginBottom: 8, fontStyle: 'italic' }}>Your shelf is waiting.</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>Add the first book you've read.</div>
          <button onClick={onAdd} style={pillBtnStyle('dark')}>+ Add your first book</button>
        </>
      )}
      {isFiltered && (
        <div style={{ textAlign: 'center', paddingBottom: 60 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 12 }}>Nothing here yet — add a {genre} book.</div>
          <button onClick={onAdd} style={{ ...pillBtnStyle('ghost'), fontSize: 13 }}>+ Add a book</button>
        </div>
      )}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────
function pillBtnStyle(variant: 'dark' | 'ghost' | 'glass'): React.CSSProperties {
  const base: React.CSSProperties = { borderRadius: 100, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 500, transition: 'all 0.2s ease', border: 'none', outline: 'none' }
  if (variant === 'dark') return { ...base, background: 'var(--chip-active-bg)', color: 'var(--chip-active-text)', padding: '12px 28px' }
  if (variant === 'ghost') return { ...base, background: 'transparent', color: 'var(--text)', padding: '10px 22px', border: '1px solid var(--border)' }
  return { ...base, background: 'rgba(255,255,255,0.4)', color: 'var(--text)', padding: '10px 22px', border: '1px solid rgba(200,180,165,0.3)', backdropFilter: 'blur(8px)' }
}
const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(200,180,165,0.35)', borderRadius: 10, padding: '9px 13px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text)', outline: 'none' }
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }
const serifLabelStyle: React.CSSProperties = { display: 'block', fontFamily: 'Cormorant Garamond, serif', fontSize: 16, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }

// ── DateTripleDropdown ─────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const YEARS = Array.from({ length: new Date().getFullYear() - 1949 }, (_, i) => String(new Date().getFullYear() - i))

function daysInMonth(year: string, month: string) {
  if (!year || !month) return 31
  return new Date(parseInt(year), parseInt(month), 0).getDate()
}

function GlassSelect({ value, onChange, options, placeholder, widthPct }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string; widthPct: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && value && listRef.current) {
      const idx = options.indexOf(value)
      if (idx > -1) listRef.current.scrollTop = idx * 40 - 80
    }
  }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayValue = value ? (placeholder === 'Month' ? MONTHS[parseInt(value)-1] : value) : ''

  return (
    <div ref={ref} style={{ position: 'relative', width: widthPct, flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: '100%', height: 44, background: 'rgba(255,255,255,0.55)', border: `1px solid ${open ? 'rgba(180,140,110,0.5)' : 'rgba(200,180,165,0.35)'}`, borderRadius: 12, padding: '0 36px 0 13px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: displayValue ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', textAlign: 'left', boxShadow: open ? '0 0 0 3px rgba(180,150,130,0.18)' : 'none', transition: 'box-shadow 0.15s, border-color 0.15s', outline: 'none' }}>
        {displayValue || placeholder}
      </button>
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: 'transform 0.2s', fontSize: 10, color: 'var(--text-muted)', pointerEvents: 'none' }}>▾</span>
      {open && (
        <div ref={listRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: 'rgba(248,244,240,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(200,180,165,0.3)', borderRadius: 12, maxHeight: 220, overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.12)', scrollbarWidth: 'thin' }}>
          {options.map((opt, i) => {
            const label = placeholder === 'Month' ? MONTHS[parseInt(opt)-1] : opt
            const isSel = opt === value
            return (
              <div key={i} onClick={() => { onChange(opt); setOpen(false) }}
                style={{ padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer', background: isSel ? 'rgba(180,140,110,0.15)' : 'transparent', color: isSel ? 'var(--accent)' : 'var(--text)', fontWeight: isSel ? 500 : 400, transition: 'background 0.1s' }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = 'rgba(200,180,165,0.12)' }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >{label}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DateTripleDropdown({ year, month, day, onYearChange, onMonthChange, onDayChange }: {
  year: string; month: string; day: string
  onYearChange: (v: string) => void; onMonthChange: (v: string) => void; onDayChange: (v: string) => void
}) {
  const maxDay = daysInMonth(year, month)
  const dayOptions = Array.from({ length: maxDay }, (_, i) => String(i + 1))
  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const setToday = () => { const n = new Date(); onYearChange(String(n.getFullYear())); onMonthChange(String(n.getMonth() + 1)); onDayChange(String(n.getDate())) }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <label style={labelStyle}>Date Finished</label>
        <button type="button" onClick={setToday} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--accent)', textDecoration: 'underline' }}>Today</button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <GlassSelect value={year} onChange={onYearChange} options={YEARS} placeholder="Year" widthPct="45%" />
        <GlassSelect value={month} onChange={onMonthChange} options={monthOptions} placeholder="Month" widthPct="30%" />
        <GlassSelect value={day} onChange={onDayChange} options={dayOptions} placeholder="Day" widthPct="25%" />
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>Month and day are optional.</div>
    </div>
  )
}

// ── AddBookModal ───────────────────────────────────────────────────────────
function AddBookModal({ onClose, onAdd, initialBook }: {
  onClose: () => void
  onAdd: (book: Omit<Book, 'id' | 'offset' | 'isNew' | 'spineWidth' | 'spineHeight' | 'spineLean'>) => void
  initialBook?: Book
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [manual, setManual] = useState(!!initialBook)

  const now = new Date()
  const [title, setTitle] = useState(initialBook?.title || '')
  const [author, setAuthor] = useState(initialBook?.author || '')
  const [genre, setGenre] = useState<Exclude<Genre,'All'>>(initialBook?.genre || 'Fiction')
  const [dateYear, setDateYear] = useState(initialBook?.dateYear || String(now.getFullYear()))
  const [dateMonth, setDateMonth] = useState(initialBook?.dateMonth || String(now.getMonth() + 1))
  const [dateDay, setDateDay] = useState(initialBook?.dateDay || '')
  const [rating, setRating] = useState(initialBook?.rating || 0)
  const [reflection, setReflection] = useState(initialBook?.reflection || '')
  const [coverUrl, setCoverUrl] = useState(initialBook?.coverUrl || '')
  const [coverColor] = useState(initialBook?.coverColor || nextPastel())

  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const bodyRef = useRef<HTMLDivElement>(null)

  const handleQueryChange = (q: string) => {
    setQuery(q)
    clearTimeout(searchTimer.current)
    if (!q.trim()) { setResults([]); setShowResults(false); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const r = await searchBooks(q)
      setResults(r); setShowResults(true); setSearching(false)
    }, 400)
  }

  const pickResult = (r: SearchResult) => {
    setTitle(r.title); setAuthor(r.author); setCoverUrl(r.coverUrl)
    if (r.year) setDateYear(r.year)
    setShowResults(false); setQuery(''); setManual(true)
  }

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({ title: title.trim(), author, genre, dateYear, dateMonth, dateDay, rating, reflection, reflectionEditedAt: reflection ? todayLabel() : '', coverUrl, coverColor })
  }

  const previewW = 140, previewH = 210

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,20,15,0.4)', backdropFilter: 'blur(6px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(248,244,240,0.96)', backdropFilter: 'blur(24px)', borderRadius: 24, width: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', position: 'relative', animation: 'modalIn 0.28s ease' }}>

        {/* Pinned header */}
        <div style={{ padding: '32px 36px 0', flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 500, marginBottom: 24, color: 'var(--text)' }}>{initialBook ? 'Edit book' : 'Add a book'}</div>
        </div>

        {/* Scrollable body */}
        <div ref={bodyRef} style={{ overflowY: 'auto', padding: '0 36px', flex: 1, scrollbarWidth: 'thin' }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {/* Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {coverUrl ? (
                <img src={coverUrl} alt="preview" style={{ width: previewW, height: previewH, objectFit: 'cover', borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }} />
              ) : (
                <FallbackCover title={title} author={author} color={coverColor} width={previewW} height={previewH} />
              )}
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Preview</span>
            </div>

            {/* Fields */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!manual && (
                <div style={{ position: 'relative' }}>
                  <input placeholder="Search by title or author" value={query} onChange={e => handleQueryChange(e.target.value)} style={inputStyle} autoFocus />
                  {searching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>…</div>}
                  {showResults && results.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'rgba(248,244,240,0.98)', border: '1px solid var(--border)', borderRadius: 10, zIndex: 10, overflow: 'hidden', marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                      {results.map(r => (
                        <div key={r.key} onClick={() => pickResult(r)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(200,180,165,0.15)', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background='rgba(200,180,165,0.15)')}
                          onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                          {r.coverUrl ? <img src={r.coverUrl} alt="" style={{ width: 30, height: 45, objectFit: 'cover', borderRadius: 2 }} /> : <div style={{ width: 30, height: 45, background: 'rgba(180,160,145,0.2)', borderRadius: 2 }} />}
                          <div>
                            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{r.title}</div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>{r.author} {r.year && `· ${r.year}`}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setManual(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--accent)', textDecoration: 'underline', marginTop: 6, display: 'block' }}>Can't find it? Enter it manually.</button>
                </div>
              )}
              {manual && (
                <>
                  <div><label style={labelStyle}>Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Book title" style={inputStyle} autoFocus={!initialBook} /></div>
                  <div><label style={labelStyle}>Author</label><input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author name" style={inputStyle} /></div>
                </>
              )}
              <div>
                <label style={labelStyle}>Genre</label>
                <select value={genre} onChange={e => setGenre(e.target.value as Exclude<Genre,'All'>)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {BOOK_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <DateTripleDropdown year={dateYear} month={dateMonth} day={dateDay} onYearChange={setDateYear} onMonthChange={setDateMonth} onDayChange={setDateDay} />
              <div><label style={labelStyle}>Rating</label><StarRating value={rating} onChange={setRating} size={22} /></div>
              <div><label style={labelStyle}>Cover URL (optional)</label><input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://…" style={inputStyle} /></div>
            </div>
          </div>

          {/* Reflection — full width, below the two-column section */}
          <div style={{ marginTop: 28, marginBottom: 8 }}>
            <label style={serifLabelStyle}>Your reflection</label>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Your thoughts, what stayed with you, favorite moments, how it made you feel. Take as much space as you need.</div>
            <ReflectionTextarea value={reflection} onChange={setReflection} minRows={12} />
          </div>
        </div>

        {/* Pinned footer */}
        <div style={{ padding: '20px 36px 28px', flexShrink: 0, display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid rgba(200,180,165,0.15)' }}>
          <button onClick={onClose} style={{ ...pillBtnStyle('ghost'), padding: '11px 24px' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim()} style={{ ...pillBtnStyle('dark'), padding: '11px 28px', opacity: title.trim() ? 1 : 0.4, cursor: title.trim() ? 'pointer' : 'not-allowed' }}>
            {initialBook ? 'Save changes' : 'Add to shelf'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SavedToast ─────────────────────────────────────────────────────────────
function SavedToast({ visible }: { visible: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: 32, left: '50%', transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`,
      opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease, transform 0.3s ease',
      background: 'rgba(50,35,25,0.92)', color: '#f5f0eb', borderRadius: 100,
      padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontSize: 12, letterSpacing: '0.06em',
      display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none', zIndex: 500,
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    }}>
      <span style={{ fontSize: 14 }}>✓</span> Saved
    </div>
  )
}

// ── BookDetailPanel ────────────────────────────────────────────────────────
function BookDetailPanel({ book, onClose, onRemove, onEditDetails, onSaveReflection }: {
  book: Book
  onClose: () => void
  onRemove: () => void
  onEditDetails: () => void
  onSaveReflection: (text: string, editedAt: string) => void
}) {
  const [reflExpanded, setReflExpanded] = useState(false)
  const [reflEditMode, setReflEditMode] = useState(false)
  const [reflDraft, setReflDraft] = useState(book.reflection)
  const [reflEditedAt, setReflEditedAt] = useState(book.reflectionEditedAt)
  const [showToast, setShowToast] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { requestAnimationFrame(() => setMounted(true)) }, [])

  const saveReflection = () => {
    const today = todayLabel()
    setReflEditedAt(today)
    setReflEditMode(false)
    setReflExpanded(true)
    setShowToast(true)
    onSaveReflection(reflDraft, today)
    setTimeout(() => setShowToast(false), 2500)
  }

  const cancelEdit = () => { setReflDraft(book.reflection); setReflEditMode(false) }

  const cw = 140, ch = 210
  const COLLAPSED_LINES = 5
  const lineH = 27
  const collapsedH = COLLAPSED_LINES * lineH

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,12,8,0.28)', backdropFilter: 'blur(2px)', transition: 'opacity 0.3s' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 560, zIndex: 101,
        background: 'rgba(247,242,237,0.97)', backdropFilter: 'blur(28px)',
        borderRadius: '24px 0 0 24px',
        boxShadow: '-8px 0 48px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
        transform: mounted ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.32,0,0.1,1)',
        overflowY: 'auto', scrollbarWidth: 'thin',
      }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: 'sticky', top: 16, left: 'calc(100% - 52px)', display: 'block', marginLeft: 'auto', marginRight: 20, background: 'rgba(200,185,170,0.25)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', width: 32, height: 32, borderRadius: 100, lineHeight: '32px', textAlign: 'center', flexShrink: 0, zIndex: 10 }}>×</button>

        <div style={{ padding: '0 36px 40px', marginTop: -32 }}>
          {/* ── Top: cover + meta ── */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', paddingTop: 40 }}>
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} style={{ width: cw, height: ch, objectFit: 'cover', borderRadius: 4, flexShrink: 0, boxShadow: '0 12px 28px rgba(0,0,0,0.2)' }} onError={e => (e.target as HTMLImageElement).style.display='none'} />
            ) : (
              <FallbackCover title={book.title} author={book.author} color={book.coverColor} width={cw} height={ch} />
            )}
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 500, color: 'var(--text)', lineHeight: 1.2, marginBottom: 8 }}>{book.title}</div>
              {book.author && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>{book.author}</div>}
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', background: 'rgba(180,100,80,0.1)', padding: '4px 12px', borderRadius: 100, display: 'inline-block', marginBottom: 14 }}>{book.genre}</span>
              {book.dateYear && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{formatDate(book.dateYear, book.dateMonth, book.dateDay)}</div>}
              {book.rating > 0 && <StarRating value={book.rating} size={18} />}
            </div>
          </div>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: 'rgba(200,180,165,0.3)', margin: '28px 0' }} />

          {/* ── Reflection section ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500 }}>My Reflection</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {reflEditedAt && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-muted)' }}>Last edited {reflEditedAt}</span>}
                {reflExpanded && !reflEditMode && book.reflection && (
                  <button onClick={() => setReflEditMode(true)} style={{ ...pillBtnStyle('glass'), padding: '6px 14px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6.5 1.5l2 2L3 9H1V7L6.5 1.5z"/></svg>
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* No reflection yet */}
            {!book.reflection && !reflEditMode && (
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                No reflection yet.{' '}
                <button onClick={() => { setReflEditMode(true); setReflExpanded(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 16, color: 'var(--accent)', textDecoration: 'underline' }}>Write one</button>
              </div>
            )}

            {/* Reflection text — collapsed or expanded */}
            {book.reflection && !reflEditMode && (
              <div>
                <div
                  onClick={() => setReflExpanded(e => !e)}
                  style={{
                    position: 'relative',
                    maxHeight: reflExpanded ? 'none' : collapsedH,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'max-height 0.3s ease',
                  }}
                >
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, lineHeight: '27px', color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {book.reflection}
                  </div>
                  {!reflExpanded && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, rgba(247,242,237,0.97))', pointerEvents: 'none' }} />
                  )}
                </div>
                <button onClick={() => setReflExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--accent)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'underline' }}>
                  {reflExpanded ? 'Show less ↑' : 'Read more ↓'}
                </button>
              </div>
            )}

            {/* Edit mode */}
            {reflEditMode && (
              <div>
                <ReflectionTextarea value={reflDraft} onChange={setReflDraft} minRows={12} autoFocus />
                <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                  <button onClick={cancelEdit} style={{ ...pillBtnStyle('ghost'), padding: '9px 20px', fontSize: 11 }}>Cancel</button>
                  <button onClick={saveReflection} style={{ ...pillBtnStyle('dark'), padding: '9px 22px', fontSize: 11 }}>Save</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: 'rgba(200,180,165,0.3)', margin: '28px 0' }} />

          {/* ── Footer actions ── */}
          {!confirmRemove ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onEditDetails} style={{ ...pillBtnStyle('ghost'), padding: '10px 20px', fontSize: 11 }}>Edit details</button>
              <button onClick={() => setConfirmRemove(true)} style={{ ...pillBtnStyle('ghost'), padding: '10px 20px', fontSize: 11, color: '#b05050', borderColor: 'rgba(180,80,80,0.25)' }}>Remove</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)' }}>Remove this book from your shelf?</span>
              <button onClick={onRemove} style={{ ...pillBtnStyle('dark'), padding: '8px 18px', fontSize: 11, background: '#b05050' }}>Remove</button>
              <button onClick={() => setConfirmRemove(false)} style={{ ...pillBtnStyle('ghost'), padding: '8px 14px', fontSize: 11 }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      <SavedToast visible={showToast} />
    </>
  )
}

// ── ViewToggle ─────────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(200,180,165,0.3)', borderRadius: 100, height: 36, padding: 3, gap: 2, backdropFilter: 'blur(8px)', flexShrink: 0 }}>
      {(['Covers','Spines'] as ViewMode[]).map(v => (
        <button key={v} onClick={() => onChange(v)} style={{ height: '100%', padding: '0 14px', borderRadius: 100, border: 'none', cursor: 'pointer', background: view === v ? 'var(--chip-active-bg)' : 'transparent', color: view === v ? 'var(--chip-active-text)' : 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 5 }}>
          {v === 'Covers'
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="0" width="5" height="5" rx="1"/><rect x="7" y="0" width="5" height="5" rx="1"/><rect x="0" y="7" width="5" height="5" rx="1"/><rect x="7" y="7" width="5" height="5" rx="1"/></svg>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="0" width="2" height="12" rx="1"/><rect x="3.5" y="0" width="2" height="12" rx="1"/><rect x="7" y="0" width="2" height="12" rx="1"/><rect x="10.5" y="0" width="2" height="12" rx="1"/></svg>
          }
          {v}
        </button>
      ))}
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [books, setBooks] = useState<Book[]>(loadBooks)
  const [activeGenre, setActiveGenre] = useState<Genre>('All')
  const [view, setView] = useState<ViewMode>(loadView)
  const [showModal, setShowModal] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [editBook, setEditBook] = useState<Book | null>(null)
  const [hoveredSpineId, setHoveredSpineId] = useState<string | null>(null)
  const shelfRef = useRef<HTMLDivElement>(null)
    const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => loadPref('bookArchive.sort.v1', 'newest') === 'oldest' ? 'oldest' : 'newest')
  const [groupMode, setGroupMode] = useState<'shelf' | 'month'>(() => loadPref('bookArchive.group.v1', 'shelf') === 'month' ? 'month' : 'shelf')
  const [monthKey, setMonthKey] = useState<string>(() => loadPref('bookArchive.month.v1', ''))
  useEffect(() => { saveBooks(books) }, [books])
useEffect(() => { try { localStorage.setItem(VIEW_KEY, view) } catch {} }, [view])
    useEffect(() => { savePref('bookArchive.sort.v1', sortOrder) }, [sortOrder])
  useEffect(() => { savePref('bookArchive.group.v1', groupMode) }, [groupMode])
  useEffect(() => { savePref('bookArchive.month.v1', monthKey) }, [monthKey])

   const filteredBooks = sortBooks(activeGenre === 'All' ? books : books.filter(b => b.genre === activeGenre), sortOrder)
  const groups = groupByMonth(filteredBooks)

  const scrollToGroup = (key: string, smooth = true) => {
    const el = groupRefs.current[key]
    const row = shelfRef.current
    if (!el || !row) return
    const left = el.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - 40
    row.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' })
  }
  const jumpToMonth = (key: string) => { setMonthKey(key); if (key) scrollToGroup(key) }

  // Return to the saved month when the By month view opens
  useEffect(() => {
    if (groupMode !== 'month' || !monthKey) return
    const t = setTimeout(() => scrollToGroup(monthKey, false), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupMode, view])
  const addBook = useCallback((data: Omit<Book, 'id' | 'offset' | 'isNew' | 'spineWidth' | 'spineHeight' | 'spineLean'>) => {
    const newBook: Book = {
      ...data, id: crypto.randomUUID(),
      offset: Math.round(Math.random() * 16 - 8),
      spineWidth: randBetween(44, 64),
      spineHeight: randBetween(260, 340),
      spineLean: (Math.random() > 0.7 ? 1 : -1) * randBetween(0, 3),
      isNew: true,
    }
    setBooks(prev => [newBook, ...prev])
    setShowModal(false)
    setTimeout(() => setBooks(prev => prev.map(b => b.id === newBook.id ? { ...b, isNew: false } : b)), 1000)
    setTimeout(() => shelfRef.current?.scrollTo({ left: 0, behavior: 'smooth' }), 100)
  }, [])

  const removeBook = (id: string) => { setBooks(prev => prev.filter(b => b.id !== id)); setSelectedBook(null) }

  const updateBook = (data: Omit<Book, 'id' | 'offset' | 'isNew' | 'spineWidth' | 'spineHeight' | 'spineLean'>) => {
    if (!editBook) return
    setBooks(prev => prev.map(b => b.id === editBook.id ? { ...b, ...data } : b))
    setEditBook(null); setSelectedBook(null)
  }

  const saveReflection = (id: string, text: string, editedAt: string) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, reflection: text, reflectionEditedAt: editedAt } : b))
    setSelectedBook(prev => prev?.id === id ? { ...prev, reflection: text, reflectionEditedAt: editedAt } : prev)
  }

  const shelfOverflows = filteredBooks.length * (view === 'Covers' ? 228 : 66) > (typeof window !== 'undefined' ? window.innerWidth : 1200)|| groupMode === 'month'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Radial glows */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 600, height: 400, background: 'radial-gradient(ellipse,rgba(210,190,175,0.35),transparent 70%)', transform: 'translate(-50%,-50%)' }} />
        <div style={{ position: 'absolute', top: '60%', right: '20%', width: 500, height: 350, background: 'radial-gradient(ellipse,rgba(180,190,210,0.25),transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '50%', width: 800, height: 300, background: 'radial-gradient(ellipse,rgba(200,180,165,0.2),transparent 70%)', transform: 'translateX(-50%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* ── Header ── */}
        <header style={{ padding: 'clamp(32px,4vw,48px) clamp(24px,5vw,64px) 28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>A Personal Archive</div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 400, color: 'var(--text)', lineHeight: 1.1, marginBottom: 10 }}>
              Thoughts on Books <em style={{ fontStyle: 'italic' }}>I've Read</em>
            </h1>
            <AnimatedCount count={books.length} />
          </div>
          <button onClick={() => setShowModal(true)} style={{ ...pillBtnStyle('glass'), marginTop: 16, whiteSpace: 'nowrap', flexShrink: 0 }}>+ Add a book</button>
        </header>

        {/* ── Filter bar + view toggle ── */}
        <div style={{ padding: '0 clamp(24px,5vw,64px) 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ overflowX: 'auto', display: 'flex', gap: 8, scrollbarWidth: 'none', flex: 1 }}>
            {GENRES.map(g => (
              <button key={g} onClick={() => setActiveGenre(g)} style={{ ...pillBtnStyle(activeGenre === g ? 'dark' : 'glass'), padding: '8px 18px', flexShrink: 0, opacity: books.length === 0 ? 0.4 : 1, background: activeGenre === g ? 'var(--chip-active-bg)' : 'rgba(255,255,255,0.35)', color: activeGenre === g ? 'var(--chip-active-text)' : 'var(--text)' }}>{g}</button>
            ))}
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>

                {/* ── Sort + By month ── */}
        {books.length > 0 && (
          <div style={{ padding: '0 clamp(24px,5vw,64px) 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')} style={{ ...pillBtnStyle('glass'), padding: '6px 14px', fontSize: 12 }}>
              {sortOrder === 'newest' ? 'Newest first ↓' : 'Oldest first ↑'}
            </button>
            <button onClick={() => setGroupMode(m => m === 'month' ? 'shelf' : 'month')} style={{ ...pillBtnStyle(groupMode === 'month' ? 'dark' : 'glass'), padding: '6px 14px', fontSize: 12 }}>
              By month
            </button>
            {groupMode === 'month' && (
              <select
                value={groups.some(g => g.key === monthKey) ? monthKey : ''}
                onChange={e => jumpToMonth(e.target.value)}
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text)', background: 'rgba(255,255,255,0.35)', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 14px', outline: 'none' }}
              >
                <option value="">Jump to month…</option>
                {groups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            )}
          </div>
        )}
        
        {/* ── Shelf ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {filteredBooks.length === 0 ? (
            <EmptyShelf genre={activeGenre} onAdd={() => setShowModal(true)} />
          ) : (
            <div ref={shelfRef} style={{ overflowX: shelfOverflows ? 'auto' : 'visible', display: 'flex', gap: groupMode === 'month' ? 56 : view === 'Covers' ? 28 : 0, alignItems: 'flex-end', padding: `0 clamp(24px,5vw,64px) 0`, scrollbarWidth: 'thin' }}>
                           {(groupMode === 'month' ? groups : [{ key: 'all', label: '', books: filteredBooks }]).map(g => (
                <div key={g.key} ref={el => { groupRefs.current[g.key] = el }} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  {groupMode === 'month' && (
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, whiteSpace: 'nowrap' }}>{g.label}</div>
                  )}
                  <div style={{ display: 'flex', gap: view === 'Covers' ? 28 : 0, alignItems: 'flex-end' }}>
                    {g.books.map(book => view === 'Covers'
                      ? <BookCard key={book.id} book={book} isNew={book.isNew} onSelect={() => setSelectedBook(book)} />
                      : <SpineCard key={book.id} book={book} isNew={book.isNew} onSelect={() => setSelectedBook(book)} hoveredId={hoveredSpineId} setHoveredId={setHoveredSpineId} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Shelf line */}
          <div style={{ position: 'relative', marginTop: 20, height: 36 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'var(--shelf-line)' }} />
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 20, background: 'linear-gradient(180deg, rgba(180,155,135,0.3), transparent)', filter: 'blur(6px)' }} />
            <div style={{ position: 'absolute', top: 2, left: 0, right: 0, height: 24, background: 'linear-gradient(180deg,rgba(200,185,170,0.12),transparent)', filter: 'blur(2px)' }} />
          </div>
        </div>
      </div>

      {/* ── Overlays ── */}
      {showModal && <AddBookModal onClose={() => setShowModal(false)} onAdd={addBook} />}
      {editBook && <AddBookModal onClose={() => setEditBook(null)} onAdd={updateBook} initialBook={editBook} />}
      {selectedBook && !editBook && (
        <BookDetailPanel
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onRemove={() => removeBook(selectedBook.id)}
          onEditDetails={() => { setEditBook(selectedBook); setSelectedBook(null) }}
          onSaveReflection={(text, editedAt) => saveReflection(selectedBook.id, text, editedAt)}
        />
      )}
    </div>
  )
}
