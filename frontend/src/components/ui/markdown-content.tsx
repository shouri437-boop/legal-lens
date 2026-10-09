// ABOUTME: Reusable dark-themed markdown renderer for Command Center content.
// ABOUTME: Wraps react-markdown with remark-gfm and custom component overrides for the Legal Lens palette.

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-semibold text-smoke mb-2 mt-3 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-smoke mb-1.5 mt-2.5 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium text-smoke mb-1 mt-2 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-stone leading-relaxed mb-2 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="text-sm text-stone list-disc list-inside space-y-0.5 mb-2 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm text-stone list-decimal list-inside space-y-0.5 mb-2 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-smoke">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-stone">{children}</em>,
  code: ({ className, children }) => {
    // Fenced code blocks get a className like "language-python"
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className="block p-3 rounded-lg bg-jet/50 border border-stone/10 text-xs font-mono text-stone overflow-x-auto whitespace-pre-wrap">
          {children}
        </code>
      );
    }
    return (
      <code className="px-1 py-0.5 rounded bg-stone/10 text-xs font-mono text-smoke">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <div className="mb-2 last:mb-0">{children}</div>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-stone/30 pl-3 my-2 text-stone/80 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 last:mb-0">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-stone/20">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left py-1.5 px-2 text-stone font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="py-1.5 px-2 text-smoke border-b border-stone/5">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[hsl(var(--cc-accent))] underline underline-offset-2"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="border-stone/15 my-3" />,
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null;

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
