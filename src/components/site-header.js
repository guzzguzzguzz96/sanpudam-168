import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { getContactActions } from "@/lib/contact-actions";
import { SiteNavigation } from "@/components/site-navigation";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

// Only owner-verified destinations become header actions.
const contactActions = getContactActions(["line", "maps"]);

// brand and reviewActions are Client Review only. brand: { name, descriptor,
// logo } from the review view data; logo is the legacy 192x192 mark, so it
// is shown at icon size only. reviewActions: owner-confirmed actions built
// with getContactActions. Without them the header uses siteConfig as before.
export function SiteHeader({ brand = null, reviewActions = null }) {
  const name = brand?.name ?? siteConfig.localName;
  const descriptor = brand?.descriptor ?? siteConfig.name;
  const logo = brand?.logo?.src ? brand.logo : null;
  const brandText = (
    <>
      <span className="site-brand__name">
        <ThaiPhrases text={name} />
      </span>
      <span className="site-brand__descriptor">{descriptor}</span>
    </>
  );

  return (
    <header className="site-header">
      <Container className="site-header__inner">
        <Link
          href="/"
          aria-label={`${name} — หน้าแรก`}
          className={`site-brand${logo ? " site-brand--with-logo" : ""}`}
          prefetch={false}
        >
          {logo ? (
            <>
              <Image
                alt=""
                className="site-brand__logo"
                height={40}
                sizes="40px"
                src={logo.src}
                width={40}
              />
              <span className="site-brand__text">{brandText}</span>
            </>
          ) : (
            brandText
          )}
        </Link>
        <Suspense fallback={null}>
          <SiteNavigation
            navigation={siteConfig.navigation}
            contactActions={reviewActions ?? contactActions}
          />
        </Suspense>
      </Container>
    </header>
  );
}
