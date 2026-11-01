import { PageHeader } from "@/components/pages/page-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

export const metadata = {
  title: "ไม่พบหน้านี้",
};

export default function NotFound() {
  return (
    <main id="main-content" className="content-page">
      <PageHeader
        current="ไม่พบหน้า"
        description="หน้าที่ต้องการไม่มีอยู่ หรือยังอยู่ระหว่างการจัดทำ"
        title="ไม่พบหน้านี้"
      />
      <Section className="content-page__section content-page__section--first">
        <Container>
          <Button href="/" variant="outline">
            กลับหน้าแรก
          </Button>
        </Container>
      </Section>
    </main>
  );
}
