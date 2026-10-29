import "server-only";

// Loads every homepage section from the public scope in parallel. Each
// section is an independent result, so one failing collection does not
// hide the others. Pass the output to composeHomepageData().
export async function loadHomepageContent(repositories) {
  const [siteSettings, banners, sacredItems, news, gallery, faqs, historyPage] = await Promise.all([
    repositories.siteSettings(),
    repositories.banners({ limit: 5 }),
    repositories.sacredItems({ limit: 3 }),
    repositories.news({ limit: 3 }),
    repositories.gallery({ limit: 5 }),
    repositories.faqs({ homeOnly: true }),
    repositories.historyPage(),
  ]);
  return { scope: repositories.scope, siteSettings, banners, sacredItems, news, gallery, faqs, historyPage };
}
