import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { DotPattern } from "@/components/magicui/dot-pattern"
import { cn } from "@/lib/utils"

export function Backdrop() {
  return (
    <DotPattern
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 text-neutral-400/50 dark:text-neutral-600/40",
        "[mask-image:radial-gradient(420px_circle_at_50%_0%,white,transparent)]",
      )}
    />
  )
}

export function SiteHeader() {
  return (
    <header className="flex min-h-12 items-center justify-between">
      <a href="/" className="inline-flex items-center gap-2.5 font-semibold tracking-tight">
        <img src="/mark.svg" alt="" width={28} height={28} className="size-7" />
        Pay Small Check
      </a>
      <Button asChild variant="ghost" className="h-11">
        <a href="/proof/">Proof</a>
      </Button>
    </header>
  )
}

const LINKS = [
  ["/proof/", "Proof"],
  ["/how-to/", "How it works"],
  ["/about/", "About"],
  ["/terms/", "Terms"],
  ["/privacy/", "Privacy"],
  ["/support/", "Support"],
]

export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-col gap-3 pt-4 text-sm text-muted-foreground">
      <Separator />
      <nav aria-label="Footer" className="-ml-3 flex flex-wrap">
        {LINKS.map(([href, label]) => (
          <Button key={href} asChild variant="link" className="h-11 px-3 text-muted-foreground">
            <a href={href}>{label}</a>
          </Button>
        ))}
      </nav>
      <p>Operated by the Pay Small Check project, not by Opera or MiniPay.</p>
    </footer>
  )
}
