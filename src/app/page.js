import { siteConfig } from "@/config/site";

const principles = [
  {
    number: "01",
    title: "เข้าถึงง่าย",
    description: "วางโครงสร้างให้ใช้งานสะดวกบนทุกขนาดหน้าจอ",
  },
  {
    number: "02",
    title: "เป็นระบบ",
    description: "เตรียมพื้นฐานที่ชัดเจนสำหรับการพัฒนาส่วนต่าง ๆ ในอนาคต",
  },
  {
    number: "03",
    title: "พร้อมเติบโต",
    description: "แยกส่วนการทำงานเพื่อให้ต่อยอดได้โดยไม่ซับซ้อน",
  },
];

export default function HomePage() {
  return (
    <main id="main-content" className="flex-1">
      <section
        id="about"
        aria-labelledby="hero-title"
        className="px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24"
      >
        <div className="mx-auto max-w-6xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-[var(--accent)]"
            />
            เว็บไซต์กำลังอยู่ระหว่างการจัดเตรียม
          </p>
          <h1
            id="hero-title"
            className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-6xl sm:leading-[1.12]"
          >
            ยินดีต้อนรับสู่
            <span className="mt-2 block text-[var(--accent)]">
              {siteConfig.name}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
            เรากำลังเตรียมพื้นที่ออนไลน์รูปแบบใหม่ เพื่อให้ข้อมูลและเรื่องราวต่าง ๆ
            เข้าถึงได้ง่าย พร้อมต่อยอดเป็นประสบการณ์ที่ครบถ้วนในอนาคต
          </p>
          <a
            href="#foundation"
            className="mt-9 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
          >
            รู้จักแนวทางของเรา
            <span aria-hidden="true" className="ml-2">
              ↓
            </span>
          </a>
        </div>
      </section>

      <section
        id="foundation"
        aria-labelledby="foundation-title"
        className="border-y border-[var(--line)] bg-white px-5 py-16 sm:px-8 sm:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-[var(--accent)]">
              เริ่มต้นจากพื้นฐานที่ดี
            </p>
            <h2
              id="foundation-title"
              className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl"
            >
              ออกแบบเพื่อให้ใช้งานได้จริง และเติบโตต่อได้
            </h2>
            <p className="mt-4 leading-7 text-[var(--muted)]">
              โครงสร้างเว็บไซต์นี้ให้ความสำคัญกับความชัดเจน การเข้าถึง
              และความยืดหยุ่น โดยยังคงเปิดพื้นที่สำหรับการพัฒนารูปแบบที่เหมาะสมต่อไป
            </p>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-5">
            {principles.map((principle) => (
              <li
                key={principle.number}
                className="rounded-2xl border border-[var(--line)] bg-[var(--page)] p-6"
              >
                <p className="text-sm font-medium text-[var(--accent)]">
                  {principle.number}
                </p>
                <h3 className="mt-4 text-lg font-semibold text-[var(--ink)]">
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {principle.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
