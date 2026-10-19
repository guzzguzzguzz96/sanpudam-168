import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { getContactActions } from "@/lib/contact-actions";
import { SiteNavigation } from "@/components/site-navigation";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

// Only owner-verified destinations become header actions.
const contactActions = getContactActions(["line", "maps"]);

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
