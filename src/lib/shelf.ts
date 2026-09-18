// Sorting, grouping and saved preferences for the shelf.

export type SortOrder = 'newest' | 'oldest'

interface Dated {
  dateYear: string
  dateMonth: string
  dateDay: string
}

export interface MonthGroup<T> {
  key: string
  label: string
  books: T[]
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const num = (s: string) => {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

// Sort by date read. Undated books always go last.
// Books with the same date keep their current order.
export function sortBooks<T extends Dated>(books: T[], order: SortOrder): T[] {
  const dir = order === 'newest' ? -1 : 1
  return books
    .map((book, i) => ({ book, i, y: num(book.dateYear), m: num(book.dateMonth), d: num(book.dateDay) }))
    .sort((a, b) => {
      if (!a.y && !b.y) return a.i - b.i
      if (!a.y) return 1
      if (!b.y) return -1
      return dir * (a.y - b.y || a.m - b.m || a.d - b.d) || a.i - b.i
    })
    .map(x => x.book)
}

// Group an already-sorted list into sections like "March 2024".
// Year-only books go under "2024 · month not set".
export function groupByMonth<T extends Dated>(sortedBooks: T[]): MonthGroup<T>[] {
  const groups = new Map<string, MonthGroup<T>>()
  for (const book of sortedBooks) {
    const y = num(book.dateYear)
    const m = num(book.dateMonth)
    const hasMonth = y > 0 && m >= 1 && m <= 12
    const key = !y ? 'undated' : hasMonth ? `${y}-${String(m).padStart(2, '0')}` : `${y}-none`
    const label = !y ? 'Date not set' : hasMonth ? `${MONTHS[m - 1]} ${y}` : `${y} · month not set`
    let group = groups.get(key)
    if (!group) {
      group = { key, label, books: [] }
      groups.set(key, group)
    }
    group.books.push(book)
  }
  return Array.from(groups.values())
}

// Remember choices between visits (localStorage).
export function loadPref(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export function savePref(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}
