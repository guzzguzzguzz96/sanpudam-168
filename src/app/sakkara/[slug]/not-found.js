import { PageHeader } from "@/components/pages/page-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

export default function SacredItemNotFound() {
  return (
    <main id="main-content" className="content-page">
      <PageHeader
        current="ไม่พบรายการ"
        description="ไม่พบวัตถุมงคลที่ต้องการ รายการอาจยังไม่เผยแพร่หรือที่อยู่ไม่ถูกต้อง"
        title="ไม่พบรายการนี้"
        trail={[{ href: "/sakkara", label: "วัตถุมงคล" }]}
      />
      <Section className="content-page__section content-page__section--first">
        <Container>
          <Button href="/sakkara" variant="outline">
            ดูวัตถุมงคลทั้งหมด
          </Button>
        </Container>
      </Section>
    </main>
  );
}
