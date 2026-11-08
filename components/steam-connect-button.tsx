'use client'

import { Button } from '@/components/ui/button'
import { SteamLogo } from '@/components/provider-logos'

export function SteamConnectButton({ relink = false }: { relink?: boolean }) {
  function connect() {
    const url = '/api/steam/connect'
    // Steam refuses to render inside the preview iframe, so open it in its own tab there.
    if (window.self !== window.top) window.open(url, '_blank')
    else window.location.assign(url)
  }

  return (
    <Button type="button" variant="outline" onClick={connect} aria-label={relink ? 'Link a different Steam account' : 'Link Steam account'}>
      <SteamLogo data-icon="inline-start" />
      {relink ? 'Change' : 'Link'}
    </Button>
  )
}
