// Renders legacy-text-v1 paragraphs already parsed on the server
// (parseLegacyText: [[{ text, strong }]]). Text is rendered as React text
// nodes only; no HTML from the CMS is ever injected.
export function LegacyText({ paragraphs, className = "" }) {
  if (!paragraphs?.length) {
    return null;
  }

  return (
    <div className={`legacy-text ${className}`.trim()}>
      {paragraphs.map((segments, index) => (
        <p key={index}>
          {segments.map((segment, segmentIndex) =>
            segment.strong ? (
              <strong key={segmentIndex}>{segment.text}</strong>
            ) : (
              <span key={segmentIndex}>{segment.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
