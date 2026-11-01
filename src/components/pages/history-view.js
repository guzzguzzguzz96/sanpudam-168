import { MediaFrame } from "@/components/home/media-frame";
import { WorshipGuide } from "@/components/home/worship-guide";
import { LegacyText } from "@/components/pages/legacy-text";
import { PageHeader } from "@/components/pages/page-header";
import { ReviewStatus } from "@/components/review/review-status";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

// /history from the page view data (src/server/site/pages.js). Each block
// renders only when its source content exists; nothing is filled in.
export function HistoryView({ view }) {
  const { status } = view;

  return (
    <>
      <PageHeader
        current="ประวัติ"
        description={view.intro}
        eyebrow="ประวัติ"
        title={view.title ?? "ประวัติศาล"}
      >
        <ReviewStatus status={status.intro} />
      </PageHeader>

      {view.body.length || view.image ? (
        <Section aria-label="ประวัติความเป็นมา" className="content-page__section">
          <Container className="content-page__split">
            {view.image ? (
              <MediaFrame
                alt={view.image.alt}
                className="content-page__media content-page__media--square"
                desktopImage={view.image}
                priority
                sizes="(max-width: 767px) 100vw, 40vw"
              />
            ) : null}
            <div className="content-page__prose">
              <ReviewStatus className="review-section-status" status={status.body} />
              <LegacyText paragraphs={view.body} />
              {view.quote ? (
                <blockquote className="content-page__quote">
                  <p>{view.quote}</p>
                </blockquote>
              ) : null}
            </div>
          </Container>
        </Section>
      ) : null}

      {view.coatOfArms ? (
        <Section aria-labelledby="coat-of-arms-title" className="content-page__section content-page__section--tinted">
          <Container className="content-page__split content-page__split--reverse">
            {view.coatOfArms.image ? (
              <MediaFrame
                alt={view.coatOfArms.image.alt}
                className="content-page__media content-page__media--portrait"
                desktopImage={view.coatOfArms.image}
                sizes="(max-width: 767px) 100vw, 40vw"
              />
            ) : null}
            <div className="content-page__prose">
              <SectionHeading id="coat-of-arms-title" title={view.coatOfArms.heading} />
              <ReviewStatus className="review-section-status" status={status.coatOfArms} />
              <LegacyText paragraphs={view.coatOfArms.body} />
              {view.coatOfArms.parts.length ? (
                <dl className="content-page__parts">
                  {view.coatOfArms.parts.map((part) => (
                    <div key={part.id} className="content-page__part">
                      <dt>{part.part}</dt>
                      {part.meaning ? <dd>{part.meaning}</dd> : null}
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </Container>
        </Section>
      ) : null}

      {view.wishTopics.length ? (
        <Section aria-labelledby="wish-topics-title" className="content-page__section">
          <Container>
            <SectionHeading eyebrow="การขอพร" id="wish-topics-title" title="เรื่องที่ผู้ศรัทธานิยมขอพร" />
            <ReviewStatus className="review-section-status" status={status.wishTopics} />
            <ul className="content-page__topics">
              {view.wishTopics.map((topic) => (
                <li key={topic.id} className="content-page__topic">
                  <h3>{topic.topic}</h3>
                  {topic.description ? <p>{topic.description}</p> : null}
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {view.worshipSteps.length ? <WorshipGuide data={view.worshipSteps} reviewStatus={status.worshipSteps} /> : null}
    </>
  );
}
