'use client'
import { useEffect, useState } from 'react'

const formats = {
  full: { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  short: { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
} as const

export function LocalTime({ iso, format = 'short' }: { iso: string; format?: keyof typeof formats }) {
  const options = formats[format]
  const [text, setText] = useState(() => `${new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(iso))} UTC`)

  useEffect(() => {
    setText(
      new Intl.DateTimeFormat(undefined, { ...options, timeZoneName: 'short' }).format(new Date(iso)),
    )
  }, [iso, options])

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  )
}
