import { Container } from "@/components/ui/container";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

// Site-wide notice while Client Review Mode is on. Replaces the prototype
// notice; uses the same restrained styling.
export function ReviewBanner() {
  return (
    <aside className="preview-notice review-banner" aria-label="สถานะของเนื้อหา">
      <Container className="preview-notice__inner">
        <span className="preview-notice__label">โหมดตรวจทานเนื้อหา</span>
        <p className="preview-notice__text">
          <ThaiPhrases text="เนื้อหาและภาพนำเข้าจากระบบเดิม อยู่ระหว่างรอเจ้าของตรวจสอบและยืนยัน ยังไม่ใช่ข้อมูลที่เผยแพร่จริง" />
        </p>
      </Container>
    </aside>
  );
}
