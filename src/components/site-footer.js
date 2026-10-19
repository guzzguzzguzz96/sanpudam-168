import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ContactActions } from "@/components/ui/contact-actions";
import { siteConfig } from "@/config/site";
import { ThaiPhrases } from "@/components/ui/thai-phrases";
import { getContactActions } from "@/lib/contact-actions";

const contactActions = getContactActions(["line", "phone", "maps"]);

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Container>
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link href="/" className="site-footer__brand-name" prefetch={false}>
              <ThaiPhrases text={siteConfig.localName} />
            </Link>
            <p>{siteConfig.name}</p>
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
            <ContactActions
              actions={contactActions}
              emptyMessage="ช่องทางติดต่อจะแสดงเมื่อได้รับการยืนยัน"
              layout="stack"
              tone="dark"
            />
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
