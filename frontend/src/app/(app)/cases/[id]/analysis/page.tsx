// ABOUTME: Analysis page: fast cited analysis of the case PDFs plus a grounded Ask box.
// ABOUTME: Every citation opens the source PDF at the cited page, with the quote highlighted.

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Loader2, RefreshCw, Send } from "lucide-react";

import {
  askQuestion,
  getCachedAnalysis,
  ragErrorMessage,
  runAnalysis,
  type RagAnswer,
  type RagCitation,
  type RagResult,
} from "@/lib/api/rag";
import { getDownloadUrl } from "@/lib/api/files";
import {
  SourceViewerModal,
  type SourceViewerContent,
} from "@/components/source-viewer/SourceViewerModal";

const card: React.CSSProperties = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
};
const muted: React.CSSProperties = { color: "var(--muted-foreground)" };

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg p-5" style={card}>
      <h2 className="mb-3 flex items-center gap-2 font-serif text-lg">
        {title}
        {count !== undefined && (
          <span className="text-xs" style={muted}>
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Citations({
  citations,
  onOpen,
}: {
  citations: RagCitation[];
  onOpen: (c: RagCitation) => void;
}) {
  if (citations.length === 0) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {citations.map((c, i) => (
        <button
          key={i}
          onClick={() => onOpen(c)}
          title={c.quote}
          className="rounded px-1.5 py-0.5 text-xs transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--primary)",
            border: "1px solid var(--border)",
          }}
        >
          p.{c.page}
        </button>
      ))}
    </span>
  );
}

export default function AnalysisPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [result, setResult] = useState<RagResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [source, setSource] = useState<SourceViewerContent | null>(null);

  const generate = useCallback(
    async (refresh: boolean) => {
      setLoading(true);
      setError(null);
      try {
        setResult(await runAnalysis(caseId, refresh));
      } catch (err) {
        setError(ragErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [caseId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await getCachedAnalysis(caseId);
        if (cancelled) return;
        if (cached) {
          setResult(cached);
          setLoading(false);
        } else {
          await generate(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(ragErrorMessage(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, generate]);

  const openSource = useCallback(
    async (c: RagCitation) => {
      try {
        const { download_url } = await getDownloadUrl(caseId, c.file_id, true);
        setSource({
          type: "pdf",
          url: download_url,
          fileName: c.file_name,
          page: c.page,
          highlightText: c.quote,
        });
      } catch (err) {
        setError(ragErrorMessage(err));
      }
    },
    [caseId],
  );

  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setError(null);
    try {
      setAnswer(await askQuestion(caseId, q));
    } catch (err) {
      setError(ragErrorMessage(err));
    } finally {
      setAsking(false);
    }
  }, [caseId, question, asking]);

  const a = result?.analysis;
  const meta = result?.meta;

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={muted}>
          {meta
            ? `${meta.pages_total} pages indexed · ${meta.citations_verified}/${meta.citations_total} citations verified · ${(meta.latency_ms.total / 1000).toFixed(1)}s`
            : "Retrieval-grounded analysis of the uploaded PDFs"}
        </p>
        <button
          onClick={() => generate(true)}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
          style={{ ...card, color: "var(--foreground)", opacity: loading ? 0.6 : 1 }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Re-analyze
        </button>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--destructive) 12%, var(--card))",
            border: "1px solid var(--border)",
          }}
        >
          {error}
        </div>
      )}

      {/* Ask */}
      <div className="rounded-lg p-4" style={card}>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask a question about the documents…"
            className="flex-1 rounded-md bg-transparent px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)" }}
          />
          <button
            onClick={handleAsk}
            disabled={asking || !question.trim()}
            className="flex items-center gap-2 rounded-md px-4 py-2 text-sm"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
              opacity: asking || !question.trim() ? 0.6 : 1,
            }}
          >
            {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Ask
          </button>
        </div>
        {answer && (
          <div className="mt-4 text-sm leading-relaxed">
            <p>
              {answer.answer}
              <Citations citations={answer.citations} onOpen={openSource} />
            </p>
            <p className="mt-1 text-xs" style={muted}>
              {(answer.meta.latency_ms.total / 1000).toFixed(1)}s
              {!answer.answerable && " · not answerable from the documents"}
            </p>
          </div>
        )}
      </div>

      {loading && !a && (
        <div className="flex items-center gap-3 rounded-lg px-6 py-12 text-sm" style={{ ...card, ...muted }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading and analysing the documents…
        </div>
      )}

      {a && (
        <>
          <Section title="Summary">
            <p className="text-sm leading-relaxed">{a.summary}</p>
            {a.parties.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {a.parties.map((p, i) => (
                  <li
                    key={i}
                    className="rounded-full px-3 py-1 text-xs"
                    style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}
                  >
                    {p.name} <span style={muted}>· {p.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Outcome">
            <p className="text-sm leading-relaxed">
              {a.outcome.text}
              <Citations citations={a.outcome.citations} onOpen={openSource} />
            </p>
          </Section>

          <Section title="Key facts" count={a.key_facts.length}>
            <ul className="space-y-3 text-sm leading-relaxed">
              {a.key_facts.map((f, i) => (
                <li key={i}>
                  {f.text}
                  <Citations citations={f.citations} onOpen={openSource} />
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Timeline" count={a.timeline.length}>
            <ol className="space-y-3 text-sm leading-relaxed">
              {a.timeline.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-28 shrink-0 text-xs" style={muted}>
                    {e.date}
                  </span>
                  <span>
                    {e.event}
                    <Citations citations={e.citations} onOpen={openSource} />
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Legal issues" count={a.legal_issues.length}>
            <ul className="space-y-4 text-sm leading-relaxed">
              {a.legal_issues.map((x, i) => (
                <li key={i}>
                  <p className="font-medium">{x.issue}</p>
                  <p>
                    {x.analysis}
                    <Citations citations={x.citations} onOpen={openSource} />
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Contradictions" count={a.contradictions.length}>
            {a.contradictions.length === 0 ? (
              <p className="text-sm" style={muted}>None found in the retrieved passages.</p>
            ) : (
              <ul className="space-y-3 text-sm leading-relaxed">
                {a.contradictions.map((c, i) => (
                  <li key={i}>
                    {c.text}
                    <Citations citations={c.citations} onOpen={openSource} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Missing information" count={a.gaps.length}>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
              {a.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {source &&
        createPortal(
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(30,33,35,0.6)" }}
          >
            <div className="h-[85vh] w-full max-w-5xl">
              <SourceViewerModal content={source} onClose={() => setSource(null)} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
