import { Button } from '@/components/ui/button'
import { SteamLogo } from '@/components/provider-logos'
import { SteamConnectButton } from '@/components/steam-connect-button'
import { unlinkSteam } from '@/app/account/actions'

type SteamLink = {
  steamId: string
  personaName: string | null
  avatarUrl: string | null
  profileUrl: string | null
}

const notices: Record<string, string> = {
  linked: 'Steam account linked.',
  cancelled: 'Steam linking was cancelled.',
  taken: 'That Steam account is already linked to another member.',
  error: 'Steam could not be verified. Please try again.',
}

export function SteamLinkCard({ link, status }: { link: SteamLink | null; status?: string }) {
  const notice = status ? notices[status] : undefined
  return (
    <section className="rail-card account-details" aria-labelledby="steam-heading">
      <h2 id="steam-heading" className="flex items-center gap-2">
        <SteamLogo className="size-5" />
        Steam
      </h2>
      {notice && <p role="status" className="small-copy">{notice}</p>}
      {link ? (
        <div className="flex flex-wrap items-center gap-4">
          {link.avatarUrl && <img src={link.avatarUrl} alt="" width={48} height={48} className="size-12 rounded-md" />}
          <div className="flex min-w-0 flex-1 flex-col">
            <strong className="truncate">{link.personaName ?? 'Steam account'}</strong>
            <span className="small-copy">Steam ID {link.steamId}</span>
          </div>
          <div className="flex gap-2">
            <SteamConnectButton relink />
            <form action={unlinkSteam}>
              <Button type="submit" variant="ghost">Unlink</Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="small-copy">Link your Steam account so other members can find you for games. Your Steam password is never shared with this site.</p>
          <SteamConnectButton />
        </div>
      )}
    </section>
  )
}
