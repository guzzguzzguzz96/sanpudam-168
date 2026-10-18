import Link from "next/link";

export function Button({
  children,
  className = "",
  disabled = false,
  href,
  type = "button",
  variant = "primary",
  ...props
}) {
  const buttonClassName = `ui-button ui-button--${variant} ${className}`.trim();

  if (href && !disabled) {
    return (
      <Link href={href} className={buttonClassName} prefetch={false} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={buttonClassName}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
