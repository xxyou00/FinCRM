/**
 * lib/baozugong-backtest.ts — 自建 12 个月期权回测（无 token 也能算 backtest_factor）
 * ===================================================================================
 * 复刻后端 backtest_summary 的方法：
 *   calibration_ratio = realized_win_rate / theoretical_pop
 *   backtest_factor   = 阶梯(cr)  ≥0.98→1.12 / ≥0.85→1.04 / else→1.00
 *
 * 数据：Yahoo 日线（server-side fetch）。波动率用滚动 30 日已实现波动率当 IV 代理。
 * 规则对齐后端 exit_plan：50% 利润早平 / 止损(≈2x权利金) / 否则持到到期。
 *
 * 说明：这是对闭源回测的「近似复现」——put 侧与真值吻合好，整体方向正确（强趋势股
 * 卖 call 被扣），但精确到 1.00/1.04/1.12 的分档对个别标的会差一档（路径依赖 +
 * 我们只有日收盘 + 估算 IV + 猜测参数）。带 token 时仍以后端真值为准。
 */

import { bsPrice, normCdf, backtestFactorFromCalibration } from "@/lib/baozugong";

const RISK_FREE = 0.043;

/** 逆标准正态 CDF（Acklam 近似）。 */
function invNorm(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q: number, r: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pl) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export async function fetchDailyCloses(ticker: string, range = "2y"): Promise<number[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`yahoo ${r.status}`);
  const d = await r.json();
  const res = d?.chart?.result?.[0];
  const closes: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? [];
  return closes.filter((c): c is number => c != null);
}

function rollingVol(closes: number[], window = 30): (number | null)[] {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const vols: (number | null)[] = [null];
  for (let i = 1; i < closes.length; i++) {
    if (i < window) { vols.push(null); continue; }
    const seg = rets.slice(i - window, i);
    const mu = seg.reduce((a, b) => a + b, 0) / seg.length;
    const varc = seg.reduce((a, b) => a + (b - mu) ** 2, 0) / (seg.length - 1);
    vols.push(Math.sqrt(varc) * Math.sqrt(252));
  }
  return vols;
}

function strikeForDelta(S: number, sigma: number, T: number, targetDelta: number, isCall: boolean): number {
  const d1 = isCall ? invNorm(targetDelta) : -invNorm(targetDelta);
  const lnSK = d1 * sigma * Math.sqrt(T) - (RISK_FREE + (sigma * sigma) / 2) * T;
  return S / Math.exp(lnSK);
}

function theoreticalPop(S: number, K: number, sigma: number, T: number, isCall: boolean): number {
  const d1 = (Math.log(S / K) + (RISK_FREE + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return isCall ? normCdf(-d2) : normCdf(d2);
}

function simulateTrade(
  path: number[], sigma: number, dteDays: number, targetDelta: number, isCall: boolean,
  profitTarget = 0.5, stopMult = 2.0,
): { win: boolean; pnlPct: number } | null {
  if (path.length < 2) return null;
  const S0 = path[0];
  const T0 = dteDays / 365;
  const K = strikeForDelta(S0, sigma, T0, targetDelta, isCall);
  const premium0 = bsPrice(S0, K, T0, sigma, RISK_FREE, isCall);
  if (premium0 <= 0) return null;
  const n = Math.min(path.length - 1, dteDays);
  for (let day = 1; day <= n; day++) {
    const S = path[day];
    const Tleft = Math.max((dteDays - day) / 365, 1e-6);
    const price = bsPrice(S, K, Tleft, sigma, RISK_FREE, isCall);
    if (price <= premium0 * (1 - profitTarget)) return { win: true, pnlPct: profitTarget * 100 };
    if (price >= premium0 * (1 + stopMult)) return { win: false, pnlPct: -stopMult * 100 };
  }
  const ST = path[n];
  const intrinsic = Math.max(0, isCall ? ST - K : K - ST);
  const pnl = premium0 - intrinsic;
  return { win: pnl > 0, pnlPct: (pnl / premium0) * 100 };
}

export interface BacktestSummary {
  win_rate: number;
  theoretical_pop: number;
  calibration_ratio: number;
  backtest_factor: number;
  n_trades: number;
  avg_pnl_pct: number;
  window_months: number;
  source: "local_backtest";
  params: { target_delta: number; dte_days: number; stop_mult: number };
  cached?: boolean;
}

// ── 缓存（1 小时 TTL）─────────────────────────────────────────────
const TTL_MS = 60 * 60 * 1000;
const _priceCache = new Map<string, { ts: number; closes: number[] }>();
const _resultCache = new Map<string, { ts: number; result: BacktestSummary }>();

async function getCloses(ticker: string): Promise<number[]> {
  const hit = _priceCache.get(ticker);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.closes;
  const closes = await fetchDailyCloses(ticker, "2y");
  _priceCache.set(ticker, { ts: Date.now(), closes });
  return closes;
}

export interface BacktestParams {
  targetDelta?: number;
  dteDays?: number;
  targetTrades?: number;
  stopMult?: number;
}

export async function runBacktest(
  ticker: string,
  isCall: boolean,
  params: BacktestParams = {},
): Promise<BacktestSummary> {
  const targetDelta = params.targetDelta ?? 0.27;
  const dteDays = params.dteDays ?? 30;
  const targetTrades = params.targetTrades ?? 67;
  const stopMult = params.stopMult ?? 2.0;

  const cacheKey = `${ticker}|${isCall}|${targetDelta}|${dteDays}|${targetTrades}|${stopMult}`;
  const cHit = _resultCache.get(cacheKey);
  if (cHit && Date.now() - cHit.ts < TTL_MS) return { ...cHit.result, cached: true };

  const closes = await getCloses(ticker);
  const vols = rollingVol(closes, 30);
  const dteTd = Math.round((dteDays * 252) / 365);
  const n = closes.length;
  const start = Math.max(30, n - 252 - dteTd);
  const end = n - dteTd;
  if (end <= start) throw new Error("insufficient history");

  const entryIdxs: number[] = [];
  for (let i = start; i < end; i++) entryIdxs.push(i);
  const step = Math.max(1, Math.floor(entryIdxs.length / targetTrades));
  const entries = entryIdxs.filter((_, k) => k % step === 0).slice(0, targetTrades);

  let wins = 0, popSum = 0, pnlSum = 0, used = 0;
  for (const i of entries) {
    const sigma = vols[i];
    if (sigma == null || sigma <= 0) continue;
    const path = closes.slice(i, i + dteTd + 1);
    const tr = simulateTrade(path, sigma, dteDays, targetDelta, isCall, 0.5, stopMult);
    if (!tr) continue;
    const S0 = closes[i];
    const K = strikeForDelta(S0, sigma, dteDays / 365, targetDelta, isCall);
    popSum += theoreticalPop(S0, K, sigma, dteDays / 365, isCall);
    wins += tr.win ? 1 : 0;
    pnlSum += tr.pnlPct;
    used++;
  }
  if (used === 0) throw new Error("no valid trades");

  const winRate = (wins / used) * 100;
  const pop = (popSum / used) * 100;
  const cr = pop > 0 ? Math.round((winRate / pop) * 100) / 100 : 0;
  const result: BacktestSummary = {
    win_rate: Math.round(winRate * 10) / 10,
    theoretical_pop: Math.round(pop * 10) / 10,
    calibration_ratio: cr,
    backtest_factor: backtestFactorFromCalibration(cr),
    n_trades: used,
    avg_pnl_pct: Math.round((pnlSum / used) * 100) / 100,
    window_months: 12,
    source: "local_backtest",
    params: { target_delta: targetDelta, dte_days: dteDays, stop_mult: stopMult },
  };
  _resultCache.set(cacheKey, { ts: Date.now(), result });
  return result;
}
