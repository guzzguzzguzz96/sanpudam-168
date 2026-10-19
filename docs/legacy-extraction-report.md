# รายงานการสกัดข้อมูลจากระบบเดิม (Legacy Extraction Report)

**Phase:** 02.5.3 — Authorized Legacy Media & Content Extraction
**วันที่:** 19 ตุลาคม 2569 (2026-10-19)
**สถานะ:** สกัดข้อมูลและ dry-run เสร็จแล้ว **ยังไม่ได้อัปโหลด Cloudinary และยังไม่ได้เขียน MongoDB** รอการอนุมัติก่อนเข้าสู่ขั้นนำเข้า

รายละเอียด: [`media-extraction-results.md`](media-extraction-results.md) · [`content-extraction-results.md`](content-extraction-results.md) · วิธีใช้สคริปต์: [`../migration/README.md`](../migration/README.md)

## 1. การอนุญาตและขอบเขต

- เจ้าของเว็บไซต์เดิมอนุญาตอย่างชัดเจนให้เข้าถึง สกัด ดาวน์โหลด ย้าย และนำสื่อและเนื้อหาไปใช้ซ้ำ ครอบคลุมโลโก้ ภาพศาล แบนเนอร์ ภาพวัตถุมงคล ภาพข่าว แกลเลอรี สื่ออื่นที่ได้รับอนุญาต และเนื้อหา/metadata ของ CMS
- แหล่งข้อมูลที่ใช้: หน้าเว็บสาธารณะ และ Admin UI ที่ผู้ใช้ลงชื่อเข้าใช้เอง ไม่ได้ขอ source code, backup หรือ export จากผู้พัฒนาเดิม
- ไม่ได้แก้ไขเว็บไซต์เดิม ไม่ได้ข้ามการยืนยันตัวตนหรือสิทธิ์

## 2. วิธีการ

### 2.1 สื่อจากหน้าเว็บสาธารณะ

- ใช้ `docs/reference-media-manifest.json` (17 ไฟล์ต้นฉบับ) เป็นรายการตั้งต้น
- ดาวน์โหลดด้วย `migration/scripts/download-public-media.mjs`: GET เท่านั้น เว้นระยะประมาณ 0.8 วินาทีต่อคำขอ retry สูงสุด 3 ครั้ง ปฏิเสธ `/admin` และ `/api/`
- ตรวจ magic bytes ว่าเป็นไฟล์ภาพจริง วัดมิติด้วย `sharp` (มากับ Next.js อยู่แล้ว) คำนวณ SHA-256, MD5 และ dHash และเทียบ SHA-256 กับบัญชีของ Phase 02.5.1

### 2.2 Admin CMS

- เปิด Chrome หน้าต่างแยกด้วย profile ชั่วคราว (`admin-browser.mjs`) **ผู้ใช้ลงชื่อเข้าใช้เอง** ไม่มีการขอหรือส่งรหัสผ่านผ่านแชต
- `capture-admin.mjs` เปลี่ยน hash route ตามเมนูที่มีเอกสาร (`#/c/<module>` และหน้าแก้ไขรายการแรกของแต่ละโมดูล) แล้วเก็บ JSON จากคำขอ **GET ที่ Admin UI เรียกเอง**
- พบว่า UI ใช้ `GET /api/admin/items?collection=<module>`, `GET /api/admin/items/<id>`, `GET /api/admin/placeholders`, `GET /api/admin/health`, `GET /api/admin/dashboard` สคริปต์ **ไม่ได้เรียก endpoint เหล่านี้เอง** เพียงสังเกตผลที่ UI โหลด
- คำขอที่สังเกตได้ทั้งหมด 36 รายการ เป็น GET ทั้งหมด (ไม่มี POST/PUT/DELETE)
- หลังสกัดเสร็จ ปิดเบราว์เซอร์และลบ profile ชั่วคราวแล้ว (`--cleanup`) จึงไม่มี session cookie ค้างบนดิสก์

### 2.3 มาตรการความปลอดภัย

| มาตรการ | รายละเอียด |
|---|---|
| ไม่อ่าน credential | ไม่เรียก `Network.getCookies`/Storage API ไม่บันทึก request header (สคริปต์บล็อกคำสั่ง CDP ที่เกี่ยวกับ cookie) |
| ไม่ส่งคำขอเอง | ไม่ replay ไม่แก้คำขอ ไม่เดา endpoint ไม่ไล่หา resource ที่เข้าถึงไม่ได้ |
| ไม่เก็บ HAR | บันทึกเฉพาะ method, path, status, content type ใน `migration/reports/admin-network.json` |
| Redaction | ลบ key ที่เกี่ยวกับ password, token, secret, session, cookie, auth, credential, email, IP และ user agent จาก JSON ทุกชั้น |
| เมนูที่ไม่เข้า | `#/messages` (ข้อความส่วนบุคคล), `#/account` (รหัสผ่าน), `#/log` (ประวัติการแก้ไข) |
| Dashboard | ตัดรายการ "แก้ไขล่าสุด" (ชื่อผู้แก้ ค่าก่อน/หลัง) ทิ้ง |
| Analytics | ค่า GA4 / Google Ads / Facebook Pixel ถูกแทนด้วย `{ scrubbed: true, wasSet }` (ระบบเดิมไม่ได้กรอกค่าไว้ทั้งสามช่อง) |
| ไม่แตะบริการจริง | ไม่อ่าน `.env.local` ไม่เชื่อมต่อ MongoDB ไม่อัปโหลด Cloudinary |
| Git | `migration/` ทั้งหมดยกเว้น `README.md` และ `scripts/` อยู่ใน `.gitignore` ไม่มีไฟล์สื่อหรือเนื้อหาที่สกัดถูก commit |

## 3. สรุปผล

| หัวข้อ | ผล |
|---|---|
| สิทธิ์เข้าถึง Admin | เข้าถึงได้ ผู้ใช้ลงชื่อเข้าใช้เองในหน้าต่างแยก |
| สื่อที่พบ (URL ไม่ซ้ำ) | 34 URL = ต้นฉบับ 17 + อนุพันธ์ 17 |
| ต้นฉบับที่ดาวน์โหลด | 17 ไฟล์ 4.0 MB SHA-256 ตรงกับบัญชี 02.5.1 ทุกไฟล์ |
| สื่อที่มีเฉพาะใน Admin | **ไม่พบ** สื่อทุกรายการที่ CMS อ้างอิงอยู่ใน 34 URL ที่รู้จักแล้ว |
| โลโก้ | มีเพียง `/img/logo-192.png` (192×192) ไม่อยู่ใน CMS และไม่พบไฟล์ที่ใหญ่กว่า |
| ไฟล์ซ้ำแบบไบต์ | 0 |
| เรคอร์ดเนื้อหา | 39 (ตรงกับจำนวนที่คาดไว้ทุกโมดูล) |
| ธง placeholder | 32 ฟิลด์ใน 16 เรคอร์ด (ตรงกับ Admin audit) |
| ความสัมพันธ์ที่ resolve ไม่ได้ | หมวดหมู่ 0, ไฟล์วิดีโอ 1 (ระบบเดิมไม่มีไฟล์) |
| Dry-run | 17 ไฟล์ที่จะอัปโหลด, 39 เรคอร์ดที่จะสร้าง, 1 error, 17 warning, 9 info |

## 4. คำถามจาก Phase 02.5.2 ที่ได้คำตอบ

| # | คำถาม (`legacy-data-mapping.md` §15) | คำตอบจากข้อมูลจริง |
|---:|---|---|
| 1 | export ข้อมูลได้หรือไม่ | ไม่ต้องใช้ ข้อมูลครบจาก Admin UI รวม legacy ID, `published`, `sort`, `placeholder` และ media reference |
| 2 | category selector ผิดพลาดเพราะอะไร | **ข้อมูลถูกต้อง** `sacredItems.category` เก็บ ID ของ category และ resolve ได้ครบ 5 รายการ ฟอร์มแก้ไขเรียก `items?collection=categories` สำเร็จ (HTTP 200) แต่ select มีเพียง "— เลือก —" จึงเป็น **ข้อผิดพลาดฝั่ง UI** (H1/H3) ไม่ใช่ foreign key ผิด (ตัด H2 และ H4 ออก) |
| 3 | path ของธง placeholder 32 ฟิลด์ | ได้ครบจากฟิลด์ `placeholder` ของแต่ละเรคอร์ด และตรงกับ `/api/admin/placeholders` (16 รายการ) |
| 4 | `type` ของแต่ละรายการ | `kind`: `place` 4 รายการ, `amulet` 1 รายการ (เหรียญ) `shrine-gate` เป็น `place` |
| 5 | รีวิวเป็นของจริงหรือไม่ | **เป็นข้อมูลตัวอย่าง** ทั้ง 3 รายการมีธง placeholder ที่ชื่อ ที่มา และข้อความ |
| 6 | ชื่อทีมงาน | รายการแรกเป็น placeholder ทั้งชื่อ บทบาท และประวัติ รายการที่สองมีธงที่ประวัติ ทั้งสองไม่มีรูป |
| 7 | ไฟล์วิดีโอ | ไม่มี (`video: null`) ชื่อและคำอธิบายเป็น placeholder |
| 8 | สเกล focal point | **เปอร์เซ็นต์ 0–100** (`fx`, `fy`) แปลงเป็น 0–1 และเก็บค่าดิบไว้ |
| 9 | ไฟล์ต้นฉบับที่ใหญ่กว่า | ไม่พบ ภาพที่ใหญ่สุดยาว 1,600 px และ `mobile` ใน CMS คือไฟล์ `-800` เดิม |
| 14 | "ราคา/การบูชา" มีราคาหรือไม่ | ไม่มี ค่าคือ "สอบถามราคาและสั่งจองทางไลน์" (เก็บตามต้นฉบับ แต่ฟิลด์นี้มีธง placeholder) |

คำถาม 10–13 (delete behaviour, จำนวนผู้ดูแลและ Auth.js provider, audit log archive, การใช้ analytics) ยังต้องให้เจ้าของตัดสินใจ

## 5. ความไม่สอดคล้องที่พบเพิ่ม

| # | ประเด็น | ผลกระทบ |
|---:|---|---|
| 1 | key จริงของระบบเดิมต่างจากชื่อที่ audit เสนอ (เช่น `kind` ไม่ใช่ `type`, `wish_for`, `price_note`, `on_home`, `fx`/`fy`) | สคริปต์ `build-content.mjs` ใช้ key จริง เอกสาร mapping ใช้ได้ตามเดิมในระดับความหมาย |
| 2 | ค่าไอคอนจริงคือ `briefcase`, `file-text`, `coins`, `crown` (ไม่ใช่ `document`, `coin` ที่คาดจากป้ายภาษาไทย) | ปรับ enum ใน `mongodb-schema-spec.md` แล้ว |
| 3 | ข่าวมีฟิลด์ `sort` แม้ UI เรียงตามวันที่ | เก็บไว้ใน `legacy.sortOrder` ไม่ใช้เรียงในระบบใหม่ |
| 4 | ข่าว `monks-blessing-ceremony` มีธง placeholder ที่หัวข้อ **วันที่** และเนื้อหา | วันที่ 2026-03-16 ของข่าวนี้ยังไม่ยืนยัน |
| 5 | ทุกเรคอร์ดมี `published: true` รวมถึงรีวิวตัวอย่างและวิดีโอที่ไม่มีไฟล์ (หน้าเว็บซ่อนเองเมื่อข้อมูลไม่ครบหรือเป็นตัวอย่าง) | ยืนยันนโยบายนำเข้าเป็น draft และไม่ใช้ `published` เป็นการอนุมัติ |
| 6 | ลิงก์แผนที่ใน settings คือ `share.google/…` | ไม่ผ่าน `getMapsUrl()` ปุ่มนำทางจะไม่แสดงจนกว่าจะได้ลิงก์รูปแบบที่รองรับ |

## 6. ไดเรกทอรีและสคริปต์

| ตำแหน่ง | สถานะ Git | เนื้อหา |
|---|---|---|
| `migration/README.md` | commit | วิธีใช้และกติกาความปลอดภัย |
| `migration/scripts/` | commit | `download-public-media.mjs`, `admin-browser.mjs`, `capture-admin.mjs`, `build-content.mjs`, `dry-run-report.mjs` และ `lib/` (`http.mjs`, `media.mjs`, `files.mjs`, `cdp.mjs`, `observe.mjs`) |
| `migration/assets/{branding,shrine,sacred-items,news,…}/` | ignored | ไฟล์ต้นฉบับ 17 ไฟล์ (`banners/`, `gallery/`, `pages/`, `other/` ว่าง เพราะภาพแบนเนอร์และแกลเลอรีเป็นไฟล์เดียวกับภาพศาล ไม่เก็บซ้ำ) |
| `migration/content/raw/` | ignored | JSON ที่ redact แล้วจาก Admin UI |
| `migration/content/*.json` | ignored | 11 collection ในรูปแบบเอกสารเป้าหมาย |
| `migration/manifests/` | ignored | `media-manifest.json`, `content-manifest.json` |
| `migration/reports/` | ignored | `dry-run.json`, `dry-run.md`, `admin-network.json` |

สคริปต์ทุกตัวรองรับการรันซ้ำ: ดาวน์โหลดซ้ำได้ผล 17 `unchanged`, dry-run ซ้ำได้ plan hash เดิม

## 7. ขั้นตอนถัดไป (ต้องได้รับอนุมัติก่อน)

1. อนุมัติการอัปโหลดสื่อ 17 ไฟล์ไป Cloudinary (staging) ตาม public ID ใน dry-run
2. อนุมัติให้เพิ่ม `mongoose` และเขียน 39 เรคอร์ดลง MongoDB (staging) เป็น `draft / pending_review`
3. ขอลิงก์ Google Maps รูปแบบ `maps.app.goo.gl` หรือ `google.com/maps` และให้เจ้าของยืนยันข้อมูลติดต่อในระบบใหม่
4. ตัดสินใจเรื่องรีวิว ทีมงาน และวิดีโอ ที่เป็นข้อมูลตัวอย่าง (นำเข้าเป็น draft แต่ไม่เผยแพร่)
5. ขอไฟล์โลโก้ความละเอียดสูงจากเจ้าของ (ถ้ามี) ห้ามขยายหรือวาดใหม่
