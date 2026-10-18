import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icons";

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
          {data.map((action) => (
            <li key={action.id}>
              <a
                className="home-quick-actions__link"
                href={action.href}
                {...(action.external
                  ? { rel: "noopener noreferrer", target: "_blank" }
                  : {})}
              >
                <span className="home-quick-actions__icon">
                  <Icon name={action.icon} />
                </span>
                <span>{action.label}</span>
                {action.external ? (
                  <span className="sr-only">(เปิดในหน้าต่างใหม่)</span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </nav>
  );
}
