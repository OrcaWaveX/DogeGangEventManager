const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Input = FormDataEntryValue | string | null | undefined

export function parseUuid(value: Input) {
  const text = typeof value === 'string' ? value.trim() : ''
  return UUID.test(text) ? text : null
}

export function parseText(value: Input, max: number) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.slice(0, max)
}

export function parseDate(value: Input) {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseHttpsUrl(value: Input) {
  const text = parseText(value, 500)
  if (!text) return null
  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function parseCapacity(value: Input) {
  const number = Number(typeof value === 'string' ? value : NaN)
  return Number.isInteger(number) && number > 0 && number <= 1000 ? number : null
}
