const headingSizes = {
  display: "text-display",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
};

export function SectionHeading({
  align = "left",
  as: Heading = "h2",
  className = "",
  description,
  eyebrow,
  id,
  size = "h2",
  title,
}) {
  const sizeClassName = headingSizes[size] ?? headingSizes.h2;

  return (
    <div
      className={`section-heading section-heading--${align} ${className}`.trim()}
    >
      {eyebrow ? (
        <p className="section-heading__eyebrow">{eyebrow}</p>
      ) : null}
      <Heading id={id} className={`section-heading__title ${sizeClassName}`}>
        {title}
      </Heading>
      {description ? (
        <p className="section-heading__description">{description}</p>
      ) : null}
    </div>
  );
}
