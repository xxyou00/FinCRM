/**
 * lib/baozugong.ts — 「包租公」期权打分算法 v2.2 的 TypeScript 复现
 * ====================================================================
 * 由 baozugong.app 公开 API 的 score_components 反向工程 + 实测校准得到
 * （跨 8 标的 63 候选，结构反推误差 < 3%）。Python 原版见 baozugong_score.py。
 *
 * 核心公式：
 *   rent_score = max(EV年化%, 0.5) × Π(因子)
 *   EV年化%   = (市价 − BS按RV定的公允价) × 100 / 抵押金 × 365 / DTE × 100
 *
 * 灵魂：打分不看「收益率高低」，看「期权相对其公允价被高估多少」(VRP=IV/RV)。
 */

const DEFAULT_RISK_FREE = 0.043;

/** 标准正态 CDF（Abramowitz-Stegun 近似，精度足够打分用）。 */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  let p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** 欧式期权 Black-Scholes 价格。T 单位为年，sigma 为年化波动率（小数）。 */
export function bsPrice(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r: number,
  isCall: boolean,
): number {
  if (T <= 0 || sigma <= 0) {
    const intrinsic = isCall ? S - K : K - S;
    return Math.max(0, intrinsic);
  }
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (isCall) return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

/** 用已实现波动率 RV 给期权定公允价（VRP 的分母逻辑）。 */
export function fairValueFromRv(
  S: number,
  K: number,
  dte: number,
  rvPct: number,
  isCall: boolean,
  r = DEFAULT_RISK_FREE,
): number {
  return bsPrice(S, K, dte / 365, rvPct / 100, r, isCall);
}

/** 年化期望超额收益 (%)。edge = 市价 − 公允价，按抵押金占用做百分比再年化。 */
export function evAnnualizedPct(
  mid: number,
  fairValue: number,
  collateral: number,
  dte: number,
): number {
  if (collateral <= 0 || dte <= 0) return 0;
  const edgePerContract = (mid - fairValue) * 100;
  return (edgePerContract / collateral) * (365 / dte) * 100;
}

// ── 因子曲线（实测校准）─────────────────────────────────────────────
export const DELTA_BANDS: Record<string, [number, number]> = {
  conservative: [0.08, 0.2],
  balanced: [0.2, 0.35],
  aggressive: [0.35, 0.5],
};

const SWEET_DELTA = 0.275;
const SWEET_DELTA_PEAK = 1.15;

/** 全局帐篷形：峰值固定在 |Δ|≈0.275，高 delta 侧惩罚更陡（被指派风险）。 */
export function deltaFactor(delta: number): number {
  const ad = Math.abs(delta);
  const d = Math.abs(ad - SWEET_DELTA);
  const drop = ad <= SWEET_DELTA ? 0.9 * d + 0.8 * d * d : 0.22 * d + 8.8 * d * d;
  return round2(Math.max(0.3, SWEET_DELTA_PEAK - drop));
}

/** DTE 甜蜜区：峰约在目标天数的 3/4，超过目标急速跌（呼应 tasty 21DTE 哲学）。 */
export function dteFactor(dte: number, target: number): number {
  if (target <= 0) return 1.0;
  const peakR = 0.75;
  const r = dte / target;
  let f = r <= peakR ? 1.16 - 0.4 * (peakR - r) : 1.16 - 1.25 * (r - peakR);
  if (target <= 10 && dte >= 3 && dte <= target) f = Math.max(f, 1.12);
  return round2(Math.max(0.3, Math.min(1.2, f)));
}

/** 精确拟合：spread_score = 1 − spread%/40。 */
export function spreadScore(spreadPct: number): number {
  return round2(Math.max(0.1, 1 - spreadPct / 40));
}

export function oiMod(oi: number): number {
  if (oi <= 0) return 0.5;
  if (oi < 200) return 0.85;
  if (oi < 500) return 0.95;
  if (oi < 1500) return 1.0;
  return 1.1;
}

export function volMod(volume: number): number {
  return volume >= 200 ? 1.05 : 1.0;
}

export interface LiquidityBreakdown {
  spread_score: number;
  oi_mod: number;
  vol_mod: number;
  oi: number;
  volume: number;
}

/** 流动性 = spread_score × oi_mod × vol_mod（精确复现）。 */
export function liquidityFactor(
  spreadPct: number,
  oi: number,
  volume: number,
): { factor: number; breakdown: LiquidityBreakdown } {
  const ss = spreadScore(spreadPct);
  const om = oiMod(oi);
  const vm = volMod(volume);
  return {
    factor: round2(ss * om * vm),
    breakdown: { spread_score: ss, oi_mod: om, vol_mod: vm, oi, volume },
  };
}

/** IV rank 因子：实测在 rank 20~100 区间恒为 1.0（IV richness 已被 EV/VRP 捕获）。 */
export function ivFactor(ivRank: number): number {
  return ivRank < 20 ? 0.95 : 1.0;
}

/**
 * backtest_factor —— 反向工程结论。
 *
 * 它不是 live greeks 的闭式函数，而是一次「历史回测」的输出（后端 backtest_summary）：
 *   calibration_ratio = win_rate / theoretical_pop   （实际胜率 ÷ 理论胜率）
 *   backtest_factor   = 对 calibration_ratio 的 3 档阶梯
 *
 * 实测锚点 (calibration_ratio → backtest_factor):
 *   0.71→1.00   0.96→1.04   0.99→1.12   1.02~1.59 全 →1.12
 *
 * 含义：当某策略在过去 12 个月（67 笔、50% 止盈早平）的真实胜率 ≥ 理论胜率
 * (cr≥~0.98) → 满额 1.12；明显跑输理论 (cr<~0.85) → 中性 1.00。典型被砍的情形
 * 是「逆势卖方」——对强趋势大盘股卖 call（AAPL/GOOG call: cr 0.96/0.71 → 1.04/1.00），
 * 卖方常被行情碾过。win_rate 需后端历史期权回测数据，本地无法重算（且匿名响应里
 * backtest_summary 被锁），故只有带 token 才拿得到真值；下面给出由 cr 推 factor 的映射。
 */
export function backtestFactorFromCalibration(calibrationRatio: number): number {
  if (calibrationRatio >= 0.98) return 1.12;
  if (calibrationRatio >= 0.85) return 1.04;
  return 1.0;
}

/** 财报跨期：到期前有财报 → ×0 否决（实战中引擎多在选到期日阶段已规避）。 */
export function earningsFactor(daysToEarnings: number | null, dte: number): number {
  if (daysToEarnings == null) return 1.0;
  if (daysToEarnings >= 0 && daysToEarnings <= dte) return 0.0;
  if (daysToEarnings <= dte + 5) return 0.9;
  return 1.0;
}

// ── 主打分入口 ──────────────────────────────────────────────────────
export interface OptionInput {
  underlying: number;
  strike: number;
  dte: number;
  mid: number;
  rvPct: number;
  ivRank: number;
  delta: number;
  spreadPct: number;
  oi: number;
  volume: number;
  isCall?: boolean;
  collateral?: number | null;
  targetDte?: number;
  daysToEarnings?: number | null;
  backtestFactor?: number;
  macroFactor?: number;
  gammaFactor?: number;
  wheelFactor?: number;
  wtoFactor?: number;
  exdivFactor?: number;
  sympathyFactor?: number;
  safety?: number;
  riskFree?: number;
}

export interface ScoreResult {
  score: number;
  evAnnualizedPct: number;
  base: number;
  fairValue: number;
  vrpRatio: number;
  tier: number;
  stars: string;
  factors: Record<string, number>;
  liquidityBreakdown: LiquidityBreakdown;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 分数 → 星级（实测：9.11→5★ 8.49→4★ 4.44→3★ 3.97→2★ <3.8→1★）。 */
export function scoreToTier(score: number): number {
  if (score >= 9.0) return 5;
  if (score >= 6.0) return 4;
  if (score >= 4.2) return 3;
  if (score >= 3.9) return 2;
  return 1;
}

export function scoreOption(o: OptionInput): ScoreResult {
  const isCall = o.isCall ?? false;
  const collateral = o.collateral ?? o.strike * 100;
  const targetDte = o.targetDte ?? 21;

  const fair = fairValueFromRv(o.underlying, o.strike, o.dte, o.rvPct, isCall, o.riskFree ?? DEFAULT_RISK_FREE);
  const ev = evAnnualizedPct(o.mid, fair, collateral, o.dte);
  const base = Math.max(ev, 0.5); // EV<0.5 被夹到 0.5，垫底

  const fDte = dteFactor(o.dte, targetDte);
  const fDelta = deltaFactor(o.delta);
  const fIv = ivFactor(o.ivRank);
  const liq = liquidityFactor(o.spreadPct, o.oi, o.volume);
  const fEarn = earningsFactor(o.daysToEarnings ?? null, o.dte);
  const bt = o.backtestFactor ?? 1.0;
  const macro = o.macroFactor ?? 1.0;
  const gamma = o.gammaFactor ?? 1.0;
  const wheel = o.wheelFactor ?? 1.0;
  const wto = o.wtoFactor ?? 1.0;
  const exdiv = o.exdivFactor ?? 1.0;
  const sympathy = o.sympathyFactor ?? 1.0;
  const safety = o.safety ?? 1.0;

  const product =
    fDte * fDelta * fIv * liq.factor * bt * fEarn * macro * gamma * wheel * wto * exdiv * sympathy * safety;

  const score = round2(base * product);
  const tier = scoreToTier(score);

  return {
    score,
    evAnnualizedPct: round2(ev),
    base: round2(base),
    fairValue: round2(fair),
    vrpRatio: fair ? round2(o.mid / fair) : 0,
    tier,
    stars: "★".repeat(tier) + "☆".repeat(5 - tier),
    factors: {
      dte_factor: fDte,
      delta_factor: fDelta,
      iv_factor: fIv,
      liquidity_factor: liq.factor,
      backtest_factor: bt,
      earnings_factor: fEarn,
      macro_factor: macro,
      gamma_factor: gamma,
      wheel_factor: wheel,
      wto_factor: wto,
      exdiv_factor: exdiv,
      sympathy_factor: sympathy,
      safety,
    },
    liquidityBreakdown: liq.breakdown,
  };
}
