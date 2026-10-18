export function Container({
  as: Element = "div",
  children,
  className = "",
  ...props
}) {
  return (
    <Element className={`site-container ${className}`.trim()} {...props}>
      {children}
    </Element>
  );
}
