import { SectionHeading } from "@/components/ui/section-heading";

export function SectionIntro({
  description,
  eyebrow,
  id,
  title,
}) {
  return (
    <div className="home-section-intro">
      <SectionHeading
        id={id}
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
    </div>
  );
}
