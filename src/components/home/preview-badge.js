export function PreviewBadge({ children, className = "" }) {
  return (
    <span className={`home-preview-badge ${className}`.trim()}>
      {children}
    </span>
  );
}
