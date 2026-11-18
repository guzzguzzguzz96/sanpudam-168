import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icons";
import { ReviewNote } from "@/components/review/review-status";
import { Section } from "@/components/ui/section";

export function QuickInformation({ data }) {
  return (
    <Section
      aria-labelledby="quick-information-title"
      className="home-quick-information"
    >
      <Container>
        <div className="home-quick-information__panel">
          <div className="home-quick-information__header">
            <h2
              id="quick-information-title"
              className="home-quick-information__title"
            >
              ข้อมูลสำหรับผู้มาเยือน
            </h2>
            <Button href="#visit" variant="outline">
              ดูข้อมูลการเยี่ยมชม
            </Button>
          </div>
          <ul className="home-quick-information__list">
            {data.map((item) => (
              <li key={item.id} className="home-quick-information__item">
                <span className="home-quick-information__icon">
                  <Icon name={item.icon} />
                </span>
                <div>
                  <h3>{item.label}</h3>
                  <p>{item.value}</p>
                  <ReviewNote note={item.note} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
