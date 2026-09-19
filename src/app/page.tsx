import { getChapters } from "@/lib/content";
import QuotaBadge from "@/components/QuotaBadge";
import ChapterSection from "@/components/ChapterSection";
import ProgressSummary from "@/components/ProgressSummary";

export default function Home() {
  const chapters = getChapters();
  const allSlugs = chapters.flatMap((c) => c.problems.map((p) => p.slug));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs">
              C++
            </div>
            <h1 className="text-xl font-bold text-white">C++ Judge</h1>
          </div>
          <div className="flex items-center gap-4">
            <ProgressSummary slugs={allSlugs} />
            <QuotaBadge />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Probleme</h2>
          <p className="text-gray-400">
            Alege o problemă, scrie soluția în C++, și testează-o automat.
          </p>
        </div>

        {chapters.length === 0 && (
          <div className="rounded-xl border border-gray-800 p-8 text-center text-gray-500">
            Niciun capitol încă. Adaugă un folder în{" "}
            <code className="text-gray-300">content/</code> cu un{" "}
            <code className="text-gray-300">chapter.json</code> în el.
          </div>
        )}

        <div className="space-y-10">
          {chapters.map((chapter, chapterIdx) => (
            <ChapterSection
              key={chapter.slug}
              index={chapterIdx + 1}
              title={chapter.title}
              description={chapter.description}
              links={chapter.links}
              problems={chapter.problems.map((p) => ({
                slug: p.slug,
                title: p.title,
                testCount: p.testCases.length,
              }))}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
