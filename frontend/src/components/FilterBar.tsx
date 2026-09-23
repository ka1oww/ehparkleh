import { Check, Gift, Zap, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RadiusSelect } from '@/components/RadiusSelect'

// Category filter chips, mapped to the backend `category` query param.
// null = "All" (no category filter).
const CATEGORY_CHIPS: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'HDB', value: 'HDB' },
  { label: 'Malls', value: 'Mall' },
  { label: 'Street', value: 'Street' },
  { label: 'Private', value: 'Private' },
]

interface Props {
  category: string | null
  onCategory: (c: string | null) => void
  freeSunPh: boolean
  onFreeSunPh: (v: boolean) => void
  hasLots: boolean
  onHasLots: (v: boolean) => void
  hasEv: boolean
  onHasEv: (v: boolean) => void
  hasCarwash: boolean
  onHasCarwash: (v: boolean) => void
  radius: number
  onRadius: (r: number) => void
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        active
          ? 'border-primary bg-panel text-panel-ink'
          : 'border-hairline bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function FilterBar({
  category,
  onCategory,
  freeSunPh,
  onFreeSunPh,
  hasLots,
  onHasLots,
  hasEv,
  onHasEv,
  hasCarwash,
  onHasCarwash,
  radius,
  onRadius,
}: Props) {
  return (
    <div className="relative">
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4 py-2.5 sm:mx-0 sm:px-0">
        <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Carpark category">
          {CATEGORY_CHIPS.map((c) => (
            <Chip key={c.label} active={category === c.value} onClick={() => onCategory(c.value)}>
              {c.label}
            </Chip>
          ))}
        </div>

        <span className="mx-1 h-5 w-px shrink-0 bg-hairline" aria-hidden="true" />

        <Chip active={freeSunPh} onClick={() => onFreeSunPh(!freeSunPh)}>
          <Gift className="size-3.5" aria-hidden="true" />
          Free Sun &amp; PH
        </Chip>
        <Chip active={hasLots} onClick={() => onHasLots(!hasLots)}>
          <Check className="size-3.5" aria-hidden="true" />
          Has lots
        </Chip>
        <Chip active={hasEv} onClick={() => onHasEv(!hasEv)}>
          <Zap className="size-3.5" aria-hidden="true" />
          EV charging
        </Chip>
        <Chip active={hasCarwash} onClick={() => onHasCarwash(!hasCarwash)}>
          <Droplets className="size-3.5" aria-hidden="true" />
          Car wash
        </Chip>

        {/* The one-tap escape from an over-filtered "0 results" now lives in
            the status eyebrow below the row, where FiltersHome.dc.html puts it
            — beside the line naming what is actually being filtered, rather
            than as a chip scrolled off the end of the row. */}

        <span className="mx-1 h-5 w-px shrink-0 bg-hairline" aria-hidden="true" />

        <RadiusSelect value={radius} onChange={onRadius} className="shrink-0" />
      </div>

      {/* Edge fade hinting the row scrolls to more filters (mobile only). */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent sm:hidden"
        aria-hidden="true"
      />
    </div>
  )
}
