import { PageHeader } from "@/components/pages/page-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

export default function NewsArticleNotFound() {
  return (
    <main id="main-content" className="content-page">
      <PageHeader
        current="ไม่พบข่าว"
        description="ไม่พบข่าวที่ต้องการ ข่าวอาจยังไม่เผยแพร่หรือที่อยู่ไม่ถูกต้อง"
        title="ไม่พบข่าวนี้"
        trail={[{ href: "/news", label: "ข่าวสาร" }]}
      />
      <Section className="content-page__section content-page__section--first">
        <Container>
          <Button href="/news" variant="outline">
            ดูข่าวสารทั้งหมด
          </Button>
        </Container>
      </Section>
    </main>
  );
}
