import { useEffect, useRef, useState } from "react"
import { AlertCircle, ArrowUpRight, Check, FlaskConical, Receipt, ShieldAlert, ShieldCheck, ShieldQuestion, X as XIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text"
import { BlurFade } from "@/components/magicui/blur-fade"
import { BorderBeam } from "@/components/magicui/border-beam"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { SiteFooter, SiteHeader, Backdrop } from "@/site"
import { connect, displayName, formatAmount, inMiniPay, loadConfig, messageOf, runCheck } from "@/lib/pay.js"

type Channel = "x" | "instagram"
type Token = "USDT" | "cUSD"
type Signal = { tone: "good" | "warn" | "bad" | string; title: string; detail: string }
type EvidenceItem = { label: string; url?: string; excerpt?: string }
type BuyCall = { title: string; txHash?: string; simulated?: boolean }
type CheckReceipt = {
  id: string
  handle?: string
  verdict?: "safe" | "caution" | "risky"
  summary?: string
  dryRun?: boolean
  signals?: Signal[]
  evidence?: EvidenceItem[]
  buyCalls?: BuyCall[]
  userPayment?: { txHash?: string }
}

const VERDICT = {
  safe: { label: "Safe", Icon: ShieldCheck, tone: "text-safe", ring: "border-safe/40", beam: ["#34d399", "#059669"] },
  caution: { label: "Caution", Icon: ShieldQuestion, tone: "text-caution", ring: "border-caution/40", beam: ["#fbbf24", "#d97706"] },
  risky: { label: "Risky", Icon: ShieldAlert, tone: "text-risky", ring: "border-risky/40", beam: ["#fb7185", "#e11d48"] },
} as const

const TONE: Record<string, string> = { good: "text-safe", warn: "text-caution", bad: "text-risky" }

export function CheckApp() {
  const [config, setConfig] = useState<any>(null)
  const [configError, setConfigError] = useState(false)
  const [account, setAccount] = useState<string | null>(null)
  const [channel, setChannel] = useState<Channel>("x")
  const [token, setToken] = useState<Token>("USDT")
  const [handle, setHandle] = useState("")
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState("")
  const [error, setError] = useState("")
  const [receipt, setReceipt] = useState<CheckReceipt | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConfig()
      .then(async (loaded) => {
        setConfig(loaded)
        if (!loaded.dryRun && inMiniPay()) setAccount(await connect(true, setState))
      })
      .catch(() => setConfigError(true))
  }, [])

  useEffect(() => {
    if (receipt) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [receipt])

  const usdt = config?.transferTokens?.find((item: any) => item.symbol === "USDT")
  const fee = config?.dryRun ? "Free" : config ? `$${config.priceUsd}` : "…"
  const feeLine = configError
    ? "The fee could not be loaded."
    : !config
      ? "Loading the fee…"
      : config.dryRun
        ? "Practice checks are free."
        : usdt
          ? `One check is ${formatAmount(usdt.amount, usdt.decimals)} USDT, or the same value in cUSD.`
          : `One check is ${config.priceUsd} USDT, or the same amount in cUSD.`

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setReceipt(null)
    setError("")
    setBusy(true)
    try {
      const loaded = config ?? (await loadConfig())
      if (!config) setConfig(loaded)
      let payer = account
      if (!loaded.dryRun && !payer) {
        payer = await connect(false, setError)
        setAccount(payer)
        if (!payer) return
      }
      const result = await runCheck({ config: loaded, account: payer, handle, channel, token, onState: setState })
      if (result) setReceipt(result)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setState("")
      setBusy(false)
    }
  }

  return (
    <>
      <Backdrop />
      <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col gap-8 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:max-w-lg">
        <SiteHeader />

        <section className="flex flex-col items-start gap-4">
          <a href="/proof/" className="group rounded-full border border-black/5 bg-neutral-100 text-sm transition-all ease-in hover:bg-neutral-200 dark:border-white/5 dark:bg-neutral-900 dark:hover:bg-neutral-800">
            <AnimatedShinyText className="inline-flex items-center justify-center gap-2 px-3 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
              Live on Celo mainnet
              <ArrowUpRight className="size-3.5 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
            </AnimatedShinyText>
          </a>
          <h1 className="text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
            Check the vendor before you pay them.
          </h1>
          <p className="text-base text-muted-foreground text-pretty">
            Paste their X or Instagram handle and pay a small fee in digital dollars. You get Safe, Caution, or Risky, with the posts it came from.
          </p>
        </section>

        {config?.dryRun && (
          <Alert>
            <FlaskConical />
            <AlertTitle>Practice mode</AlertTitle>
            <AlertDescription>No payment, and the verdict uses sample posts. Try @safevendor, @cautionvendor, or @riskyvendor.</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit}>
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Check a vendor</CardTitle>
              <CardDescription>{feeLine}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-2.5">
                <Label id="platform-label">Platform</Label>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={channel}
                  onValueChange={(value) => value && setChannel(value as Channel)}
                  aria-labelledby="platform-label"
                  className="w-full"
                >
                  <ToggleGroupItem value="x" className="h-11 flex-1">X</ToggleGroupItem>
                  <ToggleGroupItem value="instagram" className="h-11 flex-1">Instagram</ToggleGroupItem>
                  <ToggleGroupItem value="facebook" disabled className="h-11 flex-1" aria-describedby="facebook-soon">Facebook</ToggleGroupItem>
                </ToggleGroup>
                <p id="facebook-soon" className="text-sm text-muted-foreground">Facebook is coming soon.</p>
              </div>

              <div className="flex flex-col gap-2.5">
                <Label htmlFor="handle">{channel === "instagram" ? "Instagram username" : "X handle"}</Label>
                <InputGroup className="h-12">
                  <InputGroupAddon>
                    <InputGroupText className="text-base">@</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="handle"
                    name="handle"
                    required
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={channel === "instagram" ? "shop.name" : "shopname"}
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    className="text-base"
                  />
                </InputGroup>
              </div>

              {!config?.dryRun && (
                <div className="flex flex-col gap-2.5">
                  <Label id="token-label">Pay with</Label>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={token}
                    onValueChange={(value) => value && setToken(value as Token)}
                    aria-labelledby="token-label"
                    className="w-full"
                  >
                    <ToggleGroupItem value="USDT" className="h-11 flex-1">USDT</ToggleGroupItem>
                    <ToggleGroupItem value="cUSD" className="h-11 flex-1">cUSD</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3">
              <Separator />
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-sm text-muted-foreground">Fee</span>
                <span className="font-mono text-2xl font-medium tabular-nums">{fee}</span>
              </div>
              <ShimmerButton type="submit" disabled={busy} borderRadius="12px" background="var(--primary)" shimmerColor="#34d399" className="h-12 w-full text-base font-medium text-primary-foreground disabled:opacity-70">
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> {state || "Preparing transaction…"}
                  </span>
                ) : config?.dryRun ? (
                  "Run practice check"
                ) : (
                  "Check this vendor"
                )}
              </ShimmerButton>
              {account && <p className="text-center text-sm text-muted-foreground">Paying from {displayName(account)}.</p>}
              {!account && inMiniPay() && <p className="text-center text-sm text-muted-foreground">Opened in MiniPay. The network fee is paid in the stablecoin you pick.</p>}
              <p className="sr-only" role="status" aria-live="polite">{state}</p>
            </CardFooter>
            <BorderBeam duration={8} size={120} colorFrom="#34d399" colorTo="#059669" />
          </Card>
        </form>

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertCircle />
            <AlertTitle>The check did not run</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {receipt && (
          <div ref={resultRef} className="scroll-mt-4">
            <BlurFade>
              <VerdictCard receipt={receipt} />
            </BlurFade>
          </div>
        )}

        <ItemGroup className="gap-2">
          {[
            ["1", "Paste the handle", "From X or Instagram."],
            ["2", "Pay the small fee", "USDT or cUSD on Celo."],
            ["3", "Read the verdict", "With the posts behind it."],
          ].map(([step, title, body]) => (
            <Item key={step} variant="muted" size="sm">
              <ItemMedia variant="icon" className="font-mono text-xs">{step}</ItemMedia>
              <ItemContent>
                <ItemTitle>{title}</ItemTitle>
                <ItemDescription>{body}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>

        <SiteFooter />
      </div>
    </>
  )
}

function VerdictCard({ receipt }: { receipt: CheckReceipt }) {
  const verdict = VERDICT[receipt.verdict ?? "caution"] ?? VERDICT.caution
  const { Icon } = verdict
  return (
    <Card className={`relative overflow-hidden ${verdict.ring}`} aria-live="polite">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className={`flex size-11 items-center justify-center rounded-xl border bg-muted ${verdict.tone}`}>
            <Icon className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <CardDescription className="flex items-center gap-2">
              @{receipt.handle}
              {receipt.dryRun && <Badge variant="outline">Practice</Badge>}
            </CardDescription>
            <CardTitle className={`text-3xl tracking-tight ${verdict.tone}`}>{verdict.label}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-pretty">{receipt.summary}</p>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Why</h3>
          <ItemGroup className="gap-2">
            {(receipt.signals ?? []).map((signal, index) => (
              <Item key={index} variant="outline" size="sm">
                <ItemMedia className={TONE[signal.tone] ?? "text-muted-foreground"}>
                  {signal.tone === "good" ? <Check /> : signal.tone === "bad" ? <XIcon /> : <AlertCircle />}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{signal.title}</ItemTitle>
                  <ItemDescription className="line-clamp-none">{signal.detail}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </section>

        {(receipt.evidence ?? []).length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Evidence</h3>
            <ItemGroup className="gap-2">
              {(receipt.evidence ?? []).map((item, index) => (
                <Item key={index} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{item.label}</ItemTitle>
                    {item.excerpt && <ItemDescription className="line-clamp-3">{item.excerpt}</ItemDescription>}
                  </ItemContent>
                  {item.url && (
                    <ItemActions>
                      <Button asChild variant="ghost" size="sm">
                        <a href={item.url} target="_blank" rel="noreferrer">
                          Open <ArrowUpRight />
                        </a>
                      </Button>
                    </ItemActions>
                  )}
                </Item>
              ))}
            </ItemGroup>
          </section>
        )}

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="h-11 w-full justify-between">
              <span className="inline-flex items-center gap-2"><Receipt /> Receipt and payments</span>
              <span className="text-muted-foreground">{(receipt.buyCalls ?? []).length} calls</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2 pt-3">
            <p className="text-sm">
              {receipt.userPayment?.txHash ? (
                <a className="underline underline-offset-4" href={`https://celoscan.io/tx/${receipt.userPayment.txHash}`}>Your payment on Celoscan</a>
              ) : (
                "No user payment on this practice check."
              )}
            </p>
            <ItemGroup className="gap-1">
              {(receipt.buyCalls ?? []).map((call, index) => (
                <Item key={index} size="sm" className="py-2">
                  <ItemContent>
                    <ItemTitle className="font-normal">{call.title}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    {call.txHash ? (
                      <a className="text-sm underline underline-offset-4" href={`https://celoscan.io/tx/${call.txHash}`}>payment</a>
                    ) : (
                      <span className="text-sm text-muted-foreground">{call.simulated ? "practice" : "no payment"}</span>
                    )}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
            <Button asChild variant="secondary" className="h-11">
              <a href={`/proof/?id=${encodeURIComponent(receipt.id)}`}>Open the public receipt</a>
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
      <BorderBeam duration={10} size={140} colorFrom={verdict.beam[0]} colorTo={verdict.beam[1]} />
    </Card>
  )
}
