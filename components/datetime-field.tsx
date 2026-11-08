'use client'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function DateTimeField({
  name,
  label,
  defaultValue,
  required,
  hint,
}: {
  name: string
  label: string
  defaultValue?: string | null
  required?: boolean
  hint?: string
}) {
  const [local, setLocal] = useState('')
  const id = `field-${name}`

  useEffect(() => {
    if (defaultValue) setLocal(toLocalInput(new Date(defaultValue)))
  }, [defaultValue])

  const iso = local ? new Date(local).toISOString() : ''

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <Input id={id} type="datetime-local" value={local} onChange={(event) => setLocal(event.target.value)} required={required} />
      <input type="hidden" name={name} value={iso} />
      <span className="small-copy">{hint ?? 'Uses your device time zone.'}</span>
    </div>
  )
}
