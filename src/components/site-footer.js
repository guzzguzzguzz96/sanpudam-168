import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ContactActions } from "@/components/ui/contact-actions";
import { siteConfig } from "@/config/site";
import { ReviewNote } from "@/components/review/review-status";
import { ThaiPhrases } from "@/components/ui/thai-phrases";
import { getContactActions } from "@/lib/contact-actions";

const contactActions = getContactActions(["line", "phone", "maps"]);

// brand, contact, and actions come from the site settings (public or review
// view data). contact: { details, note, moreHref } - a compact summary of
// contact values (text, never links) with one shared verification note
// (review only) and a link to the full details on /visit. actions holds
// verified (public) or owner-confirmed (review) actions only. Without them
// the footer uses siteConfig.
export function SiteFooter({ brand = null, contact = null, actions = null }) {
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
            {actions?.length ? (
              <ContactActions
                actions={actions}
                className="site-footer__review-actions"
                layout="stack"
                tone="dark"
              />
            ) : null}
            {contact?.details?.length ? (
              <>
                <dl className="site-footer__review-details">
                  {contact.details.map((detail) => (
                    <div key={detail.id}>
                      <dt>{detail.label}</dt>
                      <dd>{detail.value}</dd>
                    </div>
                  ))}
                </dl>
                <ReviewNote note={contact.note} />
                {contact.moreHref ? (
                  <p className="site-footer__review-more">
                    <Link href={contact.moreHref} prefetch={false}>
                      ที่อยู่เต็มและช่องทางติดต่อทั้งหมด
                    </Link>
                  </p>
                ) : null}
              </>
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
