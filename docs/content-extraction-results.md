# ผลการสกัดเนื้อหา (Content Extraction Results)

**Phase:** 02.5.3 — Authorized Legacy Media & Content Extraction
**วันที่:** 19 ตุลาคม 2569 (2026-10-19)
**แหล่งข้อมูลเต็ม (ไม่ commit):** `migration/content/raw/` (JSON ที่ redact แล้ว), `migration/content/<collection>.json` (รูปแบบเอกสารเป้าหมาย), `migration/manifests/content-manifest.json`, `migration/reports/dry-run.md`

เอกสารนี้ไม่ใส่ชื่อบุคคลจากรีวิวและทีมงาน และไม่ใส่ค่ารหัส analytics

## 1. จำนวนเรคอร์ดเทียบกับที่คาดไว้

| โมดูลเดิม | collection ใหม่ | คาดไว้ (audit) | สกัดได้ | `published` เดิม | เรคอร์ดที่มีธง placeholder | ธง placeholder |
|---|---|---:|---:|---:|---:|---:|
| news | `news` | 3 | 3 | 3 | 1 | 3 |
| gallery | `gallery_items` | 10 | 10 | 10 | 0 | 0 |
| banners | `banners` | 4 | 4 | 4 | 0 | 0 |
| sacred | `sacred_items` | 5 | 5 | 5 | 4 | 7 |
| categories | `categories` | 3 | 3 | 3 | 0 | 0 |
| videos | `videos` | 1 | 1 | 1 | 1 | 2 |
| reviews | `reviews` | 3 | 3 | 3 | 3 | 9 |
| faqs | `faqs` | 6 | 6 | 6 | 3 | 3 |
| team | `team_members` | 2 | 2 | 2 | 2 | 4 |
| about (singleton) | `pages` (`history`) | 1 | 1 | 1 | 1 | 2 |
| settings (singleton) | `site_settings` | 1 | 1 | 1 | 1 | 2 |
| **รวม** | | **39** | **39** | **39** | **16** | **32** |

จำนวนตรงกับ Admin audit ทุกโมดูล และธง placeholder 32 ฟิลด์ใน 16 เรคอร์ดตรงกับหน้า `/placeholders` ของระบบเดิม

## 2. identity และสถานะของทุกเรคอร์ด

- **Legacy ID:** ทุกเรคอร์ดมี ID 16 ตัวอักษรฐาน 16 (เช่น `9dd903250b99c7e9`) เก็บใน `legacy.id`
- **คีย์ idempotent:** `legacy.key = "<module>:id:<legacyId>"` (`keyStrength: "id"`) ไม่ต้องใช้คีย์อ่อนแบบ hash
- **identity ที่คาดเดาได้:** `importId` = 24 ตัวแรกของ `SHA-256("sanpudam168:" + legacy.key)` ใช้เป็น `_id` ตอนนำเข้า เรคอร์ดเดิมจะได้ `_id` เดิมทุกครั้ง และเขียนความสัมพันธ์ (เช่น `categoryId`) ได้ก่อน insert
- **checksum:** `legacy.checksum` = SHA-256 ของ `data`, `published`, `sort` และ `placeholder` แบบ stable JSON ใช้ตรวจการเปลี่ยนแปลงเมื่อรันซ้ำ
- **สถานะ:** ทุกเรคอร์ด `status: "draft"` และ `review.status: "pending_review"` ค่า `published` เดิมเก็บใน `legacy.isPublished` เป็น metadata ไม่ใช่การอนุมัติ
- **ข้อมูลเวลาเดิม:** `legacy.createdAt` / `legacy.updatedAt` จากระบบเดิม

## 3. ชื่อฟิลด์จริงของระบบเดิม → ฟิลด์ใหม่

Admin audit เสนอชื่อ key ไว้ก่อน ชื่อจริงที่ได้จาก Admin UI เป็นดังนี้ (ความหมายตรงกับ `legacy-data-mapping.md`)

| โมดูล | key เดิม → ฟิลด์ใหม่ |
|---|---|
| sacred | `title`→`name`, `slug`, `category`→`categoryId`, `kind` (`place`→`shrine_worship`, `amulet`→`sacred_object`)→`type`, `image`→`primaryImage`, `summary`→`excerpt`, `body`, `wish_for`→`prayerTopics`, `offerings`, `price_note`→`inquiryText`, `variants[{name,qty,note}]`→`variants[{key,name,quantity,note,sortOrder}]`, `seo_title`/`seo_description`→`seo` |
| news | `title`, `slug`, `date`, `cover`→`coverImage`, `summary`→`excerpt`, `body`, `photos[{image}]`→`images[]`, `seo_title`/`seo_description`→`seo` |
| gallery | `image`→`image`, `caption`→`image.caption` |
| banners | `image` (+ `fx`, `fy` เป็นเปอร์เซ็นต์)→`image` + `focalPoint {x: fx/100, y: fy/100}`, `title`→`image.caption` |
| categories | `name`, `slug`, `description` |
| videos | `title`, `video`→`videoAssetId`, `description` |
| reviews | `name`→`displayName`, `role`→`sourceLabel`, `text`→`quote`, `rating` |
| faqs | `question`, `answer`, `on_home`→`showOnHome` |
| team | `name`, `role`→`roleTitle`, `photo`, `bio` |
| about | `history_title`→`title`, `history_intro`→`intro`, `history_body`→`historyBody`, `history_image`→`historyImage`, `home_heading`→`homeIntroHeading`, `quote`, `emblem_title`/`emblem_body`/`emblem_image`/`emblem_parts[{title,meaning}]`→`coatOfArms.*`, `wishes[{title,desc,icon}]`→`wishTopics[]`, `worship_steps[{title,desc}]`→`worshipSteps[]` |
| settings | `name`, `short_name`, `tagline`, `about_short`→`identity.*`; `address`, `area`, `phone`, `line_id`, `map_url`, `map_query`→`contact.*`; `open_time`, `close_time`, `open_days`, `hours_text`→`openingHours.*`; `facebook_url`/`tiktok_url`/`youtube_url`→`socialLinks[]`; `contact_topics[{label}]`→`contactTopics[]`; `og_image`→`seo.defaultOgImage`; `ga4_id`/`gads_id`/`fb_pixel_id`→**ไม่ย้าย** |

ทุกภาพในระบบเดิมมีรูปแบบ `{ src, w, h, alt, mobile }` โดย `mobile` คือไฟล์ `-800` ของภาพเดียวกัน (ไม่ใช่ภาพมือถือแยก) จึงเก็บไว้เพียงใน `mediaMapping.legacyMobileUrl`

## 4. เรคอร์ดที่สกัดได้

คอลัมน์: legacy ID · ข้อมูลหลัก · `sort` เดิม · `published` เดิม · ธง placeholder (path ใหม่)

### 4.1 `categories`

| Legacy ID | slug (ชื่อ) | sort | published | placeholder |
|---|---|---:|---|---|
| `d1a688d9dc5baf9d` | `sacred-place` (สถานที่ศักดิ์สิทธิ์) | 1 | true | — |
| `8f2775c7e06877b9` | `saimu` (สายมู) | 2 | true | — |
| `92c48d36504d8a61` | `check-in` (จุดเช็กอิน) | 3 | true | — |

### 4.2 `sacred_items`

| Legacy ID | slug · type · หมวด | sort | published | placeholder |
|---|---|---:|---|---|
| `9dd903250b99c7e9` | `pu-dam-168` · shrine_worship · sacred-place | 1 | true | `body`, `offerings` |
| `943a76e5028863d7` | `tra-phaendin-siam` · shrine_worship · sacred-place | 2 | true | — |
| `b267dd4d1a60a3c0` | `luang-pu-sila` · shrine_worship · sacred-place | 3 | true | `excerpt`, `body`, `prayerTopics` |
| `07fae6f8366c44e7` | `coin-charoenlap-charoenyot` · sacred_object · saimu | 4 | true | `inquiryText` |
| `316874eec681c196` | `shrine-gate` · shrine_worship · check-in | 5 | true | `body` |

เหรียญมี variants 8 แถว (เนื้อเงิน 30, เนื้อเงินลงยาสีแดง 5, สีน้ำเงิน 5, สีเขียว 5, เนื้อนวะ 400, เนื้ออัลปาก้า 555, เนื้อทองแดง 2,000, เนื้อทองเหลือง 2,000 รวม 5,000) ค่า `qty` เป็นตัวเลขทั้งหมด `showVariantQuantities: false` จนกว่าเจ้าของยืนยัน `inquiryText` คือ "สอบถามราคาและสั่งจองทางไลน์" ไม่มีตัวเลขราคา เก็บตามต้นฉบับ

### 4.3 `news`

| Legacy ID | slug · วันที่ | sort | published | placeholder |
|---|---|---:|---|---|
| `db71283355a379db` | `know-tra-phaendin-siam` · 2026-03-20 | 2 | true | — |
| `b1428ece1a327cbe` | `tra-phaendin-ceremony-2569` · 2026-03-16 | 1 | true | — |
| `208782856873f7ce` | `monks-blessing-ceremony` · 2026-03-16 | 3 | true | `title`, `date`, `body` |

ภาพประกอบ: 1, 2 และ 2 ภาพตามลำดับ วันที่เก็บเป็น `YYYY-MM-DD` ตามต้นฉบับ วันที่ของข่าว `monks-blessing-ceremony` เป็นข้อมูลตัวอย่าง

### 4.4 `banners`

| Legacy ID | caption · focal point (0–1) | sort | published | placeholder |
|---|---|---:|---|---|
| `7446ec999f6704d4` | โถงสักการะภายในศาล · 0.55, 0.50 | 1 | true | — |
| `72126bdd5e1d63b6` | ซุ้มประตูหน้าศาล · 0.50, 0.30 | 2 | true | — |
| `ffb6c255bcceb78e` | ป้ายศาลด้านข้างอาคาร · 0.62, 0.50 | 3 | true | — |
| `4fb92ca034f8ed10` | สถานีตำรวจนครบาลพระราชวัง · 0.50, 0.55 | 4 | true | — |

ค่าดิบ `fx`/`fy` (เปอร์เซ็นต์) เก็บไว้ใน `legacy.raw`

### 4.5 `gallery_items`

10 รายการ ลำดับ 1–10: interior-altar, tra-phaendin-coat-of-arms, pu-dam-168-statue, front-entrance, devotee-at-coat-of-arms, monks-holy-water, officer-paying-respect, signboard-side, monk-blessing-devotees, phraratchawang-police-station (ตรงกับลำดับบน `/visit#gallery`) ไม่มีธง placeholder

### 4.6 `videos`, `reviews`, `team_members`

| Collection | Legacy ID | สถานะข้อมูล | placeholder |
|---|---|---|---|
| videos | `6797c999123c9ee2` | ไม่มีไฟล์วิดีโอ (`video: null`) health ของระบบเดิมแจ้ง required ขาด | `videoAssetId`, `description` |
| reviews | `65f33139d9130853`, `af4352c3dc2b8914`, `f7c9ddf2f730bba2` | **ข้อมูลตัวอย่างทั้งหมด** คะแนน 5 ทุกรายการ | `displayName`, `sourceLabel`, `quote` (ทุกรายการ) |
| team_members | `b0abc3090d27cebd` | ไม่มีรูป | `name`, `roleTitle`, `bio` |
| team_members | `7b338fcf6067e9ff` | ไม่มีรูป | `bio` |

ทุกรายการใน reviews และ team_members ได้ `consent.status: "pending"`

### 4.7 `faqs`

6 รายการ ลำดับ 1–6 `showOnHome` เป็น true สำหรับข้อ 1–3 (ยืนยันแล้วว่าตรงกับที่หน้าแรกแสดง) ข้อ 4–6 มีธง placeholder ที่ `answer` (legacy ID `f36014850ad16ec4`, `242355964e4645bd`, `56973566e22c2db0`)

### 4.8 `pages` (`history`, legacy ID `f5e4407354ed1c68`)

- ความหมายส่วนต่าง ๆ ของตรา 8 แถว, เรื่องที่นิยมขอพร 4 แถว, ขั้นตอนการสักการะ 4 แถว ทุก item ได้ `key` คงที่ (`part-01`…, `wish-01`…, `step-01`…)
- ไอคอนเดิม: `briefcase`, `file-text`, `coins`, `crown`
- ธง placeholder: `historyBody` และ `worshipSteps` (ระดับทั้ง array เพราะระบบเดิมติดธงที่ฟิลด์ ไม่ใช่ราย item)

### 4.9 `site_settings` (legacy ID `a0db5b1362f95549`)

| กลุ่ม | ค่า (ข้อมูลสาธารณะของศาล) |
|---|---|
| identity | ชื่อ "ศาลปู่ดำ168 และตราแผ่นดิน", ชื่อสั้น "ศาลปู่ดำ168", คำโปรย "ศรัทธาและบารมี ใจกลางพระนคร", คำแนะนำศาล 1 ย่อหน้า |
| contact | ที่อยู่ 79 ถนนมหาราช แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200 (ด้านหลังสถานีตำรวจนครบาลพระราชวัง), ทำเล "หลัง สน.พระราชวัง ถนนมหาราช เขตพระนคร", โทร `0823686168`, LINE `@sanpudam168`, แผนที่ `https://share.google/4YWFvetEfPrWZB9qz`, คำค้นแผนที่ "ศาลปู่ดำ ตราแผ่นดิน สถานีตำรวจนครบาลพระราชวัง ถนนมหาราช" |
| openingHours | `08:00`–`20:00`, วัน "ทุกวัน" (มีธง placeholder), ข้อความ "08:00 – 20:00 น." |
| socialLinks | Facebook, TikTok, YouTube (`verified: false`) |
| contactTopics | 5 หัวข้อ (มีธง placeholder ทั้ง array) |
| seo | `defaultOgImage` → `brand-og-default` |
| analytics | ไม่ย้าย ระบบเดิมไม่ได้กรอกค่าไว้ทั้ง 3 ช่อง |
| branding | ระบบเดิมไม่มีฟิลด์โลโก้ ให้ผูก `brand-logo-mark` ตอนนำเข้า |

`contact.verified: false` จนกว่าเจ้าของยืนยันในระบบใหม่ หน้าเว็บยังใช้ `src/config/site.js` (ค่าเป็น `null`) ตามแผนเดิม

## 5. ความสัมพันธ์

| ความสัมพันธ์ | ผล |
|---|---|
| sacred_items → categories | **resolve ได้ครบ 5/5** จาก ID ที่เก็บในระบบเดิม (ไม่ได้เดาจากชื่อหรือหน้าเว็บ) |
| ทุก ImageRef → media | resolve ได้ครบ ทุกภาพมี alt |
| videos → ไฟล์วิดีโอ | **resolve ไม่ได้** ระบบเดิมไม่มีไฟล์ |
| team_members → รูป | ไม่มีรูป (ไม่ใช่ข้อผิดพลาด เพราะไม่บังคับ) |
| site_settings → โลโก้ | ไม่มีฟิลด์ในระบบเดิม ผูกด้วยมือตอนนำเข้า |

## 6. สรุป dry-run

ผลเต็มอยู่ใน `migration/reports/dry-run.md` (plan hash `b1da8776ea6bb817d83f991d3f8a27b4635f552f33b3643053a5631a923e551c`) ไม่มีการเชื่อมต่อ MongoDB หรือ Cloudinary ทุกเรคอร์ดถูกรายงานเป็น "create" เทียบกับฐานข้อมูลว่าง

| ระดับ | จำนวน | รายละเอียด |
|---|---:|---|
| error | 1 | วิดีโอไม่มีไฟล์ เผยแพร่ไม่ได้ |
| warning | 17 | 16 เรคอร์ดเป็น `published: true` ในระบบเดิมแต่ยังมีธง placeholder (sacred 4, news 1, videos 1, reviews 3, faqs 3, team 2, history 1, settings 1) และ 1 รายการคือลิงก์แผนที่ `share.google` ไม่ผ่าน `getMapsUrl()` |
| info | 9 | variants ของเหรียญ, ไม่มีรูปทีมงาน 2, consent pending 5, ไม่มีฟิลด์โลโก้ |

ไม่มี: slug ซ้ำ, slug ผิดรูปแบบ, `importId` ชนกัน, ข้อความเกินเพดาน, ภาพที่ resolve ไม่ได้, ภาพไม่มี alt, หรือ `inquiryText` ที่มีตัวเลขราคา

## 7. ข้อมูลที่ยังขาดหรือต้องตัดสินใจ

1. เนื้อหาจริงสำหรับ 32 ฟิลด์ที่เป็นข้อมูลตัวอย่าง (โดยเฉพาะประวัติองค์ปู่ดำ หลวงปู่ศิลา คำตอบ FAQ 3 ข้อ และข่าว `monks-blessing-ceremony`)
2. รีวิวจริงและความยินยอม หรือการตัดสินใจไม่ใช้ส่วนรีวิว
3. ชื่อ บทบาท ประวัติ และรูปของทีมงาน พร้อมความยินยอม
4. ไฟล์วิดีโอแนะนำ หรือการตัดสินใจไม่ใช้ส่วนวิดีโอ
5. ลิงก์ Google Maps รูปแบบที่ระบบรองรับ
6. การยืนยันข้อมูลติดต่อ วันเปิด และหัวข้อฟอร์มติดต่อ
7. การยืนยันจำนวนจัดสร้างเหรียญก่อนเปิดแสดง
