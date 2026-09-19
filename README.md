# C++ Code Judge

A minimalist Next.js app that lets you write C++ code, compile & run it against predefined test cases, and see pass/fail results. Deployable on **Vercel**.

## Prerequisites

- **Node.js** >= 18
- **Judge0 API key** (free — see below)

No local C++ compiler needed — the app uses [Judge0 CE](https://judge0.com/) via RapidAPI to compile and run C++ code remotely with GCC.

## Get Your Free API Key (2 minutes)

1. Go to [https://rapidapi.com/judge0-official/api/judge0-ce](https://rapidapi.com/judge0-official/api/judge0-ce)
2. Click **Sign Up** (free, no credit card)
3. Subscribe to the **Basic** plan (free — 50 requests/day)
4. Copy your **X-RapidAPI-Key** from any endpoint page
5. Create `.env.local` in the project root:
   ```
   JUDGE0_API_KEY=paste_your_key_here
   ```

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo
3. In **Environment Variables**, add:
   - `JUDGE0_API_KEY` = your RapidAPI key
4. Click **Deploy**

### Optional: Self-hosted Judge0

For higher limits or full control, self-host Judge0 with Docker:

- https://github.com/judge0/judge0

Then set these env vars:

```
JUDGE0_API_URL=https://your-judge0-instance.com
JUDGE0_API_KEY=your_auth_token
```

## Choosing the Compiler

By default submissions are compiled with **GCC 9.2.0** (`language_id` 54) using `-O2 -std=c++17`. Both are configurable:

```
# 54 = C++ (GCC 9.2.0), 76 = C++ (Clang 7.0.1)
# 105 = C++ (GCC 14.1.0) — newer self-hosted Judge0 instances only
JUDGE0_LANGUAGE_ID=54

JUDGE0_COMPILER_OPTIONS=-O2 -std=c++17
```

Run `GET {JUDGE0_API_URL}/languages` to see exactly which compilers your instance offers.

## How It Works

1. Write C++ code in the editor
2. Click **Submit Solution**
3. The server sends every test case to Judge0 as a **single batch submission**, which compiles the code with g++ and runs it against each test case's stdin
4. It polls until the batch finishes, then compares actual stdout to the expected output
5. Results (pass/fail) are displayed on screen

## Daily Credits

The free RapidAPI plan allows **50 requests per day**, and that budget is what
the batch API exists to protect.

Submitting a 20-test problem costs about **3 requests** — one to create the
batch, plus a couple of polls while it runs — instead of the 20 it would cost
with one submission per test. That takes the free tier from roughly 2
submissions a day to around 15.

The header shows the credits left, so you can see the budget before it runs
out:

| Badge | Meaning |
|---|---|
| `47/50 credite azi` (green) | plenty left |
| `8/50 credite azi` (yellow) | under 20% remaining |
| `2/50 credite azi` (red) | not enough for another submission |

RapidAPI only reports the remaining quota in the headers of a metered request,
so the count appears after the first submission of a session and refreshes on
every submission after that. `GET /api/quota` replays the last reading without
spending a credit. Self-hosted Judge0 sends no such headers and is not
metered, so the badge stays at *Credite: necunoscut* there.

## Progress Tracking

Every submission is recorded per problem, and the home page marks solved rows
green with a check, shows a best-score badge on problems that were attempted
but not finished, and counts progress per chapter and overall.

Progress is kept in **localStorage** under `cppjudge:progress:v1`:

```json
{
  "bancherul": {
    "solved": true, "bestPassed": 20, "total": 20,
    "attempts": 3, "lastAttemptAt": 1788559239520, "solvedAt": 1788559239520
  }
}
```

localStorage rather than cookies, because the server never reads this data. A
cookie would be sent on every request, cap out around 4KB, and force the
statically prerendered home page to render per-request instead.

Consequences worth knowing:

- Progress is **per browser, per device.** It does not follow a student to
  another machine, and clearing site data erases it. There are no accounts, so
  there is nowhere else to put it without a database.
- `solved` **latches.** Once every test has passed, a later worse submission
  does not un-solve the problem, and the best score never goes down.
- The **Resetează** control in the header clears it, for handing the laptop to
  the next student.
- If localStorage is unavailable (some private-browsing modes), the app still
  judges normally — it just cannot remember anything.

## Adding Problems & Chapters

Problems live as JSON files under `content/`, grouped into chapters — no code
changes needed to add one:

```
content/
  01-ori-2026/
    chapter.json              { "title": "ORI 2026", "description": "..." }
    01-hora-cifrelor.json     { "title", "statement", "testCases": [...] }
    02-reducere-binara.json
    03-mostenirea-lui-amenka.json
```

The `NN-` prefix orders things and is stripped from the URL, so
`01-hora-cifrelor.json` is served at `/problem/hora-cifrelor`. Add a chapter by
making a folder with a `chapter.json`; add a problem by dropping a `.json` file
into one.

See **[content/README.md](content/README.md)** for the full field reference,
the gotchas, and a copy-paste template.
