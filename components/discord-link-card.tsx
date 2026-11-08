import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { DiscordLogo } from '@/components/provider-logos'
import { cn } from '@/lib/utils'

type Link = { discordId: string; username: string; globalName: string | null; avatarUrl: string | null }

const STATUS_MESSAGES: Record<string, string> = {
  linked: 'Your Discord account is now linked.',
  cancelled: 'Discord linking was cancelled.',
  failed: 'Discord linking did not complete. Please try again.',
  'in-use': 'That Discord account is already linked to another member.',
  unavailable: 'Discord linking is not configured yet.',
}

export function DiscordLinkCard({
  link,
  status,
  configured,
  disconnect,
}: {
  link: Link | null
  status?: string
  configured: boolean
  disconnect: () => Promise<void>
}) {
  const message = status ? STATUS_MESSAGES[status] : undefined

  return (
    <section className="rail-card account-details" aria-labelledby="discord-heading">
      <h2 id="discord-heading" className="flex items-center gap-2">
        <DiscordLogo className="size-5" />
        Discord
      </h2>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {link ? (
        <>
          <div className="flex items-center gap-3">
            {link.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={link.avatarUrl} alt="" width={40} height={40} className="size-10 rounded-full" />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                <DiscordLogo className="size-5" />
              </span>
            )}
            <div className="flex flex-col">
              <span className="font-medium">{link.globalName ?? link.username}</span>
              <span className="text-sm text-muted-foreground">@{link.username}</span>
            </div>
          </div>
          <form action={disconnect}>
            <Button variant="outline" type="submit">
              Unlink Discord
            </Button>
          </form>
        </>
      ) : configured ? (
        <>
          <p className="text-sm text-muted-foreground">
            Link your Discord account so your name in the server matches your name here.
          </p>
          <a
            href="/api/discord/connect"
            target="_blank"
            rel="noopener"
            className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}
          >
            <DiscordLogo className="size-4" />
            Link Discord
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Discord linking is not configured yet.</p>
      )}
    </section>
  )
}
