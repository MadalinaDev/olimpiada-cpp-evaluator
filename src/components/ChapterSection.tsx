"use client";

import Link from "next/link";
import { useProgress, countSolved, type ProblemProgress } from "@/lib/progress";
import type { ChapterLink } from "@/lib/problems";

export interface ProblemRow {
  slug: string;
  title: string;
  testCount: number;
}

/**
 * One chapter: heading, progress count, and its problem table.
 *
 * A client component because solved state lives in localStorage. The page
 * behind AuthGate is not visible until after hydration anyway, so rows never
 * flash from unsolved to solved.
 */
export default function ChapterSection({
  index,
  title,
  description,
  links,
  problems,
}: {
  index: number;
  title: string;
  description?: string;
  links?: ChapterLink[];
  problems: ProblemRow[];
}) {
  const progress = useProgress();
  const solvedCount = countSolved(
    progress,
    problems.map((p) => p.slug),
  );
  const allSolved = solvedCount === problems.length && problems.length > 0;

  return (
    <section>
      {/* Chapter heading */}
      <div className="mb-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-xs font-mono text-gray-600 uppercase tracking-wider">
            Capitolul {index}
          </span>
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              allSolved
                ? "text-green-200 border-green-700 bg-green-900/30"
                : solvedCount > 0
                  ? "text-blue-200 border-blue-800 bg-blue-900/25"
                  : "text-gray-500 border-gray-800"
            }`}
          >
            {solvedCount}/{problems.length} rezolvate
          </span>
        </div>
        {description && (
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        )}
        {links && links.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 underline"
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Problem table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900/80 text-left text-sm text-gray-400 uppercase tracking-wider">
              <th className="px-6 py-3 w-12">#</th>
              <th className="px-6 py-3">Problemă</th>
              <th className="px-6 py-3 w-32 text-center">Stare</th>
              <th className="px-6 py-3 w-20 text-center">Teste</th>
              <th className="px-6 py-3 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {problems.map((problem, idx) => (
              <ProblemTableRow
                key={problem.slug}
                index={idx + 1}
                problem={problem}
                record={progress[problem.slug]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProblemTableRow({
  index,
  problem,
  record,
}: {
  index: number;
  problem: ProblemRow;
  record?: ProblemProgress;
}) {
  const solved = record?.solved ?? false;
  const attempted = !solved && (record?.attempts ?? 0) > 0;

  return (
    <tr
      className={`transition-colors ${
        solved
          ? "bg-green-900/20 hover:bg-green-900/30"
          : attempted
            ? "bg-yellow-900/10 hover:bg-yellow-900/20"
            : "hover:bg-gray-800/50"
      }`}
    >
      <td className="px-6 py-4 font-mono text-sm">
        {solved ? (
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold"
            aria-label="Rezolvată"
          >
            ✓
          </span>
        ) : (
          <span className="text-gray-500">{index}</span>
        )}
      </td>

      <td className="px-6 py-4">
        <Link
          href={`/problem/${problem.slug}`}
          className={`font-medium transition-colors ${
            solved
              ? "text-green-300 hover:text-green-200"
              : "text-blue-400 hover:text-blue-300"
          }`}
        >
          {problem.title}
        </Link>
      </td>

      <td className="px-6 py-4 text-center">
        {solved ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-800/60 text-green-200">
            Rezolvată
          </span>
        ) : attempted ? (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded bg-yellow-800/50 text-yellow-200 tabular-nums"
            title={`Cel mai bun rezultat: ${record!.bestPassed} din ${record!.total} teste, din ${record!.attempts} ${record!.attempts === 1 ? "încercare" : "încercări"}`}
          >
            {record!.bestPassed}/{record!.total}
          </span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </td>

      <td className="px-6 py-4 text-center text-gray-400 text-sm">
        {problem.testCount}
      </td>

      <td className="px-6 py-4 text-right">
        <Link
          href={`/problem/${problem.slug}`}
          className={`inline-flex items-center gap-1 text-sm px-4 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
            solved
              ? "bg-gray-800 hover:bg-gray-700 text-gray-200"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          <span>{solved ? "Revezi" : "Rezolvă"}</span>
          <span>→</span>
        </Link>
      </td>
    </tr>
  );
}
