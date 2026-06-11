"""
baozugong_backtest.py — 自建 12 个月期权回测，复现 backtest_factor
=================================================================

目标：在没有 token 的情况下，自己算出 backtest_factor。

后端 backtest_factor 来自一个历史回测（backtest_summary）：
    calibration_ratio = win_rate / theoretical_pop   （实际胜率 ÷ 理论胜率）
    backtest_factor   = 阶梯(cr):  ≥0.98→1.12 / ≥0.85→1.04 / else→1.00

本脚本复刻该方法：
  1. 拉标的过去 ~14 个月日线（Yahoo），算滚动 30 日已实现波动率（当 IV 代理）。
  2. 在过去 12 个月里按固定节奏开仓（≈67 笔，对齐后端样本量）：
       - CSP：卖目标 delta 的 put；Covered Call：卖目标 delta 的 call。
       - 用 BS 在「真实历史路径」上每日重新定价，规则 = 50% 利润早平 / 否则持到到期。
  3. realized_win_rate = 实际路径下盈利的比例。
     theoretical_pop   = 模型理论胜率（风险中性 N(d2)，与后端 pop 同量级）。
     calibration_ratio = realized / theoretical。
  4. backtest_factor = 阶梯映射（复用 baozugong_score 的函数）。

核心直觉（也是实测里 AAPL/GOOG 的现象）：
  上涨趋势的股票 → 卖 put 的实际胜率 > 理论(cr>1, 满额1.12)；
                   卖 call 的实际胜率 < 理论(cr<1, 被砍到1.04/1.00)。

仅用标准库 + urllib，无第三方依赖。
"""

from __future__ import annotations

import json
import math
import urllib.request
from dataclasses import dataclass
from statistics import NormalDist

from baozugong_score import bs_price, backtest_factor_from_calibration

_N = NormalDist().cdf
_NINV = NormalDist().inv_cdf
RISK_FREE = 0.043


# ── 数据 ────────────────────────────────────────────────────────────
def fetch_daily_closes(ticker: str, rng: str = "2y") -> list[tuple[int, float]]:
    """从 Yahoo 拉日线收盘价，返回 [(timestamp, close), ...]（按时间升序，去除 None）。"""
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?range={rng}&interval=1d"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        d = json.loads(resp.read().decode())
    r = d["chart"]["result"][0]
    ts = r["timestamp"]
    closes = r["indicators"]["quote"][0]["close"]
    out = [(t, c) for t, c in zip(ts, closes) if c is not None]
    return out


def rolling_vol(closes: list[float], window: int = 30) -> list[float | None]:
    """每个位置算「之前 window 日」对数收益的年化标准差。"""
    rets = [math.log(closes[i] / closes[i - 1]) for i in range(1, len(closes))]
    vols: list[float | None] = [None]  # 第 0 个没有收益
    for i in range(1, len(closes)):
        if i < window:
            vols.append(None)
            continue
        seg = rets[i - window:i]
        mu = sum(seg) / len(seg)
        var = sum((x - mu) ** 2 for x in seg) / (len(seg) - 1)
        vols.append(math.sqrt(var) * math.sqrt(252))
    return vols


# ── 单笔交易模拟 ─────────────────────────────────────────────────────
def strike_for_delta(S: float, sigma: float, T: float, target_delta: float, is_call: bool) -> float:
    """反解出使期权 |delta| ≈ target_delta 的行权价（BS, 无股息）。"""
    # call delta = N(d1) ; put delta = N(d1)-1 → |put delta| = N(-d1)
    if is_call:
        d1 = _NINV(target_delta)
    else:
        d1 = -_NINV(target_delta)
    # d1 = (ln(S/K) + (r+sig²/2)T)/(sig√T)  → 解 K
    ln_sk = d1 * sigma * math.sqrt(T) - (RISK_FREE + sigma * sigma / 2) * T
    return S / math.exp(ln_sk)


def theoretical_pop(S: float, K: float, sigma: float, T: float, is_call: bool) -> float:
    """理论胜率 ≈ 风险中性下到期不被行权的概率（短 put: P(S_T>K)=N(d2)；短 call: N(-d2)）。"""
    d1 = (math.log(S / K) + (RISK_FREE + sigma * sigma / 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return _N(d2) if not is_call else _N(-d2)


@dataclass
class TradeResult:
    win: bool
    pnl_pct: float  # 相对权利金的盈亏%（+100 = 赚满权利金）


def simulate_trade(
    path: list[float],
    sigma: float,
    dte_days: int,
    target_delta: float,
    is_call: bool,
    profit_target: float = 0.5,
    stop_mult: float = 2.0,
) -> TradeResult | None:
    """
    在真实价格路径 path（含进场日, 长度≥dte 交易日）上模拟卖方单笔。
    规则（对齐后端 exit_plan）：
      - 期权价跌到入场权利金的 (1-profit_target) → 50% 利润早平 → win
      - 期权价涨到入场权利金的 (1+stop_mult)     → 触发止损/被迫 roll → loss
      - 否则持到到期，按内在价值结算盈亏
    （止损让上涨趋势里的卖 call 被锁成 loss，而非死扛到到期再算——更贴近真实回测胜率。）
    """
    if len(path) < 2:
        return None
    S0 = path[0]
    T0 = dte_days / 365.0
    K = strike_for_delta(S0, sigma, T0, target_delta, is_call)
    premium0 = bs_price(S0, K, T0, sigma, RISK_FREE, is_call)
    if premium0 <= 0:
        return None

    n = min(len(path) - 1, dte_days)
    for day in range(1, n + 1):
        S = path[day]
        T_left = max((dte_days - day) / 365.0, 1e-6)
        price = bs_price(S, K, T_left, sigma, RISK_FREE, is_call)
        if price <= premium0 * (1 - profit_target):
            return TradeResult(win=True, pnl_pct=profit_target * 100)        # 50% 利润早平
        if price >= premium0 * (1 + stop_mult):
            return TradeResult(win=False, pnl_pct=-stop_mult * 100)          # 止损
    # 持到到期：按内在价值结算
    S_T = path[n]
    intrinsic = max(0.0, (S_T - K) if is_call else (K - S_T))
    pnl = premium0 - intrinsic
    return TradeResult(win=pnl > 0, pnl_pct=pnl / premium0 * 100)


# ── 回测主流程 ──────────────────────────────────────────────────────
@dataclass
class BacktestResult:
    ticker: str
    is_call: bool
    n_trades: int
    win_rate: float
    theoretical_pop: float
    calibration_ratio: float
    avg_pnl_pct: float
    backtest_factor: float


def backtest(
    ticker: str,
    is_call: bool,
    target_delta: float = 0.27,
    dte_days: int = 30,
    target_trades: int = 67,
    stop_mult: float = 2.0,
) -> BacktestResult:
    series = fetch_daily_closes(ticker, rng="2y")
    closes = [c for _, c in series]
    vols = rolling_vol(closes, window=30)

    dte_td = round(dte_days * 252 / 365)  # DTE 换算成交易日 (~21)
    n = len(closes)
    # 过去 12 个月 ≈ 252 交易日窗口；进场点需留出 dte_td 的未来路径
    start = max(30, n - 252 - dte_td)
    end = n - dte_td  # 最后一个能开满仓的进场点
    if end <= start:
        raise RuntimeError("历史数据不足")

    entry_idxs = list(range(start, end))
    step = max(1, len(entry_idxs) // target_trades)
    entries = entry_idxs[::step][:target_trades]

    wins = 0
    pop_sum = 0.0
    pnl_sum = 0.0
    used = 0
    for i in entries:
        sigma = vols[i]
        if sigma is None or sigma <= 0:
            continue
        path = closes[i:i + dte_td + 1]
        tr = simulate_trade(path, sigma, dte_days, target_delta, is_call, stop_mult=stop_mult)
        if tr is None:
            continue
        S0 = closes[i]
        T0 = dte_days / 365.0
        K = strike_for_delta(S0, sigma, T0, target_delta, is_call)
        pop_sum += theoretical_pop(S0, K, sigma, T0, is_call)
        wins += 1 if tr.win else 0
        pnl_sum += tr.pnl_pct
        used += 1

    if used == 0:
        raise RuntimeError("无有效交易")

    win_rate = wins / used * 100
    pop = pop_sum / used * 100
    cr = round(win_rate / pop, 2) if pop > 0 else 0.0
    return BacktestResult(
        ticker=ticker,
        is_call=is_call,
        n_trades=used,
        win_rate=round(win_rate, 1),
        theoretical_pop=round(pop, 1),
        calibration_ratio=cr,
        avg_pnl_pct=round(pnl_sum / used, 2),
        backtest_factor=backtest_factor_from_calibration(cr),
    )


if __name__ == "__main__":
    # 验证：对照实测真值
    #   AAPL csp        → cr≈1.19 → 1.12
    #   AAPL covered_call → cr≈0.96 → 1.04
    #   GOOG covered_call → cr≈0.71 → 1.00
    #   NVDA covered_call → cr≈1.12 → 1.12
    cases = [
        ("AAPL", False, "csp"),
        ("AAPL", True, "covered_call"),
        ("GOOG", True, "covered_call"),
        ("NVDA", True, "covered_call"),
        ("TSLA", False, "csp"),
    ]
    print(f"{'ticker':6}{'strat':14}{'n':>4}{'win%':>7}{'pop%':>7}{'calib':>7}{'bt':>6}{'avgPnl%':>9}")
    print("-" * 60)
    for tk, is_call, lbl in cases:
        try:
            r = backtest(tk, is_call)
            print(f"{tk:6}{lbl:14}{r.n_trades:>4}{r.win_rate:>7}{r.theoretical_pop:>7}"
                  f"{r.calibration_ratio:>7}{r.backtest_factor:>6}{r.avg_pnl_pct:>9}")
        except Exception as e:
            print(f"{tk:6}{lbl:14} ERROR {e}")
