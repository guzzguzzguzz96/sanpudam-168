import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionIntro } from "@/components/home/section-intro";
import { Section } from "@/components/ui/section";

export function WorshipGuide({ data }) {
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
        <ol className="home-worship-guide__steps">
          {data.map((step, index) => (
            <li key={step.id} className="home-worship-guide__step">
              <span className="home-worship-guide__number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
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
