/**
 * Shared shapes for problems and chapters.
 *
 * This module is deliberately free of any Node/filesystem code so that client
 * components can import `slugify` and the types. The loader that actually
 * reads content/ lives in `content.ts`, which is server-only.
 */

export interface TestCase {
  /** Unique test case identifier within the problem */
  id: number;
  /** Display name for the test */
  name: string;
  /** Optional description of the test case */
  description?: string;
  /** Input to feed via stdin */
  input: string;
  /** Expected stdout output */
  expectedOutput: string;
  /** Timeout in ms (default 5000) */
  timeoutMs?: number;
}

export interface Problem {
  /** Display title */
  title: string;
  /** Problem statement (plain text; bare URLs are auto-linked, HTML is allowed) */
  statement: string;
  /** Test cases for judging */
  testCases: TestCase[];
  /** URL slug, derived from the title */
  slug: string;
  /** Slug of the chapter this problem belongs to */
  chapterSlug: string;
}

/** A document that applies to a whole chapter, e.g. the general problem description. */
export interface ChapterLink {
  /** Text shown on the link */
  label: string;
  /** Where it points; a file in public/ is referenced as "/name.pdf" */
  href: string;
}

export interface Chapter {
  /** Display title, from chapter.json */
  title: string;
  /** Optional blurb shown under the chapter heading */
  description?: string;
  /** Optional documents shown as links under the heading */
  links?: ChapterLink[];
  /** URL slug, derived from the folder name (minus its numeric prefix) */
  slug: string;
  /** Problems in file order */
  problems: Problem[];
}

/** Derive a URL-friendly slug from a title or folder name */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
