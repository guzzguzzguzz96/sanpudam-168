import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { SiteNavigation } from "@/components/site-navigation";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

// Only owner-verified destinations become header actions.
const contactActions = [
  siteConfig.lineInquiryUrl
    ? { id: "line", href: siteConfig.lineInquiryUrl, label: "สอบถามทาง LINE" }
    : null,
  siteConfig.directionsUrl
    ? { id: "directions", href: siteConfig.directionsUrl, label: "เส้นทาง" }
    : null,
].filter(Boolean);

export function SiteHeader() {
  return (
    <header className="site-header">
      <Container className="site-header__inner">
        <Link
          href="/"
          aria-label={`${siteConfig.localName} — หน้าแรก`}
          className="site-brand"
          prefetch={false}
        >
          <span className="site-brand__name">
            <ThaiPhrases text={siteConfig.localName} />
          </span>
          <span className="site-brand__descriptor">{siteConfig.name}</span>
        </Link>
        <Suspense fallback={null}>
          <SiteNavigation
            navigation={siteConfig.navigation}
            contactActions={contactActions}
          />
        </Suspense>
      </Container>
    </header>
  );
}
