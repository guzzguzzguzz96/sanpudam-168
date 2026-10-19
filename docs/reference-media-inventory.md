# บัญชีสื่อจากเว็บไซต์อ้างอิง (Reference Media Inventory)

**Phase:** 02.5.1 — Reference Website Asset Discovery
**วันที่สำรวจ:** 19 ตุลาคม 2569 (2026-10-19)
**เว็บไซต์อ้างอิง:** https://sanpudam168.1d1d.workers.dev/
**สถานะ:** บัญชีสำหรับเตรียมการเท่านั้น ยังไม่มีการดาวน์โหลดเพื่อนำไปใช้ ไม่มีการอัปโหลดไป Cloudinary และไม่มีการเขียนข้อมูลลง MongoDB

ข้อมูลเชิงโครงสร้างฉบับเต็มอยู่ใน [`reference-media-manifest.json`](reference-media-manifest.json) ซึ่งเป็นแหล่งข้อมูลหลักสำหรับสคริปต์นำเข้าในอนาคต เอกสารนี้สรุปผลสำหรับผู้ตรวจสอบ

## 1. ขอบเขตและวิธีการ

- อ่าน `robots.txt` ก่อน: อนุญาต `/` และห้าม `/admin` กับ `/api/` การสำรวจนี้ไม่เข้าถึงสองเส้นทางดังกล่าว รวมถึงไม่ส่งฟอร์มติดต่อ (`POST /api/contact`)
- ใช้ `sitemap.xml` (13 URL) และติดตามลิงก์ภายในที่เป็นสาธารณะ พบหน้าเพิ่มเติมคือหน้าหมวดหมู่ `/sakkara?cat=…` 3 หน้า ไม่พบหน้ารายละเอียดที่ไม่อยู่ใน sitemap
- ตรวจ `<img src>`, `srcset`, `<picture>/<source>`, `<video>`, `<iframe>`, Open Graph/Twitter image, `<link rel="icon">`, ภาพพื้นหลังใน CSS (`/css/site.css` และ inline style), ลิงก์เปิดภาพใหญ่ในแกลเลอรี, JSON-LD และไฟล์ JavaScript (`/js/boot.js`, `/js/site.js`) เพื่อหาภาพที่โหลดแบบไดนามิก
- เว้นระยะคำขอประมาณ 0.8–1 วินาทีต่อคำขอ และระบุ User-Agent ว่าเป็นการสำรวจเพื่อย้ายข้อมูล
- ไฟล์สื่อถูกอ่าน **ในหน่วยความจำเท่านั้น** เพื่อหา MIME type ขนาดไฟล์ มิติภาพ SHA-256 และ perceptual hash (dHash 64 บิต ด้วย `sharp` ที่ติดตั้งมากับ Next.js อยู่แล้ว) ไม่มีการบันทึกไฟล์ภาพลงดิสก์
- CSP ของเว็บไซต์อ้างอิงกำหนด `img-src 'self' data: blob:` ภาพทั้งหมดจึงโฮสต์อยู่บนโดเมนเดียวกัน (`/img/…` และไฟล์ไอคอนที่ราก)

## 2. สรุปตัวเลข

| รายการ | จำนวน |
|---|---:|
| หน้าเว็บสาธารณะที่ตรวจ (13 จาก sitemap + 3 หน้าหมวดหมู่) | 16 |
| การอ้างอิงสื่อทั้งหมด (img, srcset, og/twitter image, icon, ลิงก์ภาพใหญ่) | 343 |
| URL สื่อที่ไม่ซ้ำ | 34 |
| ไฟล์ต้นฉบับ (master) ที่ควรพิจารณานำเข้า | 17 |
| ไฟล์อนุพันธ์ (ย่อขนาด/ไอคอน) ที่ไม่ต้องนำเข้า | 17 |
| กลุ่มไฟล์ซ้ำแบบไบต์ตรงกัน (SHA-256) | 0 |
| ภาพถ่ายที่ไม่ซ้ำกันจริง | 15 |

ภาพพื้นหลัง CSS: ไม่พบ (`site.css` ไม่มี `url()`) ภาพที่โหลดผ่าน JavaScript: ไม่พบ วิดีโอ: ไม่พบ (ส่วน "วิดีโอแนะนำ" ในหน้าแรกเป็นข้อความรอคลิป)

## 3. ผลการตรวจโลโก้

- **รูปแบบ:** โลโก้เป็น **การประกอบกันของหลายองค์ประกอบ** คือภาพ raster **PNG** `/img/logo-192.png` (192×192 px, 45 KB, ไม่มีพื้นหลังโปร่งใส) วางคู่กับ **ข้อความ HTML** สองบรรทัด "ศาลปู่ดำ168" และ "และตราแผ่นดิน" (ฟอนต์ IBM Plex Sans Thai) ไม่ใช่ SVG และไม่ใช่กราฟิก inline
- ภาพโลโก้ใช้ `alt=""` เพราะชื่อศาลอยู่ในข้อความข้างเคียงและใน `aria-label` ของลิงก์
- `favicon.png` (48×48) และ `apple-touch-icon.png` (180×180) เป็นภาพเดียวกับโลโก้ในขนาดต่างกัน (dHash ห่าง 1–2 จาก 64 บิต) จึงจัดเป็นไฟล์อนุพันธ์
- JSON-LD ระบุ `logo` เป็นไฟล์เดียวกันนี้
- โลโก้มีความคล้ายภาพองค์ปู่ดำ (`pu-dam-168-statue.webp`) ในระดับปานกลาง (dHash ห่าง 9–11) อาจสร้างจากภาพถ่ายองค์ปู่ดำ ต้องยืนยันด้วยตาและกับเจ้าของ
- **ข้อจำกัดสำคัญ:** ไฟล์ที่ใหญ่ที่สุดมีขนาดเพียง 192×192 px ไม่เพียงพอสำหรับส่วนหัวความละเอียดสูง งานพิมพ์ หรือภาพแชร์ ต้องขอไฟล์ต้นฉบับความละเอียดสูงหรือเวกเตอร์จากเจ้าของ **ห้ามสร้างหรือดัดแปลงโลโก้ใหม่เอง**

## 4. ไฟล์ต้นฉบับ 17 รายการ

สถานะสิทธิ์ของทุกรายการคือ **รอเจ้าของยืนยัน** (`pending_owner_confirmation`) และสถานะอนุมัตินำเข้าคือ **รอ** (`pending`)

| ID | ไฟล์ต้นทาง | ประเภท | มิติ (px) | ขนาด | หน้าที่ใช้ | หมวด | Cloudinary public ID ที่เสนอ |
|---|---|---|---|---:|---:|---|---|
| `brand-logo-mark` | `/img/logo-192.png` | PNG | 192×192 | 45 KB | 16 | branding | `sanpudam168/brand/logo-mark` |
| `brand-og-default` | `/img/og-default.jpg` | JPEG | 1200×630 | 168 KB | 8 | branding | `sanpudam168/brand/og-default` |
| `shrine-pu-dam-168-statue` | `/img/pu-dam-168-statue.webp` | WebP | 1254×1254 | 172 KB | 10 | สิ่งศักดิ์สิทธิ์ | `sanpudam168/shrine/sacred-objects/pu-dam-168-statue` |
| `shrine-tra-phaendin-coat-of-arms` | `/img/tra-phaendin-coat-of-arms.webp` | WebP | 1066×1600 | 327 KB | 11 | สิ่งศักดิ์สิทธิ์ | `sanpudam168/shrine/sacred-objects/tra-phaendin-coat-of-arms` |
| `shrine-interior-altar` | `/img/shrine-interior-altar.webp` | WebP | 1600×1066 | 247 KB | 9 | สถานที่ (ภายใน) | `sanpudam168/shrine/interior/interior-altar` |
| `shrine-front-entrance` | `/img/shrine-front-entrance.webp` | WebP | 1600×1066 | 231 KB | 5 | สถานที่ (ภายนอก) | `sanpudam168/shrine/exterior/front-entrance` |
| `shrine-signboard-side` | `/img/shrine-signboard-side.webp` | WebP | 1600×1066 | 211 KB | 2 | สถานที่ (ภายนอก) | `sanpudam168/shrine/exterior/signboard-side` |
| `surroundings-phraratchawang-police-station` | `/img/phraratchawang-police-station.webp` | WebP | 1600×1066 | 144 KB | 2 | สภาพแวดล้อม | `sanpudam168/shrine/surroundings/phraratchawang-police-station` |
| `item-coin-charoenlap-charoenyot-poster` | `/img/pu-dam-coin-charoenlap-charoenyot.webp` | WebP | 1600×1131 | 224 KB | 7 | วัตถุมงคล | `sanpudam168/sacred-items/coin-charoenlap-charoenyot/poster` |
| `editorial-tra-phaendin-infographic` | `/img/tra-phaendin-infographic.webp` | WebP | 1131×1600 | 229 KB | 5 | บทความ/อินโฟกราฟิก | `sanpudam168/editorial/infographics/tra-phaendin-infographic` |
| `event-2569-03-16-newsletter-a` | `/img/newsletter-ceremony-2569-a.webp` | WebP | 1131×1600 | 340 KB | 5 | กิจกรรม | `sanpudam168/events/2569-03-16-tra-phaendin-ceremony-newsletter-a` |
| `event-2569-03-16-newsletter-b` | `/img/newsletter-ceremony-2569-b.webp` | WebP | 1131×1600 | 368 KB | 1 | กิจกรรม | `sanpudam168/events/2569-03-16-tra-phaendin-ceremony-newsletter-b` |
| `event-officer-paying-respect` | `/img/officer-paying-respect-coat-of-arms.webp` | WebP | 1567×1045 | 439 KB | 2 | กิจกรรม | `sanpudam168/events/officer-paying-respect-coat-of-arms` |
| `event-monks-holy-water` | `/img/monks-holy-water-coat-of-arms.webp` | WebP | 1600×1066 | 436 KB | 5 | กิจกรรม | `sanpudam168/events/monks-holy-water-coat-of-arms` |
| `event-monk-blessing-ceremony` | `/img/monk-blessing-ceremony.webp` | WebP | 1600×1068 | 159 KB | 1 | กิจกรรม | `sanpudam168/events/monk-blessing-ceremony` |
| `event-monk-blessing-devotees` | `/img/monk-blessing-devotees.webp` | WebP | 1600×1066 | 273 KB | 2 | กิจกรรม | `sanpudam168/events/monk-blessing-devotees` |
| `shrine-devotee-at-coat-of-arms` | `/img/devotee-at-coat-of-arms.webp` | WebP | 1108×1477 | 76 KB | 1 | บุคคลในศาล | `sanpudam168/shrine/devotees/devotee-at-coat-of-arms` |

ไฟล์ WebP ทั้งหมดเป็นแบบ lossy ไม่มีช่องโปร่งใส ความยาวด้านยาวสุดประมาณ 1,600 px ซึ่งน่าจะเป็นไฟล์ที่ถูกย่อและแปลงแล้ว ไม่ใช่ไฟล์จากกล้องโดยตรง หากเจ้าของมีไฟล์ต้นฉบับที่ใหญ่กว่า ควรนำเข้าไฟล์ต้นฉบับแทน

### การใช้งานปัจจุบัน การใช้ในอนาคต และการเชื่อมโยง MongoDB

| ID | การใช้งานปัจจุบันบนเว็บอ้างอิง | การใช้ที่เสนอในระบบใหม่ | การเชื่อมโยง MongoDB ที่เสนอ |
|---|---|---|---|
| `brand-logo-mark` | โลโก้ส่วนหัวและส่วนท้ายทุกหน้า, JSON-LD `logo` | โลโก้เว็บไซต์ ไอคอน และ Organization logo | `site_settings.branding.logoAssetId` |
| `brand-og-default` | `og:image`/`twitter:image` ของหน้ารวม 8 หน้า, JSON-LD `image` | ภาพแชร์โซเชียลเริ่มต้น | `site_settings.seo.defaultOgImageAssetId` |
| `shrine-pu-dam-168-statue` | การ์ดและหน้ารายละเอียดองค์ปู่ดำ, หน้าประวัติ, แกลเลอรี | ภาพหลัก `/sakkara/pu-dam-168`, ประวัติ, แกลเลอรี | `sacred_items[pu-dam-168]`, `galleries[shrine-main]`, `pages[history]` |
| `shrine-tra-phaendin-coat-of-arms` | การ์ดและหน้ารายละเอียดตราแผ่นดิน, ประวัติ, บทความความรู้, แกลเลอรี | ภาพหลัก `/sakkara/tra-phaendin-siam`, ประวัติ, แกลเลอรี | `sacred_items[tra-phaendin-siam]`, `pages[history]`, `news[know-tra-phaendin-siam].gallery`, `galleries[shrine-main]` |
| `shrine-interior-altar` | สไลด์ที่ 1 ของแบนเนอร์หน้าแรก, ภาพหลวงปู่ศิลา, แกลเลอรี | แบนเนอร์, ภาพหลวงปู่ศิลา, แกลเลอรี | `banners[home-hero]`, `sacred_items[luang-pu-sila]`, `galleries[shrine-main]` |
| `shrine-front-entrance` | สไลด์ที่ 2, จุดเช็กอินซุ้มประตู, ส่วนการเดินทาง, แกลเลอรี | แบนเนอร์, จุดเช็กอิน, หน้าเยี่ยมชม | `banners[home-hero]`, `sacred_items[shrine-gate]`, `pages[visit]`, `galleries[shrine-main]` |
| `shrine-signboard-side` | สไลด์ที่ 3, แกลเลอรี | แบนเนอร์ หรือแกลเลอรี | `banners[home-hero]`, `galleries[shrine-main]` |
| `surroundings-phraratchawang-police-station` | สไลด์ที่ 4, แกลเลอรี | ภาพประกอบการเดินทาง | `pages[visit]`, `galleries[shrine-main]` |
| `item-coin-charoenlap-charoenyot-poster` | การ์ดและหน้ารายละเอียดเหรียญ, ส่วนแนะนำในหน้าแรก | ภาพหลักของเหรียญ | `sacred_items[coin-charoenlap-charoenyot]` |
| `editorial-tra-phaendin-infographic` | ภาพปกบทความความรู้ตราแผ่นดิน | ภาพปกบทความ | `news[know-tra-phaendin-siam].coverImage` |
| `event-2569-03-16-newsletter-a` | ภาพปกข่าวพิธีบวงสรวง 16 มี.ค. 2569 | ภาพปกข่าว | `news[tra-phaendin-ceremony-2569].coverImage` |
| `event-2569-03-16-newsletter-b` | ภาพประกอบในข่าวพิธีบวงสรวง | ภาพประกอบข่าว | `news[tra-phaendin-ceremony-2569].gallery` |
| `event-officer-paying-respect` | ภาพประกอบข่าวพิธีบวงสรวง, แกลเลอรี | ภาพประกอบข่าว, แกลเลอรี | `news[tra-phaendin-ceremony-2569].gallery`, `galleries[shrine-main]` |
| `event-monks-holy-water` | ภาพปกข่าวพระสงฆ์ประพรมน้ำพระพุทธมนต์, แกลเลอรี | ภาพปกข่าว, แกลเลอรี | `news[monks-blessing-ceremony].coverImage`, `galleries[shrine-main]` |
| `event-monk-blessing-ceremony` | ภาพประกอบในข่าวพระสงฆ์ให้พร | ภาพประกอบข่าว | `news[monks-blessing-ceremony].gallery` |
| `event-monk-blessing-devotees` | ภาพประกอบในข่าวพระสงฆ์ให้พร, แกลเลอรี | ภาพประกอบข่าว, แกลเลอรี | `news[monks-blessing-ceremony].gallery`, `galleries[shrine-main]` |
| `shrine-devotee-at-coat-of-arms` | แกลเลอรีหน้าเยี่ยมชม | แกลเลอรีบรรยากาศ | `galleries[shrine-main]` |

### ข้อความ alt และคำบรรยายจากต้นทาง

ภาพเดียวกันมีข้อความ alt ต่างกันตามตำแหน่งที่ใช้ ระบบใหม่ควรเก็บ alt หลักหนึ่งค่าใน `media_assets` และให้แต่ละตำแหน่งกำหนด alt เฉพาะได้ (override) ตัวเลือกทั้งหมดอยู่ใน manifest ฟิลด์ `sourceAltTexts`

| ID | จำนวน alt | ตัวอย่าง alt ที่ละเอียดที่สุด | คำบรรยาย (figcaption) |
|---|---:|---|---|
| `brand-logo-mark` | 0 | (`alt=""` เพราะเป็นภาพประกอบชื่อ) | — |
| `brand-og-default` | 1 | ซุ้มประตูศาลปู่ดำ ตราแผ่นดิน (`og:image:alt`) | — |
| `shrine-pu-dam-168-statue` | 3 | องค์ปู่ดำ 168 ประทับนั่งขัดสมาธิบนแท่นสีแดงทอง มีตราแผ่นดินด้านหลัง | องค์ปู่ดำ 168 |
| `shrine-tra-phaendin-coat-of-arms` | 4 | ตราแผ่นดินสยามประดับกระจกสีทองเขียวแดง บนผนังกระเบื้องลายทอง | ตราแผ่นดินสยาม / ตราแผ่นดินสยามภายในศาลปู่ดำ |
| `shrine-interior-altar` | 3 | โถงสักการะภายในศาล ตราแผ่นดินตรงกลาง ศาลไม้สองข้าง และรูปเหมือนหลวงปู่ศิลาด้านขวา | โถงสักการะภายในศาล |
| `shrine-front-entrance` | 3 | ซุ้มประตูศาลสีเหลืองครีม ประดับลายไทยสีทอง มีป้ายชื่อศาลปู่ดำ ตราแผ่นดิน | ซุ้มประตูหน้าศาล |
| `shrine-signboard-side` | 2 | ป้ายศาลปู่ดำ ตราแผ่นดิน สน.พระราชวัง ด้านข้างอาคารศาล | ป้ายศาลด้านข้างอาคาร |
| `surroundings-phraratchawang-police-station` | 2 | อาคารสถานีตำรวจนครบาลพระราชวัง ถนนมหาราช | สถานีตำรวจนครบาลพระราชวัง |
| `item-coin-charoenlap-charoenyot-poster` | 1 | โปสเตอร์เหรียญบารมีปู่ดำ รุ่นเจริญลาภ เจริญยศ แสดงเหรียญ 8 เนื้อ พร้อมจำนวนจัดสร้าง | — |
| `editorial-tra-phaendin-infographic` | 1 | อินโฟกราฟิกอธิบายความหมายของแต่ละส่วนบนตราแผ่นดินสยาม | — |
| `event-2569-03-16-newsletter-a` | 1 | จดหมายข่าวศาลปู่ดำ ตราแผ่นดิน ฉบับวันที่ 16 มีนาคม 2569 พิธีบวงสรวงตราแผ่นดิน | — |
| `event-2569-03-16-newsletter-b` | 1 | จดหมายข่าวพิธีบวงสรวงตราแผ่นดิน ภาพข้าราชการตำรวจกราบสักการะ | (เหมือน alt) |
| `event-officer-paying-respect` | 2 | ข้าราชการตำรวจปิดทองพระบรมรูปหน้าตราแผ่นดิน | ข้าราชการตำรวจปิดทองพระบรมรูปหน้าตราแผ่นดิน / ข้าราชการตำรวจร่วมสักการะ |
| `event-monks-holy-water` | 2 | พระสงฆ์ประพรมน้ำพระพุทธมนต์ที่ตราแผ่นดินภายในศาล | พิธีประพรมน้ำพระพุทธมนต์ |
| `event-monk-blessing-ceremony` | 1 | พระสงฆ์นั่งให้พรข้าราชการและแขกผู้มีเกียรติภายในศาล | (เหมือน alt) |
| `event-monk-blessing-devotees` | 2 | พระสงฆ์ผูกสายสิญจน์ให้ผู้ศรัทธาที่พนมมือรับพร | พระสงฆ์ผูกสายสิญจน์ให้ผู้ศรัทธาที่พนมมือรับพร / พระสงฆ์ให้พร |
| `shrine-devotee-at-coat-of-arms` | 1 | ผู้ศรัทธาสักการะตราแผ่นดิน | ผู้ศรัทธามาสักการะ |

## 5. ไฟล์อนุพันธ์ 17 รายการ (ไม่ต้องนำเข้า)

| ไฟล์อนุพันธ์ | มาจาก | มิติ | เหตุผล |
|---|---|---|---|
| `favicon.png` | `logo-192.png` | 48×48 | สร้างใหม่จากโลโก้ต้นฉบับ |
| `apple-touch-icon.png` | `logo-192.png` | 180×180 | สร้างใหม่จากโลโก้ต้นฉบับ |
| `*-800.webp` (15 ไฟล์) | ไฟล์ชื่อเดียวกันที่ไม่มี `-800` | กว้าง 800 px | ไฟล์ย่อสำหรับ `srcset` (descriptor `800w`) ใช้ Cloudinary transformation และ `next/image` สร้างขนาดตามต้องการแทน |

ไฟล์ `-800` ทุกไฟล์มี dHash ห่างจากต้นฉบับ 0–2 จาก 64 บิต ยืนยันว่าเป็นภาพเดียวกันที่ย่อขนาด แม้ SHA-256 จะต่างกัน

## 6. การตรวจหาไฟล์ซ้ำ

- **SHA-256:** ไม่มีไฟล์ใดซ้ำกันแบบไบต์ตรงกัน
- **Perceptual hash (dHash):** ตรวจพบความคล้ายดังนี้

| คู่ไฟล์ | ระยะห่าง (จาก 64) | การตีความ | การดำเนินการ |
|---|---:|---|---|
| ต้นฉบับ ↔ `-800` ทั้ง 15 คู่ | 0–2 | ภาพเดียวกันต่างขนาด | นำเข้าเฉพาะต้นฉบับ |
| `logo-192.png` ↔ `favicon.png` ↔ `apple-touch-icon.png` | 1–2 | เครื่องหมายเดียวกันต่างขนาด | นำเข้าเฉพาะโลโก้ (และขอไฟล์ความละเอียดสูง) |
| `og-default.jpg` ↔ `shrine-front-entrance.webp` | 7 | น่าจะเป็นภาพครอปของซุ้มประตู (`og:image:alt` ตรงกัน) | ตรวจด้วยตา หากเป็นภาพเดียวกัน ให้ใช้ Cloudinary ครอปจากต้นฉบับแทน |
| `newsletter-ceremony-2569-a` ↔ `-b` | 5–6 | รูปแบบจดหมายข่าวเดียวกัน น่าจะเป็นคนละหน้า | ตรวจด้วยตา |
| `logo-192.png` ↔ `pu-dam-168-statue.webp` | 9–11 | คล้ายปานกลาง โลโก้อาจสร้างจากภาพองค์ปู่ดำ | ยืนยันกับเจ้าของ |

ภาพเดียวกันถูกใช้ซ้ำหลายหน้า (เช่น ภาพองค์ปู่ดำ 26 การอ้างอิงใน 10 หน้า) ระบบใหม่ต้องเก็บไฟล์เพียงครั้งเดียวและอ้างอิงด้วย ID

## 7. องค์ประกอบที่ไม่ใช่ไฟล์ภาพ (ไม่นำเข้า)

| องค์ประกอบ | รายละเอียด | ข้อเสนอ |
|---|---|---|
| ไอคอน SVG แบบ inline: LINE, Facebook, TikTok, YouTube | โลโก้ของแพลตฟอร์มภายนอก เป็นเครื่องหมายการค้าของบุคคลที่สาม | ไม่นำเข้า ใช้ไฟล์ทางการตามแนวทางแบรนด์ของแต่ละแพลตฟอร์มเมื่อยืนยันบัญชีแล้ว |
| SVG `intro-lotus` และชุดไอคอน `ic` | กราฟิกตกแต่งของธีมเว็บอ้างอิง | ไม่นำเข้า ระบบใหม่มีชุดไอคอนของตนเอง (`src/components/ui/icons.js`) |
| Google Maps iframe ในหน้า `/visit` | แผนที่ฝังจาก `google.com/maps?q=…` ไม่ใช่ไฟล์สื่อ | ไม่ฝังจนกว่าเจ้าของยืนยันตำแหน่ง (ตามนโยบายใน `information-architecture.md`) |
| ฟอนต์ IBM Plex Sans Thai | โหลดจาก Google Fonts | ไม่ใช้ ระบบใหม่ใช้ Noto Sans Thai / Noto Sans Thai Looped |

## 8. สื่อที่ต้องตรวจสิทธิ์ (ทั้ง 17 รายการ)

ทุกไฟล์ต้องให้เจ้าของยืนยันผู้ถ่ายภาพหรือผู้จัดทำ และสิทธิ์การนำไปใช้ซ้ำก่อนนำเข้า รายการที่มีประเด็นเพิ่มเติม:

1. **ภาพบุคคลที่ระบุตัวตนได้ (PDPA และความยินยอม):** `event-officer-paying-respect`, `event-monks-holy-water`, `event-monk-blessing-ceremony`, `event-monk-blessing-devotees`, `shrine-devotee-at-coat-of-arms`, `event-2569-03-16-newsletter-a`, `event-2569-03-16-newsletter-b` (จดหมายข่าวมีภาพเจ้าหน้าที่ระดับสูงและข้าราชการ)
2. **ภาพตราแผ่นดินและเครื่องหมายราชการ:** `shrine-tra-phaendin-coat-of-arms`, `editorial-tra-phaendin-infographic` และภาพที่เห็นตราเป็นองค์ประกอบหลัก ควรตรวจข้อกฎหมายการใช้เครื่องหมายราชการ โดยเฉพาะเมื่อแสดงคู่กับวัตถุมงคลที่เปิดให้บูชา
3. **อาคารหน่วยงานราชการ:** `surroundings-phraratchawang-police-station` ตรวจความเหมาะสมก่อนใช้เป็นภาพแบนเนอร์
4. **ภาพที่มีข้อความเชิงข้อเท็จจริงอยู่ในภาพ:** โปสเตอร์เหรียญ (จำนวนจัดสร้าง), อินโฟกราฟิก (ข้อมูลประวัติศาสตร์), จดหมายข่าว (ข้อมูลข่าว) ต้องตรวจทานข้อความในภาพ เพราะแก้ไขผ่าน CMS ไม่ได้
5. **ผลงานที่อาจเป็นของบุคคลที่สาม:** อินโฟกราฟิกและจดหมายข่าว ต้องยืนยันผู้จัดทำ
6. **โลโก้:** ยืนยันสิทธิ์ในเครื่องหมายและขอไฟล์ต้นฉบับความละเอียดสูง
7. **ความเหมาะสมทางศาสนา:** ภาพองค์ปู่ดำและพระสงฆ์ ควรให้ผู้ดูแลศาลยืนยันความเหมาะสมในการเผยแพร่และตัดต่อภาพ (ครอป)

## 9. ข้อจำกัดของการสำรวจ

- สำรวจเฉพาะหน้าที่เข้าถึงได้แบบสาธารณะ ไม่รวม `/admin`, `/api/` และคำค้นหาแบบอิสระ (`/sakkara?q=…`)
- ข้อมูล HTTP `Last-Modified` และ `ETag` ของไฟล์บนเว็บอ้างอิงไม่สามารถใช้ระบุวันที่ถ่ายภาพได้
- ผลการเปรียบเทียบด้วย perceptual hash เป็นการคัดกรองเบื้องต้น ยังไม่ได้เปิดดูภาพด้วยตา เพราะยังไม่ได้รับอนุมัติให้ดาวน์โหลดไฟล์
- เว็บไซต์อ้างอิงอาจเปลี่ยนแปลงหลังวันที่สำรวจ สคริปต์นำเข้าต้องตรวจ SHA-256 กับ manifest ก่อนนำเข้าทุกครั้ง
