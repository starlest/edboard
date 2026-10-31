import { useBankActive, useBoard, useSoundboard } from '../app/hooks.ts'
import { BANK_LETTERS } from '../state/types.ts'
import { HwButton } from './HwButton.tsx'

function BankButton({ bank }: { bank: number }) {
  const soundboard = useSoundboard()
  const selected = useBoard((state) => state.bank === bank)
  const name = useBoard((state) => state.bankNames[bank])
  const active = useBankActive(bank)
  return (
    <HwButton
      variant="bank"
      label={name}
      led={selected ? 'on' : 'off'}
      activity={active}
      pressed={selected}
      title={`Bank ${BANK_LETTERS[bank]} — ${name}`}
      onPress={() => soundboard.selectBank(bank)}
    >
      {BANK_LETTERS[bank]}
    </HwButton>
  )
}

export function BankSelector() {
  return (
    <div className="bank-selector" role="group" aria-label="Pad banks">
      {BANK_LETTERS.map((_, bank) => (
        <BankButton key={bank} bank={bank} />
      ))}
    </div>
  )
}
