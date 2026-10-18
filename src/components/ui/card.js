export function Card({
  as: Element = "div",
  children,
  className = "",
  ...props
}) {
  return (
    <Element className={`ui-card ${className}`.trim()} {...props}>
      {children}
    </Element>
  );
}
