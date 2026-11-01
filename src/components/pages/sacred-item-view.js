import { MediaFrame } from "@/components/home/media-frame";
import { LegacyText } from "@/components/pages/legacy-text";
import { PageHeader } from "@/components/pages/page-header";
import { ReviewStatus } from "@/components/review/review-status";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

// /sakkara/[slug] from the item view data (src/server/site/pages.js). No
// price, stock, ordering, or contact actions: those are not part of the
// item model, and imported contact details are unverified.
export function SacredItemView({ view }) {
  const { status } = view;
  const facts = [
    view.prayerTopics ? { id: "prayer", label: "เรื่องที่นิยมขอพร", value: view.prayerTopics, status: status.prayerTopics } : null,
    view.offerings ? { id: "offerings", label: "ของไหว้", value: view.offerings, status: status.offerings } : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        current={view.name}
        eyebrow={view.category?.label ?? "วัตถุมงคล"}
        title={view.name}
        trail={[{ href: "/sakkara", label: "วัตถุมงคล" }]}
      />

      <Section aria-label="รายละเอียด" className="content-page__section content-page__section--first">
        <Container className="content-page__split">
          <MediaFrame
            alt={view.image?.alt}
            className="content-page__media content-page__media--item"
            desktopImage={view.image}
            placeholderLabel="ยังไม่มีภาพวัตถุมงคลที่ได้รับอนุมัติ"
            priority
            sizes="(max-width: 767px) 100vw, 45vw"
          />
          <div className="content-page__prose">
            {view.summary ? <p className="content-page__lead">{view.summary}</p> : null}
            <ReviewStatus className="review-section-status" status={status.summary} />

            {facts.length ? (
              <dl className="content-page__facts">
                {facts.map((fact) => (
                  <div key={fact.id} className="content-page__fact">
                    <dt>{fact.label}</dt>
                    <dd>
                      {fact.value}
                      <ReviewStatus status={fact.status} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {view.variants.length ? (
              <div className="content-page__variants">
                <h2 className="content-page__subheading">เนื้อที่จัดสร้าง</h2>
                <ul>
                  {view.variants.map((variant) => (
                    <li key={variant.id}>
                      {variant.name}
                      {variant.quantity !== null ? ` · ${variant.quantity}` : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.body.length ? (
              <div className="content-page__body">
                <h2 className="content-page__subheading">รายละเอียด</h2>
                <ReviewStatus className="review-section-status" status={status.body} />
                <LegacyText paragraphs={view.body} />
              </div>
            ) : null}

            <div className="content-page__actions">
              <Button href="/sakkara" variant="outline">
                กลับไปหน้าวัตถุมงคลทั้งหมด
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
