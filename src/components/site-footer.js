import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ContactActions } from "@/components/ui/contact-actions";
import { siteConfig } from "@/config/site";
import { ReviewNote } from "@/components/review/review-status";
import { ThaiPhrases } from "@/components/ui/thai-phrases";
import { getContactActions } from "@/lib/contact-actions";

const contactActions = getContactActions(["line", "phone", "maps"]);

// brand, reviewDetails, and reviewActions are Client Review only.
// reviewDetails lists imported contact values as text with their
// verification note; they are never turned into links. reviewActions holds
// owner-confirmed actions only. Without them the footer is unchanged.
export function SiteFooter({ brand = null, reviewDetails = null, reviewActions = null }) {
  const name = brand?.name ?? siteConfig.localName;
  const descriptor = brand?.descriptor ?? siteConfig.name;

  return (
    <footer className="site-footer">
      <Container>
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link href="/" className="site-footer__brand-name" prefetch={false}>
              <ThaiPhrases text={name} />
            </Link>
            <p>{descriptor}</p>
          </div>

          <nav aria-label="เมนูหลักท้ายเว็บไซต์">
            <h2 className="site-footer__heading">เมนูหลัก</h2>
            <ul className="site-footer__links">
              {siteConfig.navigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} prefetch={false}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="footer-contact-title">
            <h2 id="footer-contact-title" className="site-footer__heading">
              ติดต่อและการเดินทาง
            </h2>
            {reviewActions?.length ? (
              <ContactActions
                actions={reviewActions}
                className="site-footer__review-actions"
                layout="stack"
                tone="dark"
              />
            ) : null}
            {reviewDetails?.length ? (
              <dl className="site-footer__review-details">
                {reviewDetails.map((detail) => (
                  <div key={detail.id}>
                    <dt>{detail.label}</dt>
                    <dd>
                      {detail.value}
                      <ReviewNote note={detail.note} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <ContactActions
                actions={contactActions}
                emptyMessage="ช่องทางติดต่อจะแสดงเมื่อได้รับการยืนยัน"
                layout="stack"
                tone="dark"
              />
            )}
          </section>

          <section aria-labelledby="footer-privacy-title">
            <h2 id="footer-privacy-title" className="site-footer__heading">
              ข้อมูลความเป็นส่วนตัว
            </h2>
            <p>นโยบายความเป็นส่วนตัวจะเผยแพร่ก่อนเปิดรับข้อมูลติดต่อ</p>
          </section>
        </div>
      </Container>
    </footer>
  );
}
