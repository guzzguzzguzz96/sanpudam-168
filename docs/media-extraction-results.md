# ผลการสกัดสื่อ (Media Extraction Results)

**Phase:** 02.5.3 — Authorized Legacy Media & Content Extraction
**วันที่:** 19 ตุลาคม 2569 (2026-10-19)
**แหล่งข้อมูลเต็ม (ไม่ commit):** `migration/manifests/media-manifest.json` · ไฟล์ภาพอยู่ใน `migration/assets/` (gitignored)

## 1. สรุป

| รายการ | จำนวน |
|---|---:|
| URL สื่อที่รู้จัก (หน้าเว็บ + Admin) | 34 |
| ไฟล์ต้นฉบับที่ดาวน์โหลด | 17 (4.0 MB) |
| ไฟล์อนุพันธ์ที่ไม่ดาวน์โหลด (`-800` 15 ไฟล์, favicon, apple-touch-icon) | 17 |
| ไฟล์ที่ดาวน์โหลดไม่สำเร็จ | 0 |
| SHA-256 ต่างจากบัญชี 02.5.1 (ไฟล์ต้นทางเปลี่ยน) | 0 |
| ไฟล์ซ้ำแบบไบต์ (SHA-256) | 0 |
| ไฟล์ที่ไม่ผ่านการตรวจ magic bytes | 0 |
| สื่อที่มีเฉพาะใน Admin | 0 |
| ไฟล์ที่มี EXIF | 0 |

ภาพทั้งหมดผ่านการตรวจว่า content-type ตรงกับ signature ของไฟล์ (WebP 15, PNG 1, JPEG 1)

## 2. สื่อที่ดาวน์โหลด

ลำดับตามความสำคัญที่กำหนด (โลโก้ → แบนเนอร์ → วัตถุมงคล/สิ่งศักดิ์สิทธิ์ → ภาพศาล → แกลเลอรี → ข่าว → บทความ → Open Graph) "ใช้ใน CMS" คือจำนวนจุดที่เรคอร์ดใน Admin อ้างอิงไฟล์นั้น

| ID | ไฟล์ในเครื่อง | มิติ | ขนาด | SHA-256 (16 ตัวแรก) | ใช้ใน CMS | โมดูลที่อ้างอิง | Cloudinary public ID ที่เสนอ |
|---|---|---|---:|---|---:|---|---|
| `brand-logo-mark` | `assets/branding/logo-192.png` | 192×192 | 45 KB | `bb67cc8baba9c30a` | 0 | — (ไฟล์คงที่นอก CMS) | `sanpudam168/brand/logo-mark` |
| `shrine-interior-altar` | `assets/shrine/shrine-interior-altar.webp` | 1600×1066 | 247 KB | `d0b3b75282d2ffe8` | 3 | banners, gallery, sacred | `sanpudam168/shrine/interior/interior-altar` |
| `shrine-front-entrance` | `assets/shrine/shrine-front-entrance.webp` | 1600×1066 | 231 KB | `64bb585e34967805` | 3 | banners, gallery, sacred | `sanpudam168/shrine/exterior/front-entrance` |
| `shrine-signboard-side` | `assets/shrine/shrine-signboard-side.webp` | 1600×1066 | 211 KB | `9697d6a4ffac411f` | 2 | banners, gallery | `sanpudam168/shrine/exterior/signboard-side` |
| `surroundings-phraratchawang-police-station` | `assets/shrine/phraratchawang-police-station.webp` | 1600×1066 | 144 KB | `a675822c61b7c6ca` | 2 | banners, gallery | `sanpudam168/shrine/surroundings/phraratchawang-police-station` |
| `shrine-pu-dam-168-statue` | `assets/shrine/pu-dam-168-statue.webp` | 1254×1254 | 172 KB | `e14d1739982437a5` | 3 | sacred, gallery, about | `sanpudam168/shrine/sacred-objects/pu-dam-168-statue` |
| `shrine-tra-phaendin-coat-of-arms` | `assets/shrine/tra-phaendin-coat-of-arms.webp` | 1066×1600 | 327 KB | `11fde69e7b0e7e83` | 4 | sacred, news, gallery, about | `sanpudam168/shrine/sacred-objects/tra-phaendin-coat-of-arms` |
| `item-coin-charoenlap-charoenyot-poster` | `assets/sacred-items/pu-dam-coin-charoenlap-charoenyot.webp` | 1600×1131 | 224 KB | `c1a4464667adbde7` | 1 | sacred | `sanpudam168/sacred-items/coin-charoenlap-charoenyot/poster` |
| `shrine-devotee-at-coat-of-arms` | `assets/shrine/devotee-at-coat-of-arms.webp` | 1108×1477 | 76 KB | `619e705267974456` | 1 | gallery | `sanpudam168/shrine/devotees/devotee-at-coat-of-arms` |
| `event-2569-03-16-newsletter-a` | `assets/news/newsletter-ceremony-2569-a.webp` | 1131×1600 | 340 KB | `a89b6b012dae6ed0` | 1 | news | `sanpudam168/events/2569-03-16-tra-phaendin-ceremony-newsletter-a` |
| `event-2569-03-16-newsletter-b` | `assets/news/newsletter-ceremony-2569-b.webp` | 1131×1600 | 368 KB | `dde9c280c4a54370` | 1 | news | `sanpudam168/events/2569-03-16-tra-phaendin-ceremony-newsletter-b` |
| `event-officer-paying-respect` | `assets/news/officer-paying-respect-coat-of-arms.webp` | 1567×1045 | 439 KB | `c20417bfd3ce3187` | 2 | news, gallery | `sanpudam168/events/officer-paying-respect-coat-of-arms` |
| `event-monks-holy-water` | `assets/news/monks-holy-water-coat-of-arms.webp` | 1600×1066 | 436 KB | `78ff846a0999f3cb` | 2 | news, gallery | `sanpudam168/events/monks-holy-water-coat-of-arms` |
| `event-monk-blessing-ceremony` | `assets/news/monk-blessing-ceremony.webp` | 1600×1068 | 159 KB | `75a33d141e9b0a94` | 1 | news | `sanpudam168/events/monk-blessing-ceremony` |
| `event-monk-blessing-devotees` | `assets/news/monk-blessing-devotees.webp` | 1600×1066 | 273 KB | `503d871a18a7862b` | 2 | news, gallery | `sanpudam168/events/monk-blessing-devotees` |
| `editorial-tra-phaendin-infographic` | `assets/news/tra-phaendin-infographic.webp` | 1131×1600 | 229 KB | `12bd9a9d780bee34` | 1 | news | `sanpudam168/editorial/infographics/tra-phaendin-infographic` |
| `brand-og-default` | `assets/branding/og-default.jpg` | 1200×630 | 168 KB | `61599f93299fc141` | 1 | settings (`og_image`) | `sanpudam168/brand/og-default` |

manifest ในเครื่องเก็บค่าเต็มของทุกฟิลด์ที่กำหนด: source URL, local path, ชื่อไฟล์เดิม, MIME, ขนาด, มิติ, SHA-256, MD5, dHash, โมดูลและเรคอร์ดที่อ้างอิง (legacy ID), Cloudinary public ID, MongoDB association, เวลาสกัด, สถานะ และปัญหาที่พบ

## 3. หมวดของสื่อ

| หมวด | จำนวน | ไฟล์ |
|---|---:|---|
| Branding | 2 | โลโก้, ภาพ Open Graph |
| สิ่งศักดิ์สิทธิ์ภายในศาล | 2 | องค์ปู่ดำ, ตราแผ่นดิน |
| สถานที่ (ภายใน/ภายนอก/สภาพแวดล้อม) | 4 | โถงสักการะ, ซุ้มประตู, ป้ายศาล, สน.พระราชวัง |
| วัตถุมงคล | 1 | โปสเตอร์เหรียญ |
| กิจกรรม/ข่าว | 6 | จดหมายข่าว 2 ฉบับ, ข้าราชการปิดทอง, พระสงฆ์ประพรมน้ำมนต์, พระสงฆ์ให้พร 2 ภาพ |
| บทความ (อินโฟกราฟิก) | 1 | ตราแผ่นดิน |
| บุคคลในศาล | 1 | ผู้ศรัทธาสักการะตราแผ่นดิน |

ไม่มีไฟล์ใดถูกเก็บซ้ำในโฟลเดอร์ `banners/` หรือ `gallery/` เพราะแบนเนอร์ 4 รายการและแกลเลอรี 10 รายการใช้ไฟล์เดียวกับภาพศาลและภาพกิจกรรม ความสัมพันธ์อยู่ใน `adminUsages` ของ manifest

## 4. ผลการตรวจหาไฟล์ซ้ำ

| ประเภท | ผล | การดำเนินการ |
|---|---|---|
| SHA-256 ตรงกัน | ไม่มี | — |
| `-800` กับต้นฉบับ (dHash 0–2) | 15 คู่ เป็นภาพเดียวกันที่ย่อขนาด ฟิลด์ `mobile` ใน CMS ชี้ไปที่ไฟล์เหล่านี้ | ไม่ดาวน์โหลด ใช้ Cloudinary transformation |
| favicon / apple-touch-icon กับโลโก้ (dHash 1–2) | โลโก้เดียวกันต่างขนาด | ไม่ดาวน์โหลด สร้างใหม่จากโลโก้ |
| `og-default.jpg` ~ `shrine-front-entrance` (dHash 7) | **ยืนยันด้วยตาแล้ว** เป็นภาพครอป 1200×630 จากภาพซุ้มประตู | **เก็บทั้งสองไฟล์** เพราะใช้ต่างวัตถุประสงค์ (ภาพแชร์ที่ CMS อ้างอิงใน `og_image`) บันทึกว่าเป็นครอปของ `shrine-front-entrance` |
| `newsletter-ceremony-2569-a` ~ `-b` (dHash 6) | **ยืนยันด้วยตาแล้ว** เป็นจดหมายข่าวหน้าเดียวกัน ต่างกันเฉพาะภาพมุมบนซ้าย (ฉบับ a เป็นภาพผู้ศรัทธา ฉบับ b เป็นภาพข้าราชการกราบ) | **เก็บทั้งสองไฟล์** เพราะข่าวใช้ทั้งคู่ (ปกและภาพประกอบ) ให้เจ้าของพิจารณาว่าต้องการแสดงทั้งสองฉบับหรือไม่ |

## 5. โลโก้

- ไฟล์เดียวที่เข้าถึงได้คือ `/img/logo-192.png` (PNG 192×192, 45 KB, **พื้นหลังขาว ไม่มีช่องโปร่งใส**)
- เป็นภาพประกอบองค์ปู่ดำนั่งบนบัลลังก์ใต้ตราแผ่นดิน มีป้าย "บารมีปู่ดำ 168" ที่ฐาน (ตรวจด้วยตาแล้ว) ข้อความชื่อศาลในส่วนหัวของเว็บเดิมเป็นข้อความ HTML ไม่ได้อยู่ในภาพ
- **ไม่มีฟิลด์โลโก้ใน CMS** (ทั้ง settings และโมดูลอื่น) และไม่มี URL โลโก้ขนาดอื่นในข้อมูล Admin หรือหน้าเว็บ จึง **ไม่พบไฟล์ความละเอียดสูงกว่า**
- ไม่ได้ขยาย (upscale) ไม่ได้ลบพื้นหลัง และไม่ได้วาดใหม่ ต้องขอไฟล์ต้นฉบับจากเจ้าของหากต้องการใช้ขนาดใหญ่

## 6. ข้อสรุปเรื่องความครบถ้วนของสื่อ

- ข้อมูล Admin อ้างอิงสื่อ 31 path (ต้นฉบับ 16 ไฟล์ + ไฟล์ `-800` 15 ไฟล์ในฟิลด์ `mobile`) ทั้งหมดอยู่ใน 34 URL ที่รู้จักแล้ว ส่วนที่ CMS ไม่อ้างอิงคือโลโก้ favicon และ apple-touch-icon ซึ่งเป็นไฟล์คงที่ของเว็บไซต์
- ไม่มีรูปทีมงาน (`photo: null` ทั้ง 2 รายการ) ไม่มีไฟล์วิดีโอ (`video: null`) ไม่มีภาพที่ไม่ได้เผยแพร่ และไม่มีไฟล์แนบของข่าวนอกเหนือจาก `photos`
- ดังนั้น **17 ไฟล์ต้นฉบับคือสื่อทั้งหมดของระบบเดิม** ไม่ใช่เพียงสื่อที่แสดงบนหน้าเว็บ
- ภาพที่ใหญ่ที่สุดยาว 1,600 px ไม่มีไฟล์ต้นฉบับจากกล้องในระบบ หากเจ้าของมีไฟล์ต้นฉบับที่ใหญ่กว่า ควรใช้แทนก่อนอัปโหลด

## 7. สิทธิ์และความยินยอม

เจ้าของอนุญาตการนำสื่อไปใช้ซ้ำแล้ว จึงอัปเดตได้ว่า `rights.status` มีหลักฐานการอนุญาตในระดับเว็บไซต์ แต่ประเด็นต่อไปนี้ยังต้องตัดสินใจก่อนเผยแพร่ (ไม่ได้ขัดขวางการอัปโหลดไป staging):

- ภาพบุคคลที่ระบุตัวตนได้ 7 ไฟล์ (ข้าราชการ พระสงฆ์ ผู้ศรัทธา และจดหมายข่าว) ต้องมีความยินยอมตาม PDPA
- ภาพตราแผ่นดินและเครื่องหมายราชการ
- ข้อความในภาพ (โปสเตอร์เหรียญที่มีจำนวนจัดสร้าง จดหมายข่าว อินโฟกราฟิก)
