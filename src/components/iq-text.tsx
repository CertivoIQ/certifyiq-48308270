/**
 * Renders text with every "IQ" highlighted in Merlin's wizard gold.
 * Use anywhere the CertifyIQ wordmark appears in copy or headings.
 */
export function IQText({ children, className = "" }: { children: string; className?: string }) {
  const parts = children.split(/(IQ)/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part === "IQ" ? (
          <span key={i} className="text-gold">
            IQ
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}
