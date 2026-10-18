import Link from "next/link";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

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
              ข้อมูลติดต่อ
            </h2>
            {siteConfig.lineInquiryUrl ? (
              <p>
                <a href={siteConfig.lineInquiryUrl}>สอบถามผ่าน LINE</a>
              </p>
            ) : (
              <p>จะแสดงช่องทางติดต่อเมื่อได้รับการยืนยัน</p>
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
