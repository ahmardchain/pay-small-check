import { useEffect, useState } from "react"
import { ArrowUpRight, ReceiptText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { BlurFade } from "@/components/magicui/blur-fade"
import { Backdrop, SiteFooter, SiteHeader } from "@/site"

type ProofReceipt = {
  id: string
  handle?: string
  verdict?: string
  status?: string
  summary?: string
  dryRun?: boolean
  createdAt?: string
  userPayment?: { rail?: string; txHash?: string; symbol?: string; payTo?: string; attribution?: string; attributionCodes?: string[] }
  buyCalls?: { title?: string; capability?: string; txHash?: string; simulated?: boolean; correlationId?: string }[]
}

const TONE: Record<string, string> = {
  safe: "border-safe/40 text-safe",
  caution: "border-caution/40 text-caution",
  risky: "border-risky/40 text-risky",
}

export function ProofApp() {
  const id = new URLSearchParams(location.search).get("id")
  const [rows, setRows] = useState<ProofReceipt[] | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    fetch(id ? `/api/receipts/${encodeURIComponent(id)}` : "/api/receipts")
      .then(async (response) => {
        if (!response.ok) {
          setMissing(true)
          setRows([])
          return
        }
        const body = await response.json()
        setRows(body.receipts || [body])
      })
      .catch(() => {
        setMissing(true)
        setRows([])
      })
  }, [id])

  return (
    <>
      <Backdrop />
      <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col gap-8 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:max-w-lg">
        <SiteHeader />
        <section className="flex flex-col gap-3">
          <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em]">Proof of payment</h1>
          <p className="text-muted-foreground text-pretty">
            Every check stores the buyer's payment and the buy calls behind the verdict. x402 payments are identified by the PayTo wallet, because those settlements cannot carry an attribution suffix.
          </p>
        </section>

        <div className="flex flex-col gap-4">
          {rows === null && [0, 1].map((key) => <Skeleton key={key} className="h-48 w-full rounded-xl" />)}

          {rows !== null && rows.length === 0 && (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ReceiptText /></EmptyMedia>
                <EmptyTitle>{missing ? "No receipt has that id" : "No paid checks yet"}</EmptyTitle>
                <EmptyDescription>
                  {missing ? "Open the full list instead." : "Each paid check appears here with its Celo payments."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild className="h-11">
                  <a href={missing ? "/proof/" : "/"}>{missing ? "See all receipts" : "Check a vendor"}</a>
                </Button>
              </EmptyContent>
            </Empty>
          )}

          {rows?.map((receipt, index) => (
            <BlurFade key={receipt.id} delay={Math.min(index, 6) * 0.05}>
              <ProofCard receipt={receipt} />
            </BlurFade>
          ))}
        </div>

        <SiteFooter />
      </div>
    </>
  )
}

function ProofCard({ receipt }: { receipt: ProofReceipt }) {
  const verdict = receipt.verdict || receipt.status || ""
  const payment = receipt.userPayment || {}
  const when = receipt.createdAt ? new Date(receipt.createdAt).toLocaleString() : ""
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-lg">@{receipt.handle}</CardTitle>
            <CardDescription>
              {when}
              {receipt.dryRun ? ", practice" : ""}
            </CardDescription>
          </div>
          <Badge variant="outline" className={`capitalize ${TONE[verdict] ?? ""}`}>{verdict}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {receipt.summary && <p className="text-pretty">{receipt.summary}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">Buyer payment</dt>
          <dd>
            {payment.txHash ? (
              <a className="underline underline-offset-4" href={`https://celoscan.io/tx/${payment.txHash}`}>{payment.symbol || "transaction"}</a>
            ) : (
              "none"
            )}
            {payment.rail ? <span className="text-muted-foreground"> ({payment.rail})</span> : null}
          </dd>
          <dt className="text-muted-foreground">PayTo</dt>
          <dd className="font-mono text-xs break-all">{payment.payTo || "not set"}</dd>
          <dt className="text-muted-foreground">Attribution</dt>
          <dd>
            {payment.attribution}
            {payment.attributionCodes?.length ? ` (${payment.attributionCodes.join(", ")})` : ""}
          </dd>
        </dl>
        <ItemGroup className="gap-1">
          {(receipt.buyCalls ?? []).map((call, index) => (
            <Item key={index} variant="muted" size="sm" className="py-2">
              <ItemContent>
                <ItemTitle className="font-normal">{call.title || call.capability}</ItemTitle>
                {call.correlationId && <ItemDescription className="font-mono text-xs break-all">{call.correlationId}</ItemDescription>}
              </ItemContent>
              <ItemActions>
                {call.txHash ? (
                  <a className="text-sm underline underline-offset-4" href={`https://celoscan.io/tx/${call.txHash}`}>buy payment</a>
                ) : (
                  <span className="text-sm text-muted-foreground">{call.simulated ? "practice, not paid" : "not paid"}</span>
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost" size="sm" className="-ml-3 h-11">
          <a href={`/proof/?id=${encodeURIComponent(receipt.id)}`}>
            Permalink <ArrowUpRight />
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}
