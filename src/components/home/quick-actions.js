import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icons";

// Internal pages use next/link (client-side navigation, no full reload);
// in-page anchors and external links stay plain anchors.
const isInternalPage = (href) => typeof href === "string" && href.startsWith("/") && !href.startsWith("//");

export function QuickActions({ data }) {
  if (data.length === 0) {
    return null;
  }

  return (
    <nav aria-labelledby="quick-actions-title" className="home-quick-actions">
      <Container>
        <h2 id="quick-actions-title" className="home-quick-actions__title">
          ทางลัด
        </h2>
        <ul className="home-quick-actions__list">
          {data.map((action) => {
            const content = (
              <>
                <span className="home-quick-actions__icon">
                  <Icon name={action.icon} />
                </span>
                <span>{action.label}</span>
                {action.external ? (
                  <span className="sr-only">(เปิดในหน้าต่างใหม่)</span>
                ) : null}
              </>
            );

            return (
              <li key={action.id}>
                {!action.external && isInternalPage(action.href) ? (
                  <Link className="home-quick-actions__link" href={action.href} prefetch={false}>
                    {content}
                  </Link>
                ) : (
                  <a
                    className="home-quick-actions__link"
                    href={action.href}
                    {...(action.external
                      ? { rel: "noopener noreferrer", target: "_blank" }
                      : {})}
                  >
                    {content}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </nav>
  );
}
