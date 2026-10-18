import { Container } from "@/components/ui/container";
import { SectionIntro } from "@/components/home/section-intro";
import { Section } from "@/components/ui/section";

export function Faq({ data }) {
  return (
    <Section id="faq" aria-labelledby="faq-title" className="home-faq">
      <Container>
        <SectionIntro
          id="faq-title"
          statusLabel="ตัวอย่างคำถาม · ยังไม่ใช่ข้อมูลยืนยัน"
          eyebrow="คำถามที่พบบ่อย"
          title="คำถามและคำตอบ"
          description="เผยแพร่คำตอบหลังตรวจสอบข้อมูลกับเจ้าของแล้วเท่านั้น"
        />
        <div className="home-faq__list">
          {data.map((item) => (
            <details key={item.id} className="home-faq__item">
              <summary aria-controls={`faq-answer-${item.id}`}>
                {item.question}
              </summary>
              <div id={`faq-answer-${item.id}`} className="home-faq__answer">
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
