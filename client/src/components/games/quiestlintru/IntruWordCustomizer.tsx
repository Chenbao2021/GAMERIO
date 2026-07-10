import { useState, type JSX } from 'react'
import { Box, Typography, FormControlLabel, Checkbox, TextField } from '@mui/material'
import type { CustomWords } from './types'
import './IntruWordCustomizer.less'

interface Props {
  onChange: (words: CustomWords | null) => void
}

export default function IntruWordCustomizer({ onChange }: Props): JSX.Element {
  const [enabled, setEnabled] = useState(false)
  const [category, setCategory] = useState('')
  const [majority, setMajority] = useState('')
  const [intruder, setIntruder] = useState('')

  function emit(next: { enabled: boolean; category: string; majority: string; intruder: string }): void {
    onChange(next.enabled ? { category: next.category, majority: next.majority, intruder: next.intruder } : null)
  }

  function handleToggle(checked: boolean): void {
    setEnabled(checked)
    emit({ enabled: checked, category, majority, intruder })
  }

  return (
    <Box className="intru-word-customizer">
      <FormControlLabel
        control={<Checkbox checked={enabled} onChange={(e) => handleToggle(e.target.checked)} />}
        label="Personnaliser les mots de cette manche"
      />
      {enabled && (
        <Box className="intru-word-customizer__fields">
          <TextField
            fullWidth
            size="small"
            label="Catégorie (optionnel)"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              emit({ enabled, category: e.target.value, majority, intruder })
            }}
            inputProps={{ maxLength: 30 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Mot majoritaire"
            value={majority}
            onChange={(e) => {
              setMajority(e.target.value)
              emit({ enabled, category, majority: e.target.value, intruder })
            }}
            inputProps={{ maxLength: 30 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Mot de l'intrus"
            value={intruder}
            onChange={(e) => {
              setIntruder(e.target.value)
              emit({ enabled, category, majority, intruder: e.target.value })
            }}
            inputProps={{ maxLength: 30 }}
          />
          <Typography className="intru-word-customizer__hint">
            Les deux mots seront envoyés aux joueurs sans indiquer qui est l'intrus.
          </Typography>
        </Box>
      )}
    </Box>
  )
}
