'use client'

import { useEffect, useState } from 'react'

function format(ms: number) {
  const minutes = Math.floor(ms / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function Countdown({ iso, prefix }: { iso: string; prefix?: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  if (now === null) return <span suppressHydrationWarning>&nbsp;</span>
  const diff = new Date(iso).getTime() - now
  if (diff <= 0) return null
  return (
    <span>
      {prefix} {format(diff)}
    </span>
  )
}
