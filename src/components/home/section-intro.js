import { PreviewBadge } from "@/components/home/preview-badge";
import { SectionHeading } from "@/components/ui/section-heading";

export function SectionIntro({
  description,
  eyebrow,
  id,
  statusLabel = "ตัวอย่าง · รอข้อมูลที่ยืนยัน",
  title,
}) {
  return (
    <div className="home-section-intro">
      <PreviewBadge>{statusLabel}</PreviewBadge>
      <SectionHeading
        id={id}
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
    </div>
  );
}
