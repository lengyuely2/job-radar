# Job Radar

A local-first job-search workbench with a Chinese interface. Search US job listings using natural language, verify employer application links, evaluate relevance with a locally running model, and export results to Excel.

This public repository contains application code only. It does **not** include the author's API keys, personal profile, searches, resumes, or application history.

## Features

- Convert a Chinese job request into a focused English search using Ollama.
- Retrieve listings through the OpenWeb Ninja JSearch API, with location, date, experience, and employment-type filters.
- Check public employer/ATS pages against company, job title, and location. Keep ambiguous or inaccessible links marked as unverified.
- Separate source-provided publication dates, retrieval dates, and employer-posting dates.
- Compare job descriptions with a user-supplied profile using local AI and require quoted evidence for accepted model suggestions.
- Track applied jobs locally, hide selected categories, and export visible results to a real `.xlsx` file with hyperlinks and filters.
- Bind the server to `127.0.0.1`; reject unexpected Host headers and protect mutation endpoints with a per-process token.

## Quick start

Requirements:

- Node.js **22.13 or newer**.
- [Ollama](https://ollama.com/) running locally with a suitable model. The default is `qwen3:8b`.
- Your own [OpenWeb Ninja JSearch](https://www.openwebninja.com/api/jsearch) access and API key. Provider availability, plans, limits, and charges are determined by the provider.

```sh
git clone https://github.com/lengyuely2/job-radar.git
cd job-radar
npm install
ollama pull qwen3:8b
npm start
```

If Ollama is not already running, start it with `ollama serve` in a separate terminal. Open **http://127.0.0.1:4318**, choose **连接设置**, and enter your API key, local model name, and your own background. The default profile is intentionally empty.

For a reproducible dependency installation, use the included pnpm lockfile:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Windows users can run `start.cmd` after installing Node.js and dependencies. The launcher opens the local page and runs the server; it does not install services or purchase API access.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `JOB_RADAR_PORT` | `4318` | Local HTTP port. The server still binds to loopback only. |
| `JOB_RADAR_DATA_DIR` | `./local-data` | Directory for private local state. Never commit this directory. |

The API key and background are entered in the browser settings, not hardcoded in source. They are stored in the private state file described below.

## Privacy and limitations

- `local-data/state.json` contains the API key in **plaintext**, the user profile, recent search results, and application records. Keep the folder private and make your own secure backups. This is not a password vault.
- The API key goes to the job-data provider. Search queries, locations, and filters also go to that provider.
- Profile and job-description text are sent to the configured **local** Ollama endpoint at `127.0.0.1:11434`.
- Link verification makes requests to public search/ATS/employer endpoints. It does not bypass login, CAPTCHA, or paywalls.
- The source aggregates listings; it is not a complete live database of LinkedIn, Indeed, or Handshake. Logged-in Handshake data is not connected.
- Search and employer-posting dates may differ. A reachable link does not guarantee a vacancy remains open or accepts a particular applicant.
- Relevance scores and visa/defense keyword flags are advisory, not eligibility decisions, legal advice, or hiring probabilities.
- The local monthly counter is a protective limit on attempted search pages, not a statement of remaining provider credits. Requests may consume provider credits even when an error occurs. Never rely on this counter for billing.
- The app does not submit applications, send messages, create accounts, or pay for subscriptions.
- This is a **single-user local tool**, not a production multi-user service. Do not expose it through public tunnels or deploy it with your API key. GitHub Pages cannot run the Node/Ollama backend.

## Development

```sh
npm run check
npm test
```

Tests use synthetic records, mocked employer pages, and a separate temporary local server. They do not call the paid search API or require Ollama. Excel exports use [ExcelJS](https://github.com/exceljs/exceljs), so the public build has no dependency on Codex runtime libraries.

```text
local-server.mjs          Local API, search, persistence, and export routes
official-links.mjs        Public-link safety checks and ATS/employer matching
public/                   Browser interface
xlsx-export/              Portable Excel export
official-links.test.mjs   Link matching and safety tests
tests/                    Export and local-server tests
```

## 中文说明

这是在本机运行的美国岗位搜索工具。先安装 Node.js 和 Ollama，再安装依赖、下载本地模型，执行 `npm start`。在“连接设置”填写自己的 JSearch 密钥和求职背景；不要分享或提交 `local-data`。公开的是源码，不是带个人数据的在线服务。

源码公开不代表招聘信息完整、岗位有效性已获保证，或已授予开源许可；本仓库暂未选择开源许可证。
