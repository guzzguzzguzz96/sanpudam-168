import { Icon } from "@/components/ui/icons";

const icons = { maps: "mapPin", phone: "phone" };

// LINE-green badge behind a generic chat glyph. The official LINE logo
// asset should replace this glyph once the LINE account is verified.
function LineBadge() {
  return (
    <span aria-hidden="true" className="contact-action__line-badge">
      <Icon name="chat" size={18} />
    </span>
  );
}

// Renders verified actions from getContactActions(). Returns null when
// there are none, unless an emptyMessage is supplied. compact shows each
// action's shortLabel, keeping the full label as the accessible name.
export function ContactActions({
  actions,
  className = "",
  compact = false,
  emptyMessage = null,
  layout = "row",
  tone = "light",
}) {
  if (actions.length === 0) {
    return emptyMessage ? (
      <p className="contact-actions__empty">{emptyMessage}</p>
    ) : null;
  }

  return (
    <ul
      className={`contact-actions contact-actions--${layout} contact-actions--${tone}${compact ? " contact-actions--compact" : ""} ${className}`.trim()}
    >
      {actions.map((action) => (
        <li key={action.id}>
          <a
            className={`contact-action contact-action--${action.id}`}
            href={action.href}
            {...(action.external
              ? { rel: "noopener noreferrer", target: "_blank" }
              : {})}
          >
            {action.id === "line" ? (
              <LineBadge />
            ) : (
              <Icon name={icons[action.id]} size={22} />
            )}
            {compact ? (
              <>
                <span aria-hidden="true">{action.shortLabel}</span>
                <span className="sr-only">{action.label}</span>
              </>
            ) : (
              <span>{action.label}</span>
            )}
            {action.external && !compact ? (
              <Icon
                className="contact-action__external"
                name="external"
                size={16}
              />
            ) : null}
            {action.external ? (
              <span className="sr-only">(เปิดในหน้าต่างใหม่)</span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
