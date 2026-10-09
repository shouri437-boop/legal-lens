// ABOUTME: Legal Lens landing page: what it is, how it works, and a link into the app.
// ABOUTME: Single static page using the muted design tokens.

import Link from "next/link";
import {
  Clock,
  MapPin,
  MessageSquare,
  Network,
  Scale,
  SearchCheck,
} from "lucide-react";

import { ThemedLogo } from "@/components/app/themed-logo";

const steps = [
  {
    title: "Upload the case",
    body: "Add police reports, statements, contracts and statements of account to a case.",
  },
  {
    title: "Legal Lens reads the evidence",
    body: "Every document is processed and indexed, keeping its page and passage so nothing loses its source.",
  },
  {
    title: "Review and question",
    body: "See supporting evidence, contradictions and missing information, then ask questions in plain language.",
  },
  {
    title: "Verify every answer",
    body: "Each claim links to the exact passage it came from, so you can check it against the original.",
  },
];

const views = [
  {
    icon: Scale,
    title: "Case review",
    body: "Supporting evidence, contradictions and gaps, side by side.",
  },
  {
    icon: MessageSquare,
    title: "Grounded chat",
    body: "Answers built only from retrieved evidence, with citations.",
  },
  {
    icon: Clock,
    title: "Timeline",
    body: "When things happened, in order.",
  },
  {
    icon: MapPin,
    title: "Map",
    body: "Where things happened, from locations found in the evidence.",
  },
  {
    icon: Network,
    title: "Knowledge graph",
    body: "Who and what is connected, and how.",
  },
  {
    icon: SearchCheck,
    title: "Source panel",
    body: "Open the original page behind any claim.",
  },
];

export default function Home() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
    >
      <header
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="flex items-center gap-2.5 font-serif text-xl">
          <ThemedLogo width={28} height={28} />
          Legal Lens
        </span>
        <Link
          href="/cases"
          className="rounded-md px-4 py-2 text-sm transition-opacity hover:opacity-85"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          Open cases
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-24">
          <p
            className="mb-4 text-xs uppercase tracking-widest"
            style={{ color: "var(--muted-foreground)" }}
          >
            Legal evidence intelligence
          </p>
          <h1 className="max-w-3xl font-serif text-5xl leading-tight">
            Evidence first. AI second.
          </h1>
          <p
            className="mt-6 max-w-2xl text-lg leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            Upload a case and Legal Lens finds what happened, where the accounts
            conflict and what is still missing. Every answer points back to the
            page it came from. When the evidence does not say, Legal Lens says so.
          </p>
          <Link
            href="/cases"
            className="mt-10 inline-block rounded-md px-6 py-3 text-sm transition-opacity hover:opacity-85"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            Start an investigation
          </Link>
        </section>

        <section
          className="py-16"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <h2 className="mb-10 font-serif text-3xl">How it works</h2>
          <ol className="grid gap-8 sm:grid-cols-2">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span
                  className="font-serif text-2xl"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-medium">{step.title}</h3>
                  <p
                    className="mt-1 text-sm leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="py-16"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <h2 className="mb-10 font-serif text-3xl">One case, several views</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {views.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-lg p-5"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon
                  className="mb-3 h-5 w-5"
                  style={{ color: "var(--primary)" }}
                />
                <h3 className="font-medium">{title}</h3>
                <p
                  className="mt-1 text-sm leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer
        className="mx-auto max-w-5xl px-6 py-8 text-sm"
        style={{
          borderTop: "1px solid var(--border)",
          color: "var(--muted-foreground)",
        }}
      >
        Legal Lens · HackNex 2026 · Agentic Legal Assistant
      </footer>
    </div>
  );
}
