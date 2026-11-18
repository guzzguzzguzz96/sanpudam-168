import { Container } from "@/components/ui/container";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

// Shown on every deployment that is not the launched site
// (src/lib/site-launch.js): "เว็บไซต์ทดสอบ · ยังไม่เปิดให้บริการจริง".
export function PreviewNotice() {
  return (
    <aside className="preview-notice" aria-label="สถานะของเว็บไซต์">
      <Container className="preview-notice__inner">
        <span className="preview-notice__label">เว็บไซต์ทดสอบ</span>
        <p className="preview-notice__text">
          <ThaiPhrases text="ยังไม่เปิดให้บริการจริง" />
        </p>
      </Container>
    </aside>
  );
}
