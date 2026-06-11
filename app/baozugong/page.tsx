"use client"

import { useState, Fragment } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { useLanguage } from "@/components/language-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PiggyBank, Search, TrendingUp, Droplets, Calendar, Target, ChevronDown, ChevronRight, Trophy } from "lucide-react"

interface Candidate {
  ticker: string
  strike: number
  type: string
  days: number
  expiry: string
  mid: number
  delta: number
  iv: number
  spread_pct: number
  oi: number
  volume: number
  annualized_yield_pct: number
  moneyness_pct: number
  prob_safe_pct: number
  official_score: number
  official_tier: number | null
  my_score: number
  my_tier: number
  my_stars: string
  ev_annualized_pct: number
  fair_value: number
  vrp_ratio: number
  factors: Record<string, number>
  liquidity_breakdown: { spread_score: number; oi_mod: number; vol_mod: number; oi: number; volume: number }
  authed: boolean
  backtest_factor: number | null
  implied_residual: number | null
}

interface TickerResult {
  ticker: string
  underlying?: number
  iv_rank?: { iv_rank: number; rv_30d_now_pct: number; current_iv_pct: number }
  criteria?: { delta_band: number[]; is_call: boolean }
  algorithm?: { name: string; version: string }
  backtest_summary?: { win_rate: number; theoretical_pop: number; calibration_ratio: number; n_trades: number; avg_pnl_pct: number; backtest_factor?: number; source?: string; cached?: boolean; params?: { target_delta: number; dte_days: number; stop_mult: number } } | null
  authed?: boolean
  candidates: Candidate[]
  error?: string
}

interface ApiResult {
  multi: boolean
  tickers: string[]
  results: TickerResult[]
  top: Candidate[]
  error?: string
}

const INTENTS = [
  { value: "csp", zh: "现金担保 Put (CSP)", en: "Cash-Secured Put" },
  { value: "covered_call", zh: "备兑看涨 (Covered Call)", en: "Covered Call" },
  { value: "premium", zh: "纯收权利金", en: "Premium" },
  { value: "strangle", zh: "宽跨 (Strangle)", en: "Strangle" },
]
const RISKS = [
  { value: "conservative", zh: "保守", en: "Conservative" },
  { value: "balanced", zh: "均衡", en: "Balanced" },
  { value: "aggressive", zh: "激进", en: "Aggressive" },
]
const TIMEFRAMES = ["7", "14", "21", "30", "45", "60"]

// 13 因子的中英文标签
const FACTOR_LABELS: Record<string, { zh: string; en: string }> = {
  dte_factor: { zh: "DTE 甜蜜区", en: "DTE sweet spot" },
  delta_factor: { zh: "Delta 甜蜜区", en: "Delta sweet spot" },
  iv_factor: { zh: "IV rank", en: "IV rank" },
  liquidity_factor: { zh: "流动性", en: "Liquidity" },
  backtest_factor: { zh: "回测胜率", en: "Backtest" },
  earnings_factor: { zh: "财报跨期", en: "Earnings" },
  macro_factor: { zh: "宏观", en: "Macro" },
  gamma_factor: { zh: "Gamma 风险", en: "Gamma" },
  wheel_factor: { zh: "轮动适配", en: "Wheel" },
  wto_factor: { zh: "愿持有", en: "Willing-to-own" },
  exdiv_factor: { zh: "除息跨期", en: "Ex-div" },
  sympathy_factor: { zh: "板块联动", en: "Sympathy" },
  safety: { zh: "安全垫", en: "Safety" },
}

function tierBadge(tier: number) {
  const variant = tier >= 4 ? "default" : tier >= 3 ? "secondary" : "outline"
  return <Badge variant={variant as any}>{"★".repeat(tier)}{"☆".repeat(5 - tier)}</Badge>
}

function factorColor(v: number) {
  if (v >= 1.05) return "text-green-600"
  if (v < 0.85) return "text-red-500"
  return ""
}

export default function BaozugongPage() {
  const { language } = useLanguage()
  const zh = language === "zh"

  const [ticker, setTicker] = useState("AAPL")
  const [intent, setIntent] = useState("csp")
  const [risk, setRisk] = useState("balanced")
  const [timeframe, setTimeframe] = useState("30")
  const [direction, setDirection] = useState("bullish")
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [showBt, setShowBt] = useState(false)
  const [btDelta, setBtDelta] = useState("0.27")
  const [btDte, setBtDte] = useState("30")
  const [btStop, setBtStop] = useState("2.0")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApiResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(key: string) {
    setExpanded((prev) => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  async function scan() {
    setLoading(true)
    setErr(null)
    setExpanded(new Set())
    try {
      const r = await fetch("/api/baozugong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker, intent, risk, timeframe, direction,
          access_token: token.trim() || undefined,
          backtest: {
            targetDelta: parseFloat(btDelta) || undefined,
            dteDays: parseInt(btDte, 10) || undefined,
            stopMult: parseFloat(btStop) || undefined,
          },
        }),
      })
      const d = await r.json()
      if (!r.ok || d.error) {
        setErr(d.error || `HTTP ${r.status}`)
        setData(null)
      } else {
        setData(d)
      }
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PiggyBank className="h-7 w-7 text-amber-500" />
            {zh ? "包租公 · 期权收租打分" : "Landlord · Option Income Scoring"}
          </h1>
          <p className="text-muted-foreground">
            {zh
              ? "13 因子算法复现：分数 = max(EV年化, 0.5) × Π(因子)。实时期权链数据，仅供研究，不构成投资建议。"
              : "13-factor reproduction: score = max(EV_ann, 0.5) × Π(factors). Live data, research only — not investment advice."}
          </p>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>{zh ? "扫描参数" : "Scan Parameters"}</CardTitle>
            <CardDescription>
              {zh
                ? "标的支持逗号分隔批量扫描（最多 6 个），如 AAPL,MSFT,NVDA"
                : "Comma-separate up to 6 tickers for batch scan, e.g. AAPL,MSFT,NVDA"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-muted-foreground">{zh ? "标的代码" : "Ticker(s)"}</label>
                <Input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && scan()}
                  placeholder="AAPL,MSFT,NVDA"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{zh ? "策略意图" : "Intent"}</label>
                <Select value={intent} onValueChange={setIntent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTENTS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>{zh ? i.zh : i.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{zh ? "方向" : "Direction"}</label>
                <Select value={direction} onValueChange={setDirection}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bullish">{zh ? "看涨" : "Bullish"}</SelectItem>
                    <SelectItem value="bearish">{zh ? "看跌" : "Bearish"}</SelectItem>
                    <SelectItem value="neutral">{zh ? "中性" : "Neutral"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{zh ? "风险档" : "Risk"}</label>
                <Select value={risk} onValueChange={setRisk}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISKS.map((rk) => (
                      <SelectItem key={rk.value} value={rk.value}>{zh ? rk.zh : rk.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{zh ? "目标天数" : "Target DTE"}</label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEFRAMES.map((tf) => (
                      <SelectItem key={tf} value={tf}>{tf}d</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={scan} disabled={loading} className="md:col-span-1">
                <Search className="h-4 w-4 mr-2" />
                {loading ? (zh ? "扫描中…" : "Scanning…") : zh ? "扫描" : "Scan"}
              </Button>
            </div>
            {err && <p className="text-sm text-red-500 mt-3">⚠️ {err}</p>}

            {/* 高级：解锁真实因子（backtest_factor 等需登录 token） */}
            <div className="mt-4 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowToken((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showToken ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {zh ? "高级：粘贴 token 解锁真实因子（含 backtest_factor）" : "Advanced: paste token to unlock real factors (incl. backtest_factor)"}
              </button>
              {showToken && (
                <div className="mt-2 space-y-1">
                  <Input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={zh ? "粘贴 baozugong.app 登录后的 access_token（eyJ... 开头，约1小时过期）" : "Paste baozugong.app access_token (eyJ..., ~1h expiry)"}
                    type="password"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {zh
                      ? "无 token 时 backtest_factor 用反解残差估算；有 token 则直接读后端真值（wheel/gamma 等也变真值）。token 仅本次请求转发，不存储。"
                      : "Without a token, backtest_factor is estimated via residual; with one, real values are read directly. Token is forwarded only for this request, never stored."}
                  </p>
                </div>
              )}
            </div>

            {/* 回测参数（仅本地估算用，可 tune 贴近真值） */}
            <div className="mt-3 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowBt((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showBt ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {zh ? "回测参数（无 token 时本地估算 backtest_factor 用）" : "Backtest params (used for local backtest_factor when no token)"}
              </button>
              {showBt && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{zh ? "目标 Delta" : "Target Delta"}</label>
                    <Input value={btDelta} onChange={(e) => setBtDelta(e.target.value)} placeholder="0.27" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{zh ? "回测 DTE(天)" : "Backtest DTE"}</label>
                    <Input value={btDte} onChange={(e) => setBtDte(e.target.value)} placeholder="30" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{zh ? "止损(×权利金)" : "Stop (×premium)"}</label>
                    <Input value={btStop} onChange={(e) => setBtStop(e.target.value)} placeholder="2.0" />
                  </div>
                  <div className="flex items-end">
                    <p className="text-[11px] text-muted-foreground">
                      {zh ? "Delta↑/止损↓ 通常拉低胜率。调完重新扫描即生效（结果缓存1小时）。" : "Higher delta / tighter stop lowers win-rate. Re-scan to apply (cached 1h)."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top-N across tickers (multi only) */}
        {data && data.multi && data.top.length > 0 && (
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                {zh ? `跨标的 Top ${data.top.length}` : `Top ${data.top.length} across tickers`}
              </CardTitle>
              <CardDescription>
                {zh ? "所有标的的候选合并后按复现分排序" : "All candidates merged, ranked by reproduction score"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResultTable
                zh={zh}
                rows={data.top}
                showTicker
                idPrefix="top"
                expanded={expanded}
                toggle={toggle}
              />
            </CardContent>
          </Card>
        )}

        {/* Per-ticker sections */}
        {data?.results.map((res) => (
          <Card key={res.ticker}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  {res.ticker}
                  {res.underlying != null && (
                    <span className="text-base font-normal text-muted-foreground">${res.underlying.toFixed(2)}</span>
                  )}
                </CardTitle>
                {res.iv_rank && (
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />IV rank {res.iv_rank.iv_rank?.toFixed(0)}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Δ {res.criteria?.delta_band?.join("~")}</span>
                    <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />IV {res.iv_rank.current_iv_pct?.toFixed(1)}% / RV {res.iv_rank.rv_30d_now_pct?.toFixed(1)}%</span>
                  </div>
                )}
              </div>
              {/* 回测摘要（驱动 backtest_factor）：带 token=后端真值；否则=本地12月回测估算 */}
              {res.backtest_summary && (
                <div className="mt-2 text-xs rounded-md bg-muted/40 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-medium">
                    {zh ? "回测" : "Backtest"}
                    <Badge variant="outline" className="ml-1">
                      {res.backtest_summary.source === "local_backtest"
                        ? (zh ? "本地估算" : "local")
                        : (zh ? "后端真值" : "official")}
                    </Badge>
                  </span>
                  <span>{zh ? "实际胜率" : "win"} {res.backtest_summary.win_rate}%</span>
                  <span>{zh ? "理论胜率" : "POP"} {res.backtest_summary.theoretical_pop}%</span>
                  <span>
                    {zh ? "校准比" : "calib"} {res.backtest_summary.calibration_ratio}
                    {" → backtest_factor ×"}
                    {res.backtest_summary.backtest_factor ??
                      (res.backtest_summary.calibration_ratio >= 0.98 ? "1.12" : res.backtest_summary.calibration_ratio >= 0.85 ? "1.04" : "1.00")}
                  </span>
                  <span className="text-muted-foreground">({res.backtest_summary.n_trades} {zh ? "笔/12月" : "trades/12m"})</span>
                  {res.backtest_summary.params && (
                    <span className="text-muted-foreground">
                      Δ{res.backtest_summary.params.target_delta}·{res.backtest_summary.params.dte_days}d·stop{res.backtest_summary.params.stop_mult}×
                    </span>
                  )}
                  {res.backtest_summary.cached && (
                    <Badge variant="outline">{zh ? "缓存" : "cached"}</Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {res.error ? (
                <p className="text-sm text-red-500">⚠️ {res.error}</p>
              ) : res.candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">{zh ? "无候选" : "No candidates"}</p>
              ) : (
                <ResultTable
                  zh={zh}
                  rows={res.candidates}
                  idPrefix={res.ticker}
                  expanded={expanded}
                  toggle={toggle}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  )
}

function ResultTable({
  zh,
  rows,
  showTicker = false,
  idPrefix,
  expanded,
  toggle,
}: {
  zh: boolean
  rows: Candidate[]
  showTicker?: boolean
  idPrefix: string
  expanded: Set<string>
  toggle: (k: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            {showTicker && <TableHead>{zh ? "标的" : "Ticker"}</TableHead>}
            <TableHead>{zh ? "合约" : "Contract"}</TableHead>
            <TableHead className="text-right">Δ</TableHead>
            <TableHead className="text-right">{zh ? "年化%" : "Ann%"}</TableHead>
            <TableHead className="text-right">EV%</TableHead>
            <TableHead className="text-right">VRP</TableHead>
            <TableHead className="text-right">DTE×</TableHead>
            <TableHead className="text-right">Δ×</TableHead>
            <TableHead className="text-right">{zh ? "流动×" : "Liq×"}</TableHead>
            <TableHead className="text-right">{zh ? "复现分" : "Mine"}</TableHead>
            <TableHead className="text-right">{zh ? "官方分" : "Official"}</TableHead>
            <TableHead>{zh ? "星级" : "Tier"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c, i) => {
            const key = `${idPrefix}-${c.ticker}-${c.strike}-${c.expiry}-${i}`
            const isOpen = expanded.has(key)
            const colSpan = showTicker ? 13 : 12
            return (
              <Fragment key={key}>
                <TableRow className="cursor-pointer" onClick={() => toggle(key)}>
                  <TableCell className="w-8">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </TableCell>
                  {showTicker && <TableCell className="font-medium">{c.ticker}</TableCell>}
                  <TableCell className="whitespace-nowrap font-medium">
                    ${c.strike} {c.type === "call" ? "C" : "P"} · {c.days}d
                    <div className="text-xs text-muted-foreground">{c.expiry}</div>
                  </TableCell>
                  <TableCell className="text-right">{c.delta?.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{c.annualized_yield_pct?.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">{c.ev_annualized_pct?.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{c.vrp_ratio?.toFixed(2)}</TableCell>
                  <TableCell className={`text-right ${factorColor(c.factors.dte_factor)}`}>{c.factors.dte_factor}</TableCell>
                  <TableCell className={`text-right ${factorColor(c.factors.delta_factor)}`}>{c.factors.delta_factor}</TableCell>
                  <TableCell className={`text-right ${factorColor(c.factors.liquidity_factor)}`}>{c.factors.liquidity_factor}</TableCell>
                  <TableCell className="text-right font-bold text-amber-600">{c.my_score?.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{c.official_score?.toFixed(2)}</TableCell>
                  <TableCell>{tierBadge(c.my_tier)}</TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={colSpan} className="p-4">
                      <FactorDetail zh={zh} c={c} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function FactorDetail({ zh, c }: { zh: boolean; c: Candidate }) {
  const lb = c.liquidity_breakdown
  return (
    <div className="space-y-3">
      {/* 公式拆解 */}
      <div className="text-sm">
        <span className="font-semibold text-amber-600">{zh ? "包租公分" : "Score"} {c.my_score.toFixed(2)}</span>
        <span className="text-muted-foreground">
          {"  =  "}max(EV {c.ev_annualized_pct.toFixed(2)}, 0.5) × {zh ? "所有因子连乘" : "Π(factors)"}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {zh ? "公允价(按RV)" : "fair(RV)"} ${c.fair_value.toFixed(2)} · {zh ? "市价" : "mid"} ${c.mid.toFixed(2)} ·
        VRP {c.vrp_ratio.toFixed(2)} · {zh ? "距行权" : "moneyness"} {c.moneyness_pct?.toFixed(1)}% ·
        {zh ? "安全率" : "P(safe)"} {c.prob_safe_pct?.toFixed(0)}%
      </div>
      {/* backtest_factor 来源说明 */}
      <div className="text-xs">
        {c.authed ? (
          <span className="text-green-600">
            🔓 {zh ? "已用 token 解锁，因子为后端真值。" : "Unlocked via token — real backend factors."}
            {c.backtest_factor != null && ` backtest_factor = ×${c.backtest_factor}`}
          </span>
        ) : (
          <span className="text-muted-foreground">
            🔒 {zh ? "未带 token：backtest_factor 用反解残差估算 " : "No token: backtest_factor estimated via residual "}
            {c.implied_residual != null && (
              <b>≈ ×{c.implied_residual}</b>
            )}
            {zh ? "（= 官方分 ÷ 已知因子，含 wheel/gamma 等）" : " (= official ÷ known factors, incl. wheel/gamma)"}
          </span>
        )}
      </div>
      {/* 13 因子网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Object.entries(c.factors).map(([k, v]) => {
          const lab = FACTOR_LABELS[k]
          const isLiq = k === "liquidity_factor"
          return (
            <div key={k} className="rounded-md border p-2 bg-background">
              <div className="text-xs text-muted-foreground">{lab ? (zh ? lab.zh : lab.en) : k}</div>
              <div className={`text-sm font-semibold ${factorColor(v)}`}>×{v.toFixed(2)}</div>
              {isLiq && (
                <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                  spread {lb.spread_score} · OI {lb.oi_mod}
                  <br />vol {lb.vol_mod} ({lb.oi}/{lb.volume})
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
