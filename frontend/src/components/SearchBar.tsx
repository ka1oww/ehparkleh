import { useEffect, useRef, useState } from 'react'
import { AlertCircle, MapPin, Search, LocateFixed, Loader2, Clock, X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CheckingLotsChip } from '@/components/GantryLockup'
import { cn } from '@/lib/utils'
import { formatLastSeen } from '@/stale'
import type { Suggestion } from '@/types'
import type { RecentSearch } from '@/useRecentSearches'

interface Props {
  apiBase: string
  loading: boolean
  /** Geocode a free-text query (Enter / Search button). */
  onSubmit: (query: string) => void
  /** Resolve a picked suggestion straight to coordinates. */
  onPickSuggestion: (s: Suggestion) => void
  onNearMe: () => void
  /** Recent destination searches, shown when the panel is open. */
  recents: RecentSearch[]
  onPickRecent: (r: RecentSearch) => void
  onClearRecents: () => void
}

const LISTBOX_ID = 'searchbar-listbox'
const STATUS_ID = 'searchbar-status'
const SUGGESTIONS_TIMEOUT_MS = 5_000
type SuggestionState = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

// One focused-search row, per Search.dc.html: an icon that says where the row
// came from (a clock for somewhere you have been, a pin for somewhere the
// address service found), the place, a quiet second line, and a chevron.
function SearchRow({
  id,
  active,
  onPick,
  onHover,
  icon,
  title,
  sub,
}: {
  id: string
  active: boolean
  onPick: () => void
  onHover: () => void
  icon: React.ReactNode
  title: string
  sub?: string | null
}) {
  return (
    <li id={id} role="option" aria-selected={active}>
      <button
        type="button"
        onMouseDown={onPick}
        onMouseEnter={onHover}
        className={cn(
          'flex min-h-[52px] w-full items-center gap-3 border-b-[1.5px] border-hairline px-3.5 py-2.5 text-left last:border-b-0',
          active ? 'bg-secondary' : 'hover:bg-secondary/60',
        )}
      >
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold text-ink">{title}</span>
          {sub && <span className="block truncate text-xs text-slate-body">{sub}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-eyebrow" aria-hidden="true" />
      </button>
    </li>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <li
      aria-hidden="true"
      className="px-3.5 pt-4 pb-1.5 text-[11px] font-extrabold tracking-[0.1em] text-eyebrow uppercase first:pt-3"
    >
      {children}
    </li>
  )
}

// Kaya signboard search with debounced server-side autocomplete.
// Debounce 300ms, query at >=2 chars, geocode on Enter, and search suggestion
// coordinates directly. Valid empty responses and retryable failures remain
// distinct so an upstream outage never masquerades as no matches.
export function SearchBar({
  apiBase,
  loading,
  onSubmit,
  onPickSuggestion,
  onNearMe,
  recents,
  onPickRecent,
  onClearRecents,
}: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionState, setSuggestionState] = useState<SuggestionState>('idle')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suggestionAbortRef = useRef<AbortController | null>(null)
  const suggestionRequestRef = useRef(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      clearTimeout(debounceRef.current)
      suggestionAbortRef.current?.abort()
    }
  }, [])

  async function requestSuggestions(value: string) {
    suggestionAbortRef.current?.abort()
    const controller = new AbortController()
    suggestionAbortRef.current = controller
    const requestId = ++suggestionRequestRef.current
    const timeout = setTimeout(() => controller.abort(), SUGGESTIONS_TIMEOUT_MS)
    setSuggestionState('loading')
    setSuggestions([])

    try {
      const res = await fetch(`${apiBase}/api/suggestions?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`suggestions ${res.status}`)
      const data: Suggestion[] = await res.json()
      if (requestId !== suggestionRequestRef.current) return
      setSuggestions(data)
      setSuggestionState(data.length > 0 ? 'ready' : 'empty')
      setOpen(true)
    } catch {
      if (requestId !== suggestionRequestRef.current) return
      setSuggestions([])
      setSuggestionState('error')
      setOpen(true)
    } finally {
      clearTimeout(timeout)
    }
  }

  function cancelSuggestionRequest() {
    clearTimeout(debounceRef.current)
    suggestionAbortRef.current?.abort()
    suggestionRequestRef.current += 1
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setActiveIdx(-1)
    cancelSuggestionRequest()
    if (val.trim().length < 2) {
      setSuggestions([])
      setSuggestionState('idle')
      // Under two characters there is nothing to ask the address service, but
      // the recents are still worth showing if there are any.
      setOpen(recents.length > 0)
      return
    }
    // The panel stays open through the request so the LED chip can say the app
    // is checking, rather than the list blinking out and back.
    setSuggestionState('loading')
    setOpen(true)
    debounceRef.current = setTimeout(() => void requestSuggestions(val), 300)
  }

  function pick(s: Suggestion) {
    cancelSuggestionRequest()
    setQuery(s.address)
    setSuggestions([])
    setSuggestionState('idle')
    setOpen(false)
    setActiveIdx(-1)
    onPickSuggestion(s)
  }

  function pickRecent(r: RecentSearch) {
    cancelSuggestionRequest()
    setQuery(r.query)
    setSuggestions([])
    setSuggestionState('idle')
    setOpen(false)
    setActiveIdx(-1)
    onPickRecent(r)
  }

  function clearInput() {
    cancelSuggestionRequest()
    setQuery('')
    setSuggestions([])
    setSuggestionState('idle')
    setActiveIdx(-1)
    setOpen(recents.length > 0)
    inputRef.current?.focus()
  }

  // The focused view stacks RECENT above SUGGESTIONS, as the artboard does, so
  // keyboard navigation runs over one combined list rather than per-section.
  const showRecents = open && recents.length > 0
  const showSuggestions = open && suggestions.length > 0
  const options: ({ kind: 'recent'; item: RecentSearch } | { kind: 'suggestion'; item: Suggestion })[] = [
    ...(showRecents ? recents.map((item) => ({ kind: 'recent' as const, item })) : []),
    ...(showSuggestions ? suggestions.map((item) => ({ kind: 'suggestion' as const, item })) : []),
  ]
  const checking = open && suggestionState === 'loading' && query.trim().length >= 2
  const showSuggestionMessage =
    open && query.trim().length >= 2 && (suggestionState === 'empty' || suggestionState === 'error')
  // One popup, always: sections, then whichever footer the state calls for.
  // Two absolutely-positioned boxes would otherwise sit on top of each other
  // the moment a no-match arrives while there are recents to show.
  const showPanel = options.length > 0 || checking || showSuggestionMessage

  function pickOption(index: number) {
    const option = options[index]
    if (!option) return
    if (option.kind === 'recent') pickRecent(option.item)
    else pick(option.item)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (activeIdx >= 0 && options[activeIdx]) {
      pickOption(activeIdx)
      return
    }
    if (!query.trim()) return
    cancelSuggestionRequest()
    setSuggestions([])
    setSuggestionState('idle')
    setOpen(false)
    onSubmit(query)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (options.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i <= 0 ? options.length - 1 : i - 1))
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div ref={boxRef} className="relative flex-1">
        <form onSubmit={handleSubmit} className="flex items-center gap-2" role="search">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-link"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (
                  suggestions.length > 0 ||
                  suggestionState === 'empty' ||
                  suggestionState === 'error' ||
                  recents.length > 0
                ) setOpen(true)
              }}
              placeholder="Where to, boss?"
              autoComplete="off"
              aria-label="Search a destination"
              role="combobox"
              aria-expanded={showPanel}
              aria-controls={options.length > 0 ? LISTBOX_ID : STATUS_ID}
              aria-autocomplete="list"
              aria-activedescendant={activeIdx >= 0 ? `${LISTBOX_ID}-opt-${activeIdx}` : undefined}
              // text-base (16px) on mobile so iOS Safari doesn't auto-zoom on focus.
              className={cn(
                'h-12 w-full rounded-lg border-2 border-kaya-dark bg-background pl-10 text-base font-bold text-ink shadow-sm sm:text-sm',
                query ? 'pr-10' : 'pr-3',
                'placeholder:font-bold placeholder:text-muted-foreground',
                'focus-visible:border-panel focus-visible:ring-2 focus-visible:ring-panel/60 focus-visible:outline-none',
              )}
            />
            {query && (
              <button
                type="button"
                onClick={clearInput}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 shrink-0 rounded-lg bg-panel px-4 font-display text-base font-extrabold text-ink hover:bg-panel/85"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
          </Button>
        </form>

        {/* The focused-search view. On a phone it takes over most of the
            screen, as the artboard draws it; on a wide window it stays the
            dropdown attached to the field it belongs to. */}
        {showPanel && (
          <div className="absolute top-[calc(100%+0.5rem)] right-0 left-0 z-30 flex max-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-lg border-[1.5px] border-hairline bg-popover shadow-lg sm:max-h-[26rem]">
            <ul id={LISTBOX_ID} role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {showRecents && (
                <>
                  <SectionLabel>
                    <span className="flex items-center justify-between">
                      Recent
                      <button
                        type="button"
                        onMouseDown={onClearRecents}
                        className="text-xs font-bold tracking-normal text-muted-foreground normal-case hover:text-foreground"
                      >
                        Clear
                      </button>
                    </span>
                  </SectionLabel>
                  {recents.map((r, i) => (
                    <SearchRow
                      key={`recent-${r.query}`}
                      id={`${LISTBOX_ID}-opt-${i}`}
                      active={i === activeIdx}
                      onPick={() => pickRecent(r)}
                      onHover={() => setActiveIdx(i)}
                      icon={<Clock className="size-[18px] text-eyebrow" />}
                      title={r.query}
                      // The only honest second line for a recent is when it was
                      // searched; anything about what is there now would be a
                      // count we have not checked.
                      sub={(() => {
                        const ago = formatLastSeen(r.ts)
                        return ago ? `searched ${ago}` : null
                      })()}
                    />
                  ))}
                </>
              )}
              {showSuggestions && (
                <>
                  <SectionLabel>Suggestions</SectionLabel>
                  {suggestions.map((s, i) => {
                    const idx = (showRecents ? recents.length : 0) + i
                    return (
                      <SearchRow
                        key={`suggestion-${i}`}
                        id={`${LISTBOX_ID}-opt-${idx}`}
                        active={idx === activeIdx}
                        onPick={() => pick(s)}
                        onHover={() => setActiveIdx(idx)}
                        icon={<MapPin className="size-[18px] text-link" />}
                        title={s.address}
                        // The address service returns one line per place, so
                        // there is no district or carpark count to put here.
                        sub={null}
                      />
                    )
                  })}
                </>
              )}
            </ul>
            {checking && (
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center px-3.5 py-3',
                  options.length > 0 && 'border-t-[1.5px] border-hairline',
                )}
              >
                <CheckingLotsChip />
              </div>
            )}

            {showSuggestionMessage && (
              <div
                id={STATUS_ID}
                className={cn(
                  'shrink-0 px-3.5 py-3 text-sm text-slate-body',
                  options.length > 0 && 'border-t-[1.5px] border-hairline',
                )}
                role={suggestionState === 'error' ? 'alert' : 'status'}
              >
                {suggestionState === 'error' ? (
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="size-4 shrink-0 text-kopi" aria-hidden="true" />
                    <span className="min-w-0 flex-1">Address service unavailable.</span>
                    <button
                      type="button"
                      onClick={() => void requestSuggestions(query)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-link hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  'No matching addresses found.'
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onNearMe}
        className="h-12 shrink-0 gap-2 rounded-lg border-2 border-brand-bar-foreground/30 bg-brand-bar-foreground/10 font-display text-base font-extrabold text-brand-bar-foreground hover:bg-brand-bar-foreground/20 hover:text-brand-bar-foreground"
      >
        <LocateFixed className="size-4" aria-hidden="true" />
        Near me
      </Button>
    </div>
  )
}
