import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { SiteNavigation } from "@/components/site-navigation";

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
        <Suspense fallback={null}>
          <SiteNavigation
            navigation={siteConfig.navigation}
            lineInquiryUrl={siteConfig.lineInquiryUrl}
          />
        </Suspense>
      </Container>
    </header>
  );
}
