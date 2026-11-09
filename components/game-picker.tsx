'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { Plus, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { customGame, type PickedGame } from '@/lib/games'

type Props = {
  action: (formData: FormData) => void | Promise<void>
  hidden: Record<string, string>
  library?: (PickedGame & { favorite?: boolean })[]
  placeholder?: string
  id: string
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Search failed')
  return data.results as PickedGame[]
}

export function GamePicker({ action, hidden, library = [], placeholder = 'Search for a game', id }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const gameRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, error, isLoading } = useSWR(debounced.length >= 2 ? `/api/games/search?q=${encodeURIComponent(debounced)}` : null, fetcher, {
    revalidateOnFocus: false,
  })

  function onChange(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebounced(value.trim()), 300)
  }

  function pick(game: PickedGame) {
    if (!gameRef.current || !formRef.current) return
    gameRef.current.value = JSON.stringify(game)
    formRef.current.requestSubmit()
    setQuery('')
    setDebounced('')
  }

  const results = data ?? []
  const favorites = library.filter((game) => game.favorite)
  const recent = library.filter((game) => !game.favorite).slice(0, 8)

  return (
    <form ref={formRef} action={action} className="game-picker">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input ref={gameRef} type="hidden" name="game" defaultValue="" />
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <div className="picker-input">
        <Search size={15} aria-hidden="true" />
        <Input
          id={id}
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={80}
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
        />
      </div>

      {debounced.length >= 2 && (
        <div className="picker-results" aria-live="polite">
          {isLoading && <p className="small-copy">Searching...</p>}
          {error && <p className="small-copy">{error.message}</p>}
          {!isLoading && !error && results.length === 0 && <p className="small-copy">No matches.</p>}
          {results.map((game) => (
            <button key={game.externalId} type="button" className="picker-item" onClick={() => pick(game)}>
              {game.coverUrl ? <img src={game.coverUrl} alt="" width={64} height={40} /> : <span className="picker-blank" aria-hidden="true" />}
              <span>
                <strong>{game.name}</strong>
                <small>{game.genres.slice(0, 2).join(' · ') || 'Game'}</small>
              </span>
              <Plus size={15} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="picker-item" onClick={() => pick(customGame(debounced))}>
            <span className="picker-blank" aria-hidden="true" />
            <span>
              <strong>Add &ldquo;{debounced}&rdquo; as a custom game</strong>
              <small>Not in the database</small>
            </span>
            <Plus size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {debounced.length < 2 && (favorites.length > 0 || recent.length > 0) && (
        <div className="picker-library">
          {[...favorites, ...recent].map((game) => (
            <Button key={`${game.source}-${game.externalId}`} type="button" variant="outline" size="sm" onClick={() => pick(game)}>
              {game.favorite && <Star size={13} aria-hidden="true" />}
              {game.name}
            </Button>
          ))}
        </div>
      )}
    </form>
  )
}
