import { NextRequest, NextResponse } from "next/server";
import { getProblemBySlug } from "@/lib/content";
import { readQuotaFromHeaders, rememberQuota, type Quota } from "@/lib/quota";

/**
 * Judge0 CE API — industry-standard code execution engine.
 *
 * Get a FREE API key:
 *   1. Go to https://rapidapi.com/judge0-official/api/judge0-ce
 *   2. Sign up (free, no credit card)
 *   3. Subscribe to the Basic plan (free — 50 requests/day)
 *   4. Copy your X-RapidAPI-Key
 *   5. Set JUDGE0_API_KEY in your .env.local (or Vercel env vars)
 *
 * Or self-host Judge0: https://github.com/judge0/judge0
 *   and set JUDGE0_API_URL to your instance URL.
 *
 * Test cases go up as batch submissions instead of one request each, which is
 * what keeps a 20-test problem from eating 20 of the 50 daily credits. Judge0
 * caps a batch at `max_submission_batch_size`, so a problem with more test
 * cases than that is split across several batches. Judge0 does not support
 * wait=true on batches, so results are then polled until every submission
 * leaves the queue.
 */
const JUDGE0_API_URL =
  process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";
const RAPIDAPI_HOST = "judge0-ce.p.rapidapi.com";

/**
 * C++ language ID in Judge0. 54 = C++ (GCC 9.2.0), available on every Judge0 CE
 * instance. Other options: 76 = C++ (Clang 7.0.1), 105 = C++ (GCC 14.1.0) on
 * newer self-hosted instances. Override with JUDGE0_LANGUAGE_ID.
 */
const CPP_LANGUAGE_ID = Number(process.env.JUDGE0_LANGUAGE_ID) || 54;

/**
 * Compiler flags passed to g++. GCC 9.2 defaults to gnu++14, so we ask for
 * C++17 explicitly. Set JUDGE0_COMPILER_OPTIONS="" to send none.
 */
const COMPILER_OPTIONS =
  process.env.JUDGE0_COMPILER_OPTIONS ?? "-O2 -std=c++17";

/**
 * Judge0 rejects any batch larger than `max_submission_batch_size` with
 * "tests batch should not exceed N". It is 20 on Judge0 CE and on the
 * RapidAPI instance, and it applies to the GET that polls a batch just as
 * much as to the POST that creates one, so both are chunked.
 */
const MAX_BATCH_SIZE = Number(process.env.JUDGE0_MAX_BATCH_SIZE) || 20;

/** Split into groups of at most `size`, keeping order. */
function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

/** Fields we need back from Judge0 when polling a batch. */
const RESULT_FIELDS =
  "token,stdout,stderr,compile_output,message,status,time,memory";

// Judge0 status ids: 1 = In Queue, 2 = Processing, 3 = Accepted, 6 = Compile Error
const STATUS_IN_QUEUE = 1;
const STATUS_PROCESSING = 2;
const STATUS_ACCEPTED = 3;
const STATUS_COMPILE_ERROR = 6;

// Give the batch a moment to compile before the first poll, then poll steadily.
// vercel.json caps the function at 60s, so bail out before that.
const FIRST_POLL_DELAY_MS = 1200;
const POLL_INTERVAL_MS = 700;
const POLL_BUDGET_MS = 45_000;

interface Judge0Submission {
  token?: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (JUDGE0_API_URL.includes("rapidapi.com")) {
    headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
    headers["X-RapidAPI-Host"] = RAPIDAPI_HOST;
  } else if (JUDGE0_API_KEY) {
    headers["X-Auth-Token"] = JUDGE0_API_KEY;
  }

  return headers;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tracks how many upstream requests one judging run costs, so the UI can show
 * the real price of a submission rather than an estimate.
 */
class Judge0Client {
  requestsUsed = 0;
  quota: Quota | null = null;

  private async call(path: string, init?: RequestInit): Promise<Response> {
    this.requestsUsed++;
    const res = await fetch(`${JUDGE0_API_URL}${path}`, {
      ...init,
      headers: getHeaders(),
    });

    const quota = readQuotaFromHeaders(res.headers);
    if (quota) {
      this.quota = quota;
      rememberQuota(quota);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Judge0 API error (${res.status}): ${text}`);
    }

    return res;
  }

  /**
   * Submit every test case, one request per batch of MAX_BATCH_SIZE.
   * Returns the tokens in the same order as `stdins`.
   */
  async createBatch(code: string, stdins: string[]): Promise<string[]> {
    const tokens: string[] = [];

    for (const group of chunk(stdins, MAX_BATCH_SIZE)) {
      const res = await this.call("/submissions/batch?base64_encoded=false", {
        method: "POST",
        body: JSON.stringify({
          submissions: group.map((stdin) => ({
            source_code: code,
            language_id: CPP_LANGUAGE_ID,
            stdin,
            ...(COMPILER_OPTIONS ? { compiler_options: COMPILER_OPTIONS } : {}),
          })),
        }),
      });

      const created = await res.json();
      if (!Array.isArray(created)) {
        throw new Error("Judge0 returned an unexpected batch response");
      }

      const batchTokens = created.map((c) => c?.token).filter(Boolean) as string[];
      if (batchTokens.length !== group.length) {
        // Judge0 reports per-submission validation errors in place of a token.
        const firstError = created.find((c) => c && !c.token);
        throw new Error(
          firstError
            ? `Judge0 rejected a submission: ${JSON.stringify(firstError)}`
            : "Judge0 did not return a token for every test case",
        );
      }

      tokens.push(...batchTokens);
    }

    return tokens;
  }

  /** Fetch one batch of at most MAX_BATCH_SIZE tokens. Costs a single request. */
  async fetchBatch(tokens: string[]): Promise<Judge0Submission[]> {
    const res = await this.call(
      `/submissions/batch?tokens=${tokens.join(",")}` +
        `&base64_encoded=false&fields=${RESULT_FIELDS}`,
    );
    const body = await res.json();
    const submissions = Array.isArray(body) ? body : body?.submissions;
    if (!Array.isArray(submissions)) {
      throw new Error("Judge0 returned an unexpected batch result");
    }
    return submissions;
  }

  /** Poll until every submission has finished, or the time budget runs out. */
  async awaitBatch(tokens: string[]): Promise<Judge0Submission[]> {
    const groups = chunk(tokens, MAX_BATCH_SIZE);
    const results: Judge0Submission[][] = groups.map(() => []);
    const finished: boolean[] = groups.map(() => false);
    const deadline = Date.now() + POLL_BUDGET_MS;

    await sleep(FIRST_POLL_DELAY_MS);

    // The deadline is only checked between passes, so the first pass always
    // fetches every group: `results` is never left ragged, and the flattened
    // array always lines up one-to-one with the test cases.
    for (;;) {
      for (let i = 0; i < groups.length; i++) {
        if (finished[i]) continue; // settled groups cost no further requests
        results[i] = await this.fetchBatch(groups[i]);
        finished[i] = !results[i].some(
          (s) =>
            !s?.status ||
            s.status.id === STATUS_IN_QUEUE ||
            s.status.id === STATUS_PROCESSING,
        );
      }

      if (finished.every(Boolean) || Date.now() >= deadline) break;
      await sleep(POLL_INTERVAL_MS);
    }

    return results.flat();
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!JUDGE0_API_KEY) {
      return NextResponse.json(
        {
          error:
            "JUDGE0_API_KEY is not configured. Get a free key at https://rapidapi.com/judge0-official/api/judge0-ce and set it in your environment variables.",
        },
        { status: 500 },
      );
    }

    const body = await req.json();
    const code: string = body.code;
    const problemSlug: string = body.problemSlug;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "No C++ code provided" },
        { status: 400 },
      );
    }

    if (!problemSlug || typeof problemSlug !== "string") {
      return NextResponse.json(
        { error: "No problem specified" },
        { status: 400 },
      );
    }

    const problem = getProblemBySlug(problemSlug);
    if (!problem) {
      return NextResponse.json(
        { error: `Problem "${problemSlug}" not found` },
        { status: 404 },
      );
    }

    const client = new Judge0Client();
    const tokens = await client.createBatch(
      code,
      problem.testCases.map((tc) => tc.input),
    );
    const submissions = await client.awaitBatch(tokens);

    const results = problem.testCases.map((tc, i) => {
      const expectedOutput = tc.expectedOutput.replace(/\r\n/g, "\n").trim();
      const result = submissions[i];

      if (!result?.status) {
        return {
          id: tc.id,
          name: tc.name,
          passed: false,
          expectedOutput,
          actualOutput: "",
          stderr: "Judge0 returned no result for this test case",
          exitCode: -1,
          time: null,
          memory: null,
        };
      }

      if (result.status.id === STATUS_COMPILE_ERROR) {
        return {
          id: tc.id,
          name: tc.name,
          passed: false,
          expectedOutput,
          actualOutput: "",
          stderr: result.compile_output || "Compilation error",
          exitCode: 1,
          compilationError: true,
          time: result.time,
          memory: result.memory,
        };
      }

      // Still queued or processing when the time budget ran out.
      if (
        result.status.id === STATUS_IN_QUEUE ||
        result.status.id === STATUS_PROCESSING
      ) {
        return {
          id: tc.id,
          name: tc.name,
          passed: false,
          expectedOutput,
          actualOutput: "",
          stderr: "Timed out waiting for Judge0 to finish this test case",
          exitCode: -1,
          time: result.time,
          memory: result.memory,
        };
      }

      const actualOutput = (result.stdout || "").replace(/\r\n/g, "\n").trim();
      const passed =
        result.status.id === STATUS_ACCEPTED && actualOutput === expectedOutput;

      return {
        id: tc.id,
        name: tc.name,
        passed,
        expectedOutput,
        actualOutput,
        stderr:
          result.stderr ||
          result.message ||
          (result.status.id !== STATUS_ACCEPTED
            ? `Runtime: ${result.status.description}`
            : undefined),
        exitCode: result.status.id === STATUS_ACCEPTED ? 0 : result.status.id,
        time: result.time,
        memory: result.memory,
      };
    });

    results.sort((a, b) => a.id - b.id);

    const allCompileErrors = results.every(
      (r) => "compilationError" in r && r.compilationError,
    );

    if (allCompileErrors) {
      return NextResponse.json({
        compiled: false,
        compileError: results[0]?.stderr || "Compilation error",
        results: [],
        quota: client.quota,
        requestsUsed: client.requestsUsed,
      });
    }

    return NextResponse.json({
      compiled: true,
      results,
      quota: client.quota,
      requestsUsed: client.requestsUsed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
