export function Section({
  as: Element = "section",
  children,
  className = "",
  ...props
}) {
  return (
    <Element className={`site-section ${className}`.trim()} {...props}>
      {children}
    </Element>
  );
}
