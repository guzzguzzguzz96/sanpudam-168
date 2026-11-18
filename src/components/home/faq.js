import { Container } from "@/components/ui/container";
import { SectionIntro } from "@/components/home/section-intro";
import { ReviewStatus } from "@/components/review/review-status";
import { Section } from "@/components/ui/section";

export function Faq({ data }) {
  return (
    <Section id="faq" aria-labelledby="faq-title" className="home-faq">
      <Container>
        <SectionIntro
          id="faq-title"
          eyebrow="คำถามที่พบบ่อย"
          title="คำถามและคำตอบ"
        />
        <div className="home-faq__list">
          {data.map((item) => (
            <details key={item.id} className="home-faq__item">
              <summary aria-controls={`faq-answer-${item.id}`}>
                {item.question}
              </summary>
              <div id={`faq-answer-${item.id}`} className="home-faq__answer">
                <p>{item.answer}</p>
                <ReviewStatus status={item.reviewStatus} />
              </div>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
