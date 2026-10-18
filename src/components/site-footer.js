import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto px-5 py-6 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>{siteConfig.name}</p>
        <p>เว็บไซต์อยู่ระหว่างการจัดเตรียม</p>
      </div>
    </footer>
  );
}
