import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

// Breadcrumb and page title for content pages. trail: [{ href, label }]
// leading to the current page; the current page is the last, unlinked item.
export function PageHeader({ trail = [], current, eyebrow, title, description, children }) {
  return (
    <header className="content-page__header">
      <Container>
        <nav aria-label="เส้นทางนำทาง" className="breadcrumb">
          <ol className="breadcrumb__list">
            {[{ href: "/", label: "หน้าแรก" }, ...trail].map((item) => (
              <li key={item.href} className="breadcrumb__item">
                <Link href={item.href} prefetch={false}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="breadcrumb__item" aria-current="page">
              {current}
            </li>
          </ol>
        </nav>
        <SectionHeading
          as="h1"
          className="content-page__heading"
          description={description}
          eyebrow={eyebrow}
          size="h1"
          title={<ThaiPhrases text={title} />}
        />
        {children}
      </Container>
    </header>
  );
}
