import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionIntro } from "@/components/home/section-intro";
import { Button } from "@/components/ui/button";

export function QuickInformation({ data }) {
  return (
    <Section
      aria-labelledby="quick-information-title"
      className="home-quick-information"
    >
      <Container>
        <SectionIntro
          id="quick-information-title"
          eyebrow="ข้อมูลเบื้องต้น"
          title="ข้อมูลสำหรับผู้มาเยือน"
        />
        <ul className="home-quick-information__list">
          {data.map((item) => (
            <li key={item.id} className="home-quick-information__item">
              <h3>{item.label}</h3>
              <p>{item.value}</p>
            </li>
          ))}
        </ul>
        <div className="home-section-action">
          <Button href="/visit" variant="secondary">
            ข้อมูลการเยี่ยมชม
          </Button>
        </div>
      </Container>
    </Section>
  );
}
