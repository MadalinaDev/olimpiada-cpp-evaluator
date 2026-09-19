import fs from "node:fs";
import path from "node:path";
import {
  slugify,
  type Chapter,
  type Problem,
  type TestCase,
} from "@/lib/problems";

/**
 * Loads chapters and problems from the `content/` folder.
 *
 * SERVER ONLY — this module touches the filesystem. Client components should
 * import types and `slugify` from `@/lib/problems` instead.
 *
 * Layout:
 *
 *   content/
 *     01-ori-2026/
 *       chapter.json            { "title": "...", "description": "..." }
 *       01-hora-cifrelor.json   { "title", "statement", "testCases": [...] }
 *       02-reducere-binara.json
 *       ...
 *
 * The leading `NN-` on folder and file names controls ordering only; it is
 * stripped from the slug. To add a problem, drop a JSON file into a chapter
 * folder. To add a chapter, make a folder with a chapter.json in it.
 */

const CONTENT_DIR = path.join(process.cwd(), "content");

/** Strip the ordering prefix: "01-hora-cifrelor" -> "hora-cifrelor" */
function stripOrderPrefix(name: string): string {
  return name.replace(/^\d+[-_]?/, "");
}

function fail(file: string, message: string): never {
  throw new Error(`Invalid content in ${file}: ${message}`);
}

function validateTestCase(file: string, tc: unknown, index: number): TestCase {
  const where = `testCases[${index}]`;
  if (typeof tc !== "object" || tc === null) {
    fail(file, `${where} must be an object`);
  }
  const t = tc as Record<string, unknown>;

  if (typeof t.id !== "number") fail(file, `${where}.id must be a number`);
  if (typeof t.name !== "string" || !t.name.trim()) {
    fail(file, `${where}.name must be a non-empty string`);
  }
  if (typeof t.input !== "string") {
    fail(file, `${where}.input must be a string (use "" for no input)`);
  }
  if (typeof t.expectedOutput !== "string") {
    fail(file, `${where}.expectedOutput must be a string`);
  }

  return {
    id: t.id as number,
    name: t.name as string,
    description: typeof t.description === "string" ? t.description : undefined,
    input: t.input as string,
    expectedOutput: t.expectedOutput as string,
    timeoutMs: typeof t.timeoutMs === "number" ? t.timeoutMs : undefined,
  };
}

function readJson(file: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    fail(file, "could not be read");
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(file, `not valid JSON — ${(err as Error).message}`);
  }
}

function loadProblem(file: string, chapterSlug: string): Problem {
  const data = readJson(file) as Record<string, unknown>;

  if (typeof data.title !== "string" || !data.title.trim()) {
    fail(file, "title must be a non-empty string");
  }
  if (typeof data.statement !== "string") {
    fail(file, "statement must be a string");
  }
  if (!Array.isArray(data.testCases) || data.testCases.length === 0) {
    fail(file, "testCases must be a non-empty array");
  }

  const testCases = data.testCases.map((tc, i) => validateTestCase(file, tc, i));

  const duplicateId = testCases
    .map((t) => t.id)
    .find((id, i, all) => all.indexOf(id) !== i);
  if (duplicateId !== undefined) {
    fail(file, `duplicate test case id ${duplicateId}`);
  }

  return {
    title: data.title as string,
    statement: data.statement as string,
    testCases,
    slug: slugify(data.title as string),
    chapterSlug,
  };
}

function loadChapter(dir: string): Chapter {
  const metaFile = path.join(dir, "chapter.json");
  if (!fs.existsSync(metaFile)) {
    fail(metaFile, "every chapter folder needs a chapter.json");
  }

  const meta = readJson(metaFile) as Record<string, unknown>;
  if (typeof meta.title !== "string" || !meta.title.trim()) {
    fail(metaFile, "title must be a non-empty string");
  }

  const folderName = path.basename(dir);
  const chapterSlug = slugify(stripOrderPrefix(folderName));

  const problems = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "chapter.json")
    .sort()
    .map((f) => loadProblem(path.join(dir, f), chapterSlug));

  return {
    title: meta.title as string,
    description:
      typeof meta.description === "string" ? meta.description : undefined,
    slug: chapterSlug,
    problems,
  };
}

function loadChapters(): Chapter[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    throw new Error(
      `No content/ folder found at ${CONTENT_DIR}. It should hold one folder per chapter.`,
    );
  }

  const chapters = fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((name) => loadChapter(path.join(CONTENT_DIR, name)));

  // Slugs become URLs, so a collision would make one problem unreachable and
  // would silently judge submissions against the wrong test cases.
  const seen = new Map<string, string>();
  for (const chapter of chapters) {
    for (const problem of chapter.problems) {
      const previous = seen.get(problem.slug);
      if (previous) {
        throw new Error(
          `Duplicate problem slug "${problem.slug}": "${problem.title}" in ` +
            `${chapter.title} collides with the one in ${previous}. ` +
            `Problem titles must be unique across all chapters.`,
        );
      }
      seen.set(problem.slug, chapter.title);
    }
  }

  return chapters;
}

// Content is static per build, so parse it once in production. In development
// we re-read on every call so editing a JSON file shows up on refresh.
let cached: Chapter[] | null = null;

export function getChapters(): Chapter[] {
  if (process.env.NODE_ENV === "development") return loadChapters();
  if (!cached) cached = loadChapters();
  return cached;
}

export function getAllProblems(): Problem[] {
  return getChapters().flatMap((c) => c.problems);
}

export function getProblemBySlug(slug: string): Problem | undefined {
  return getAllProblems().find((p) => p.slug === slug);
}

export function getChapterBySlug(slug: string): Chapter | undefined {
  return getChapters().find((c) => c.slug === slug);
}

/** The chapter a problem belongs to, for breadcrumbs. */
export function getChapterOfProblem(problemSlug: string): Chapter | undefined {
  return getChapters().find((c) =>
    c.problems.some((p) => p.slug === problemSlug),
  );
}
