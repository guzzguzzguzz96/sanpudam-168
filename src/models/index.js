// Model registry. Importing this module defines the models but does not
// open a database connection (see src/lib/db.js).
import { Banner } from "./banner.js";
import { Category } from "./category.js";
import { Faq } from "./faq.js";
import { GalleryItem } from "./gallery-item.js";
import { MediaAsset } from "./media-asset.js";
import { MigrationRun } from "./migration-run.js";
import { News } from "./news.js";
import { Page } from "./page.js";
import { Review } from "./review.js";
import { SacredItem } from "./sacred-item.js";
import { SiteSettings } from "./site-settings.js";
import { TeamMember } from "./team-member.js";
import { Video } from "./video.js";

export { Banner, Category, Faq, GalleryItem, MediaAsset, MigrationRun, News, Page, Review, SacredItem, SiteSettings, TeamMember, Video };

// Collection name -> model, for the migration tooling.
export const modelsByCollection = {
  media_assets: MediaAsset,
  categories: Category,
  site_settings: SiteSettings,
  pages: Page,
  sacred_items: SacredItem,
  news: News,
  banners: Banner,
  gallery_items: GalleryItem,
  faqs: Faq,
  videos: Video,
  reviews: Review,
  team_members: TeamMember,
  migration_runs: MigrationRun,
};
