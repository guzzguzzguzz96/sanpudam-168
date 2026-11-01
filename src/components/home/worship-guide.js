import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionIntro } from "@/components/home/section-intro";
import { ReviewStatus } from "@/components/review/review-status";
import { Section } from "@/components/ui/section";

export function WorshipGuide({ data, reviewStatus = null }) {
  return (
    <Section
      id="worship-guide"
      aria-labelledby="worship-guide-title"
      className="home-worship-guide"
    >
      <Container>
        <SectionIntro
          id="worship-guide-title"
          eyebrow="คำแนะนำ"
          title="เตรียมข้อมูลการสักการะ"
        />
        <ReviewStatus className="review-section-status" status={reviewStatus} />
        {/* Columns follow the step count (at most 4 desktop / 2 tablet), so
            fewer steps never leave empty columns. */}
        <ol
          className="home-worship-guide__steps"
          style={{
            "--worship-columns": Math.min(Math.max(data.length, 1), 4),
            "--worship-columns-tablet": Math.min(Math.max(data.length, 1), 2),
          }}
        >
          {data.map((step, index) => (
            <li key={step.id} className="home-worship-guide__step">
              <span className="home-worship-guide__number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              {step.description ? <p>{step.description}</p> : null}
            </li>
          ))}
        </ol>
        <div className="home-section-action">
          <Button href="/visit" variant="outline">
            ข้อมูลการเยี่ยมชม
          </Button>
        </div>
      </Container>
    </Section>
  );
}
