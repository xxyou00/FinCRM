# 包租公期权打分模块（Baozugong Option Scoring）

对 [baozugong.app](https://baozugong.app) 期权推荐引擎（algorithm v2.2）打分逻辑的
**独立逆向复现**，已接入 FinCRM 作为一个页签。纯研究/教学用途，不下单、不构成投资建议。

> 数据来自实时期权链（上游引擎，Schwab 数据源），所有打分逻辑均由公开 API 的
> `score_components` 反向工程 + 实测校准得到（跨 8 标的 63 候选，结构反推误差 < 3%）。

---

## 文件清单

| 文件 | 作用 |
|--|--|
| `lib/baozugong.ts` | 打分核心：Black-Scholes、EV 基底、13 因子、`scoreOption()`、星级映射 |
| `lib/baozugong-backtest.ts` | 自建 12 个月期权回测（算 `backtest_factor`）+ 1 小时缓存 |
| `app/api/baozugong/route.ts` | API 路由：代理上游拿候选 → 本地重打分 → 返回对照 |
| `app/baozugong/page.tsx` | 页面：扫描表单 + Top-N + 可展开 13 因子明细 |
| `baozugong_score.py` | 打分逻辑的 Python 参考实现（含自测 A/B/C/D） |
| `baozugong_backtest.py` | 回测的 Python 参考实现（含对照真值的验证） |

入口：侧栏「包租公·期权」(`/baozugong`)。

---

## 打分公式（已实测验证）

```
包租公分 = max(EV年化%, 0.5) × Π(13 因子)

EV年化% = (期权市价 − BS按RV定的公允价) × 100 / 抵押金 × 365 / DTE × 100
```

**灵魂**：打分不看"收益率高低"，看"期权相对其公允价被高估多少"(VRP = IV/RV)。
EV<0.5（含负值，对卖方不够贵）→ 基底被夹到 0.5，排名垫底。

### 13 因子里真正拉开分差的三项

| 因子 | 规律 |
|--|--|
| `delta_factor` | 全局帐篷，峰固定在 \|Δ\|≈0.275（×1.15）；高 delta 侧惩罚更陡（指派风险） |
| `liquidity_factor` | = `(1 − spread%/40) × oi_mod × vol_mod`（精确拟合） |
| `dte_factor` | 甜蜜区 ≈ 目标天数的 3/4；超过目标急速跌穿 1.0 |

其余因子（`iv` / `earnings` / `macro` / `gamma` / `wheel` / `wto` / `exdiv` / `sympathy` / `safety`）
实战中大多恒为 1.0，是兜底/情景项。其中：
- `iv_factor`：实测 IV rank 20~100 恒为 1.0（IV richness 已被 EV/VRP 捕获，不重复计价）。
- `earnings_factor`：跨财报 ×0 否决，但引擎多在"选到期日"阶段就避开了财报，故罕见。

---

## backtest_factor 的三种来源

`backtest_factor` 不是 live greeks 的闭式函数，而是一次历史回测的输出：

```
calibration_ratio = 实际胜率(win_rate) / 理论胜率(theoretical_pop)
backtest_factor   = 阶梯:  cr≥0.98 → 1.12 / cr≥0.85 → 1.04 / else → 1.00
```

含义：某卖方策略过去 12 个月真实胜率 ≥ 理论胜率 → 满额 1.12；明显跑输 → 1.00。
典型被砍：**对强趋势大盘股卖 call**（顺势被碾），如 AAPL/GOOG 的 call。

本模块按可用信息分三档拿到它：

| 来源 | 触发条件 | 精度 |
|--|--|--|
| **后端真值** | 在页面"高级"里粘贴 baozugong 登录 token | 最高（复现分与官方分误差 0–2.4%） |
| **本地回测** | 无 token 时自动跑 12 个月回测 | put 侧准、call 侧方向对、分档可能差一档 |
| **反解残差** | 兜底 | `官方分 ÷ 已知因子`，吸收 wheel/gamma 等未建模项 |

### 关于 token

- 取法：登录 baozugong.app 后浏览器 Console 运行
  `(await window._sb.auth.getSession()).data.session.access_token`
- 约 1 小时过期；只在本次请求转发给上游，**不存储**。

---

## 本地回测（lib/baozugong-backtest.ts）

复刻后端的 `calibration_ratio` 方法：

1. 拉标的过去 ~14 个月日线（Yahoo），算滚动 30 日已实现波动率当 IV 代理。
2. 过去 12 个月里按节奏开 ~67 笔仓：按目标 delta 卖 put/call，用 BS 在真实历史路径上
   每日重定价；规则 = **50% 利润早平 / 涨到 ~stop× 权利金止损 / 否则持到到期**。
3. `calibration_ratio = 实际胜率 / 理论胜率(N(d2))` → 阶梯映射出 `backtest_factor`。

**缓存**：价格序列按 ticker、回测结果按全参数组合键，各缓存 1 小时。

### 可调参数（页面"回测参数"面板，仅本地估算用）

| 参数 | 默认 | 调高的影响 |
|--|--|--|
| 目标 Delta | 0.27 | ↑ 通常拉低胜率（更靠近行权） |
| 回测 DTE | 30 | 改变持仓窗口 |
| 止损(×权利金) | 2.0 | ↓（更紧）拉低胜率，逆势仓更快锁损 |

**调参示例**（GOOG covered call，真值 cr 0.71 → bt 1.00）：
- 默认 Δ0.27 / stop 2.0 → cr 0.85 → bt 1.04
- 调成 Δ0.40 / stop 1.5 → cr 0.78 → **bt 1.00**（命中真值档）

---

## API 用法

```bash
POST /api/baozugong
{
  "ticker": "AAPL,MSFT,NVDA",        // 单个或逗号分隔，最多 6 个
  "intent": "csp",                    // csp / covered_call / premium / strangle
  "direction": "bullish",             // bullish / bearish / neutral
  "risk": "balanced",                 // conservative / balanced / aggressive
  "timeframe": "30",                  // 目标 DTE
  "access_token": "eyJ...",           // 可选：解锁真实因子
  "backtest": { "targetDelta": 0.4, "dteDays": 30, "stopMult": 1.5 }  // 可选：调参
}
```

返回：`{ multi, tickers, results[], top[] }`，每个候选含 `my_score`/`official_score`/
`ev_annualized_pct`/`vrp_ratio`/`factors`（13 项）/`backtest_factor`/`implied_residual`。

---

## 核心结论一句话

> 包租公分 = **EV（用 VRP 判这单期权贵不贵）** 当基底，乘上 13 个调节因子。
> 它不是在挑"收益率最高"的期权，而是在挑"相对公允价被高估、且风险结构最干净"的卖方头寸。
> 真正干活的因子只有 **delta / 流动性 / DTE** 三个；backtest_factor 衡量的是"这套策略历史上
> 兑现了多少理论胜率"，逆势卖方会被扣分。

---

## 验证状态

- `python3 baozugong_score.py` → 自测 A/B/C/D 全过（EV、因子、结构、EV floor）。
- `python3 baozugong_backtest.py` → 对照真值：put 侧命中 1.12，整体方向正确。
- API 端到端：单/多标的、token 解锁、本地回测、缓存、调参均已实测通过。
