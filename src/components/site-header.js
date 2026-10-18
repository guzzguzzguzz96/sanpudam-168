import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { MobileNavigation } from "@/components/mobile-navigation";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Container className="site-header__inner">
        <Link
          href="/"
          aria-label={`${siteConfig.name} — หน้าแรก`}
          className="site-brand"
          prefetch={false}
        >
          <span className="site-brand__name">{siteConfig.name}</span>
          <span className="site-brand__descriptor">เว็บไซต์ทางการ</span>
        </Link>
        <div className="site-header__desktop">
          <nav aria-label="เมนูหลัก">
            <ul className="site-navigation__list">
              {siteConfig.navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="site-navigation__link"
                    prefetch={false}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {siteConfig.lineInquiryUrl ? (
            <Button href={siteConfig.lineInquiryUrl} variant="secondary">
              สอบถามผ่าน LINE
            </Button>
          ) : null}
        </div>
        <MobileNavigation />
      </Container>
    </header>
  );
}
