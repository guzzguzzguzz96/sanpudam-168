import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--page)]">
      <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link
          href="/"
          aria-label={`${siteConfig.name} หน้าหลัก`}
          className="rounded-sm text-base font-semibold tracking-tight text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        >
          {siteConfig.name}
        </Link>
        <nav aria-label="เมนูหลัก">
          <ul className="flex items-center gap-5 text-sm text-[var(--muted)] sm:gap-8">
            <li>
              <Link
                href="#about"
                className="rounded-sm transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
              >
                เกี่ยวกับ
              </Link>
            </li>
            <li>
              <Link
                href="#foundation"
                className="rounded-sm transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
              >
                แนวทาง
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
