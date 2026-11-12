# 股票智能分析工作台

`/tools/stock-workbench` —— 对应 [daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) 的 Web 工作台，
但完全跑在 Cloudflare 上：页面只请求同源 `/api/em/*`，由 Pages Function 代理东方财富；
定时分析由独立 Worker 的 Cron Trigger 完成。

> **它不是 LLM 驱动的。** 原项目用大模型生成分析报告；这里是一个确定性的技术指标规则引擎
> （MA / RSI / MACD / KDJ / BOLL / ATR / 量比 / 区间位置），所有输入都是真实 K 线，
> 每条结论都能在「信号明细」里指回具体指标。页面、页脚、推送文案里都如实标注了这一点。

## 三个 Tab

| Tab | 内容 |
|---|---|
| 决策仪表盘 | 大盘指数与涨跌家数、自选股列表、个股分析卡片（评分环 / 评级 / 趋势 / 走势图 / 催化与风险 / 参考点位 / 操作清单 / 指标明细 / 信号明细） |
| 大盘复盘 | 主要指数、全市场涨跌分布、领涨与领跌板块 |
| 策略问股 | 10 个内置策略的确定性筛选 + 关键词问答（大盘 / 排名 / 风险 / 单只个股） |

自选股保存在浏览器 `localStorage`（键 `fan:stock-workbench:watchlist`），不上传。
支持 `600519`、`sh600519`、`sz000001`、`hk00700`、`00700`、`AAPL`、`usAAPL`。

## 本地开发

```bash
pnpm dev        # 打开 http://localhost:5173/tools/stock-workbench
```

`vite.config.ts` 里为 `/api/em/*` 配了开发代理，直接转发到东方财富，
所以 `pnpm dev` 单进程就能跑通，不需要同时起 wrangler。
注意开发环境不走 Pages Function，CORS 头和缓存行为与生产略有差异。

## 部署

站点继续用 Cloudflare Pages，无需迁移。分两块：

### 1. 行情代理（Pages Function）

`functions/api/em/[[path]].ts` 已经在仓库里，随 Pages 部署自动生效，**无需额外配置**。
它负责：服务端取数、附加 `Access-Control-Allow-Origin`、按接口写 15~60 秒 Cache API 缓存、
对上游 5xx 和网络错误做 4 次有限重试。

可用接口：

| 路径 | 说明 |
|---|---|
| `/api/em/indices` | 主要指数 |
| `/api/em/quotes?codes=1.600519,116.00700` | 个股实时行情 |
| `/api/em/kline?code=1.600519&limit=120` | 日 K 线 |
| `/api/em/sectors?dir=up&size=8` | 行业板块涨跌（`dir=down` 看领跌） |
| `/api/em/breadth` | 全市场涨跌家数 |

### 2. 定时分析（独立 Worker）

Pages Functions 不支持 Cron Trigger，所以单独一个 Worker：

```bash
pnpm add -D wrangler @cloudflare/workers-types
pnpm wrangler kv namespace create STOCK_KV      # 把 id 填进 wrangler.cron.toml
pnpm wrangler secret put STOCK_LIST             # 例：600519,300750,hk00700,AAPL
pnpm wrangler secret put WECHAT_WEBHOOK_URL     # 通知渠道，至少配一个
pnpm wrangler deploy -c wrangler.cron.toml
```

可选的推送渠道：`WECHAT_WEBHOOK_URL`、`FEISHU_WEBHOOK_URL`、`DISCORD_WEBHOOK_URL`、
`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`、`SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID`。

默认每个工作日 10:00 UTC（北京时间 18:00）触发。cron 只按周一到周五跑，
**不识别 A 股节假日**；Worker 内部会查当日涨跌分布，为空则判定非交易日并跳过，
在 KV 里留一条 `skip:<date>` 记录。

部署后访问 `https://<worker>.workers.dev/run-now` 可手动触发一次验证。

## 数据源

多源 + 自动降级，逻辑在 `shared/marketSources.ts`（Pages Function 与 Cron Worker 共用同一份）：

| 数据 | 顺序 | 说明 |
|---|---|---|
| 个股行情 | 腾讯 → 雅虎 → 东财 | 腾讯字段最丰富：52 周高低、量比、换手率、市净率直接给 |
| 日 K 线 | 雅虎 → 腾讯 → 东财 | 雅虎全市场都稳；腾讯的美股历史只能拿到 1~2 条，等于不可用 |
| 指数 | 腾讯 → 雅虎 → 东财 | 腾讯简版指数一个请求拿全部 |
| 行业板块 | 仅东财 | 没找到可靠替代，前端已做降级展示 |
| 涨跌家数 | 仅东财 | 同上 |

每个响应都带 `X-Source` 头，在浏览器 Network 面板里能直接看到实际走了哪个源，排查很方便。

### 为什么搞这么复杂

单源都不可靠。同一时间各打 10 次的实测结果：

| 源 | 结果 |
|---|---|
| 雅虎 K 线（AAPL / 600519 / 0700.HK） | **30/30** |
| 腾讯 K 线（A 股） | **10/10** |
| 腾讯行情 | **10/10** |
| 东财行情 | **0/10** |
| 东财板块 | **0/6** |

东方财富的接口会返回 `socket hang up` 或连接被重置，属于上游限流。所以在每一层都做了
4 次有限重试（退避 400/800/1600ms），再加上 Cache API 兜底；三层都没结果时前端显示
「数据源不可用」并保留已有内容，点刷新重试。

### 四个踩过的坑

1. **`fs=m:90+t:2` 必须写成 `fs=m%3A90%2Bt%3A2`。** Node 的 HTTP 客户端转发时会把裸 `+`
   当成空格，上游直接断开连接。
2. **`secids` 的逗号不能二次编码。** `URLSearchParams.get()` 已经解码过一次，
   再 `encodeURIComponent()` 会把逗号变成 `%2C`，上游同样不认。
3. **腾讯行情返回 GBK 编码。** 用 `TextDecoder('gbk')` 解，并做两层校验：不支持该编码会抛错，
   解错了会出现 `U+FFFD`——两种都判定失败并降级到下一个源。
4. **Vite 中间件不能用 `middlewares.use('/api/em', ...)`。** Connect 会把挂载前缀从 `req.url`
   里剥掉，里面拿到的是 `/indices` 而不是 `/api/em/indices`，路由匹配全落空。
   要挂在根上自己判断 `pathname`。

另外注意：**换数据源后指标数值会和以前略有差异**（雅虎和东财的复权、收盘价口径不完全一致），
这是正常的，不影响评分体系的相对判断。

## 策略问股接大模型（可选）

问股页有两种模式：**规则引擎**（默认，确定性指标计算）和 **AI 大模型**。
AI 模式的密钥**只能配在服务端**——任何 `VITE_` 前缀的变量都会被打进浏览器包，
打开 DevTools 就能看到，所以前端只跟同源 `/api/em/chat` 对话，密钥由 Pages Function 持有。

### 配置位置

**Cloudflare Dashboard → Workers & Pages → 你的 Pages 项目 → Settings → Environment variables**

Production 和 Preview 两份都要加（只想在生产用就只加 Production）：

| 变量名 | 必填 | 类型 | 说明 |
|---|---|---|---|
| `LLM_API_KEY` | 是 | **Secret（加密）** | 模型服务商的 API Key |
| `LLM_API_BASE` | 否 | 明文 | 默认 `https://api.openai.com/v1`，任何 OpenAI 兼容端点都行 |
| `LLM_MODEL` | 否 | 明文 | 默认 `gpt-4o-mini` |

改完环境变量后**需要重新部署一次项目**才生效（和 `RESEND_API_KEY` 一样）。

命令行等价写法：

```bash
pnpm wrangler pages secret put LLM_API_KEY --project-name <你的项目名>
```

### 选哪个服务商

任何 OpenAI 兼容接口都可以，把 `LLM_API_BASE` 指过去即可：

| 服务商 | LLM_API_BASE |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 硅基流动 | `https://api.siliconflow.cn/v1` |
| Ollama 本地 | `http://localhost:11434/v1`（仅本地开发可用，Pages 上访问不到你本机） |

选便宜的中文模型就行，这个场景只是解读已经算好的指标，不需要旗舰模型。

### 本地开发

在项目根目录建 `.env.local`（已被 `.gitignore` 忽略，**不要提交**）：

```
LLM_API_KEY=sk-xxx
LLM_API_BASE=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
```

`vite.config.ts` 里有一个开发专用中间件会读这三个变量、在服务端注入密钥后转发，
前端依旧只打同源 `/api/em/chat`。不配就是「未配置」，规则引擎照常可用。

### 安全说明

- 密钥只存在于 Pages Function 的环境变量里，接口**绝不回传密钥**
- `GET /api/em/chat` 只返回 `{ configured, model }`，供前端判断该不该显示 AI 模式
- 内置了一个**每分钟 30 次**的隔离内限流。这只是减速带，**不是真正的防护**——
  任何人都能调这个接口烧你的额度。要防滥用请上 Cloudflare Turnstile 或 Access
- 上游返回的错误只透传状态码和一句中文提示，不透传响应体，避免漏内部细节

### 免责声明

页面仅供学习研究与技术演示。所有评分、点位、信号均为技术指标计算结果，
不构成任何投资建议。股市有风险，投资需谨慎。
