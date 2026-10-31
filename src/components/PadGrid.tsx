import { useBoard } from '../app/hooks.ts'
import { BANK_LETTERS, PADS_PER_BANK } from '../state/types.ts'
import { Pad } from './Pad.tsx'

interface PadGridProps {
  editMode: boolean
  onEdit(pad: number): void
}

export function PadGrid({ editMode, onEdit }: PadGridProps) {
  const bank = useBoard((state) => state.bank)
  const first = bank * PADS_PER_BANK
  return (
    <div className="pad-grid" role="group" aria-label={`Bank ${BANK_LETTERS[bank]} pads`}>
      {Array.from({ length: PADS_PER_BANK }, (_, slot) => (
        <Pad key={first + slot} pad={first + slot} editMode={editMode} onEdit={onEdit} />
      ))}
    </div>
  )
}
