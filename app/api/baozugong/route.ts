import { NextRequest, NextResponse } from "next/server";
import { scoreOption, scoreToTier } from "@/lib/baozugong";
import { runBacktest, type BacktestSummary, type BacktestParams } from "@/lib/baozugong-backtest";

/**
 * POST /api/baozugong
 * body: { ticker | tickers, intent, risk, timeframe, direction }
 *   - ticker: 单个或逗号分隔 "AAPL,MSFT,NVDA"
 *   - tickers: 字符串数组（可选，优先于 ticker）
 *
 * 服务端代理到 baozugong.app 的公开推荐引擎（拿真实 Schwab 期权链候选），
 * 再用本地复现模型 (lib/baozugong.ts) 给每个候选重新打分。匿名调用，不下单、不存储。
 */

async function scanOne(
  ticker: string,
  intent: string,
  risk: string,
  direction: string,
  timeframe: number,
  accessToken?: string,
  btParams?: BacktestParams,
) {
  const upstreamBody: Record<string, unknown> = {
    action: "recommend",
    ticker,
    direction,
    intent,
    timeframe,
    risk,
    exit_style: "early_close",
    lang: "zh",
  };
  // 带 token → 后端解锁完整 score_components（含真实 backtest_factor 等）
  if (accessToken) upstreamBody.access_token = accessToken;

  const upstream = await fetch("https://baozugong.app/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(upstreamBody),
  });

  if (!upstream.ok) {
    return { ticker, error: `upstream ${upstream.status}`, candidates: [] as any[] };
  }

  const d = await upstream.json();
  const S = d.underlying;
  const rvPct = d?.iv_rank?.rv_30d_now_pct ?? 0;
  const ivRank = d?.iv_rank?.iv_rank ?? 0;
  const isCall = d?.criteria?.is_call ?? intent === "covered_call";

  // 是否拿到真实 score_components（带有效 token）
  const authedTicker = (d.candidates || []).some((c: any) => c.score_components);

  // 无 token → 跑本地 12 个月回测算 backtest_factor（每个 ticker 一次）
  let localBt: BacktestSummary | null = null;
  if (!authedTicker) {
    try {
      localBt = await runBacktest(ticker, isCall, btParams);
    } catch {
      localBt = null;
    }
  }
  const localBtFactor = localBt?.backtest_factor ?? 1.12;

  const candidates = (d.candidates || []).map((c: any) => {
    const mine = scoreOption({
      underlying: S,
      strike: c.strike,
      dte: c.days,
      mid: c.mid,
      rvPct,
      ivRank,
      delta: c.delta,
      spreadPct: c.spread_pct,
      oi: c.oi ?? 0,
      volume: c.volume ?? 0,
      isCall,
      targetDte: timeframe,
      backtestFactor: localBtFactor,
      collateral: c.collateral_per_contract ?? c.strike * 100,
    });

    // 真实 score_components（仅带有效 token 时存在）
    const sc = c.score_components || null;
    const authed = !!sc;
    const realBacktest = sc?.backtest_factor ?? null;

    // 方法 2：无 token 时从官方分反解 backtest（残差，吸收 wheel/gamma 等及近似误差）
    const f = mine.factors;
    const knownProduct =
      mine.base * f.dte_factor * f.delta_factor * f.iv_factor * f.liquidity_factor;
    const impliedResidual =
      knownProduct > 0 && c.score != null ? Math.round((c.score / knownProduct) * 100) / 100 : null;

    // 若拿到真实因子，整组替换为官方值（这样 backtest 及其余因子都是真值）
    const factors = authed
      ? {
          dte_factor: sc.dte_factor ?? f.dte_factor,
          delta_factor: sc.delta_factor ?? f.delta_factor,
          iv_factor: sc.iv_factor ?? f.iv_factor,
          liquidity_factor: sc.liquidity_factor ?? f.liquidity_factor,
          backtest_factor: sc.backtest_factor ?? 1.12,
          earnings_factor: sc.earnings_factor ?? 1,
          macro_factor: sc.macro_factor ?? 1,
          gamma_factor: sc.gamma_factor ?? 1,
          wheel_factor: sc.wheel_factor ?? 1,
          wto_factor: sc.wto_factor ?? 1,
          exdiv_factor: sc.exdiv_factor ?? 1,
          sympathy_factor: sc.sympathy_factor ?? 1,
          safety: sc.safety ?? 1,
        }
      : f;

    // 授权模式下用「我们的 EV 基底 × 真实因子」重算，理应≈官方分（结构验证）
    const evForScore = authed && sc.ev_annualized_pct != null ? sc.ev_annualized_pct : mine.evAnnualizedPct;
    const myScore = authed
      ? Math.round(
          Math.max(evForScore, 0.5) *
            Object.values(factors).reduce((p, v) => p * (v as number), 1) *
            100,
        ) / 100
      : mine.score;

    return {
      ticker,
      strike: c.strike,
      type: c.type,
      days: c.days,
      expiry: c.expiry,
      mid: c.mid,
      delta: c.delta,
      iv: c.iv,
      spread_pct: c.spread_pct,
      oi: c.oi,
      volume: c.volume,
      annualized_yield_pct: c.annualized_yield_pct,
      moneyness_pct: c.moneyness_pct,
      prob_safe_pct: c.prob_safe_pct,
      official_score: c.score,
      official_tier: c?.verdict?.tier ?? null,
      my_score: myScore,
      my_tier: scoreToTier(myScore),
      my_stars: mine.stars,
      ev_annualized_pct: authed && sc.ev_annualized_pct != null ? sc.ev_annualized_pct : mine.evAnnualizedPct,
      fair_value: authed && sc.fair_value_per_share != null ? sc.fair_value_per_share : mine.fairValue,
      vrp_ratio: authed && sc.vrp_ratio != null ? sc.vrp_ratio : mine.vrpRatio,
      factors,
      liquidity_breakdown: sc?.liquidity_breakdown ?? mine.liquidityBreakdown,
      // backtest 专项
      authed,
      backtest_factor: authed ? realBacktest : null,
      implied_residual: impliedResidual,
    };
  });

  candidates.sort((a: any, b: any) => b.my_score - a.my_score);

  return {
    ticker,
    underlying: S,
    iv_rank: d.iv_rank,
    criteria: d.criteria,
    algorithm: d.algorithm,
    data_source: d.data_source,
    timestamp: d.timestamp,
    backtest_summary: authedTicker ? (d.backtest_summary ?? null) : localBt,
    authed: candidates.some((c: any) => c.authed),
    candidates,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 解析标的列表：tickers[] 优先，否则 ticker 按逗号拆
    let tickers: string[] = [];
    if (Array.isArray(body.tickers)) {
      tickers = body.tickers;
    } else if (body.ticker) {
      tickers = String(body.ticker).split(/[,\s]+/);
    }
    tickers = tickers
      .map((t) => String(t).trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 6); // 最多 6 个，防滥用

    if (tickers.length === 0) {
      return NextResponse.json({ error: "ticker required" }, { status: 400 });
    }

    const intent = body.intent || "csp";
    const risk = body.risk || "balanced";
    const direction = body.direction || "bullish";
    const timeframe = parseInt(body.timeframe, 10) || 30;
    const accessToken = typeof body.access_token === "string" ? body.access_token.trim() : undefined;

    // 可调回测参数（仅无 token 的本地回测使用）
    const bt = body.backtest || {};
    const btParams: BacktestParams = {
      targetDelta: bt.targetDelta != null ? Number(bt.targetDelta) : undefined,
      dteDays: bt.dteDays != null ? Number(bt.dteDays) : undefined,
      stopMult: bt.stopMult != null ? Number(bt.stopMult) : undefined,
    };

    const results = await Promise.all(
      tickers.map((t) => scanOne(t, intent, risk, direction, timeframe, accessToken, btParams)),
    );

    // 汇总 Top 候选（跨标的，按复现分）
    const all = results.flatMap((r: any) => r.candidates || []);
    all.sort((a: any, b: any) => b.my_score - a.my_score);
    const top = all.slice(0, 10);

    return NextResponse.json({
      multi: tickers.length > 1,
      tickers,
      results,
      top,
    });
  } catch (error: any) {
    console.error("baozugong route error:", error);
    return NextResponse.json(
      { error: "internal error", detail: String(error?.message || error) },
      { status: 500 },
    );
  }
}
