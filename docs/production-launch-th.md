# คู่มือเปิดใช้งานจริง Sanpudam 168 (https://sanpudam168.com)

เอกสารนี้อธิบายขั้นตอนเปิดเว็บไซต์จริงตั้งแต่เตรียมฐานข้อมูล Production จนถึงงานหลังเปิด
ทุกขั้นที่ **เขียนข้อมูล / push / deploy / เปลี่ยน DNS** ต้องได้รับอนุมัติก่อนทุกครั้ง (ดู `AGENTS.md`)

- โดเมนหลัก (canonical): `https://sanpudam168.com` (ไม่มี www; `www` redirect ที่ Vercel)
- ฐานข้อมูล Production: `sanpudam168_production` (cluster เดียวกับ staging ได้)
- รูปภาพ: ใช้ไฟล์เดิมใน Cloudinary โฟลเดอร์ `sanpudam168/staging` (ไม่อัปโหลดซ้ำ)
- ไม่เผยแพร่รอบนี้: videos, reviews, team_members และไม่ย้าย migration_runs / admin_audit_log ของ staging

## 1. หลักการที่โค้ดบังคับไว้แล้ว

| เรื่อง | กฎ | ที่อยู่ในโค้ด |
|---|---|---|
| เนื้อหา Public | `status = published` + `review.status = approved` + ไม่มี placeholder ค้าง (ตรวจทั้งใน query และทุกเอกสาร) | `src/server/cms/policy.js` |
| รูป Public | `rights.status = approved` + `approval.status = approved` + ถ้ามีบุคคลที่จำหน้าได้ consent ต้องเป็น `obtained` | `src/server/cms/policy.js` |
| ปุ่มโทร / LINE / Maps / social | แสดงเฉพาะเมื่อ `contact.verified = true` (social: `verified = true`) และผ่าน validator; Maps มาจาก `site_settings.contact.directionsUrl` เท่านั้น | `src/server/review/homepage.js`, `src/server/site/pages.js` |
| การ index | index ได้เฉพาะ `VERCEL_ENV=production` **และ** `SITE_LAUNCHED=true` นอกนั้น noindex + robots.txt ปิดทั้งหมด + sitemap ว่าง | `src/lib/site-launch.js` |
| DB ผิดสภาพแวดล้อม | Production ปฏิเสธ DB ที่ชื่อมีคำว่า staging/test/dev; Preview ปฏิเสธ DB production | `src/lib/db.js` |
| Cache | ข้อมูล Public ใช้ `"use cache"` revalidate ทุก 5 นาที (หมดอายุ 1 วัน); ถ้า DB ล่ม cache 1 นาทีแล้วลองใหม่ | `src/server/site/public.js` |
| 404 | slug ที่ไม่มีคืน HTTP 404 ตั้งแต่ครั้งแรก (Partial Prefetching เปิดเฉพาะ review build) | `next.config.mjs`, `src/app/*/[slug]/page.js` |

## 2. MongoDB Atlas

### 2.1 ฐานข้อมูล
ไม่ต้องสร้างเองใน Atlas: สคริปต์ promotion สร้าง collection และ index ตาม `docs/mongodb-schema-spec.md`
ด้วย `createIndexes()` (แอปตั้ง `autoIndex: false` จึงไม่สร้างเอง) ชื่อฐานข้อมูลต้องเป็น `sanpudam168_production` เท่านั้น

### 2.2 ผู้ใช้ 2 คน (Database Access)

| ผู้ใช้ (ตัวอย่างชื่อ) | สิทธิ์ | ใช้ที่ | ตัวแปร |
|---|---|---|---|
| `sanpudam168_web_ro` | built-in role `read` บน `sanpudam168_production` **เท่านั้น** | Vercel Production (เว็บ) | `MONGODB_URI` |
| `sanpudam168_promoter` | `readWrite` บน `sanpudam168_production` **เท่านั้น** (ไม่มีสิทธิ์ใด ๆ บน staging/admin) | เครื่องผู้ดูแล ตอนรันสคริปต์ย้ายข้อมูลเท่านั้น | `PROMOTION_MONGODB_URI` |

- ตั้งรหัสผ่านแบบสุ่มยาว และ **ห้าม** ใส่ `PROMOTION_MONGODB_URI` ใน Vercel
- สคริปต์ตรวจซ้ำหลังเชื่อมต่อ: ผู้อ่าน staging ต้องมีแค่ `read@sanpudam168_staging`, ผู้เขียนต้องมี role บน `sanpudam168_production` เท่านั้น มิฉะนั้นหยุดทันที
- หลังเปิดเว็บแล้ว แนะนำให้ปิด (Disable) ผู้ใช้ promoter จนกว่าจะต้องย้ายข้อมูลรอบถัดไป

### 2.3 Network Access
- Vercel Functions ไม่มี IP คงที่ (เว้นแต่ใช้ Secure Compute) จึงต้องอนุญาต `0.0.0.0/0` สำหรับเว็บ และพึ่งรหัสผ่านที่แข็งแรง + ผู้ใช้ read-only
- เครื่องที่รันสคริปต์ promotion: เพิ่ม IP ชั่วคราวเฉพาะช่วงรัน แล้วลบออก
- เครื่อง Windows ที่ resolve SRV ไม่ได้ (`querySrv ECONNREFUSED`): ตั้ง `MONGODB_DNS_SERVERS` ใน `.env.local` (ใช้เฉพาะสคริปต์)

## 3. ตัวแปรสภาพแวดล้อม Vercel (Production)

| ตัวแปร | ค่า | หมายเหตุ |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://sanpudam168.com` | canonical, Open Graph, sitemap |
| `MONGODB_URI` | connection string ของ `sanpudam168_web_ro` | Sensitive |
| `MONGODB_DB_NAME` | `sanpudam168_production` | |
| `SITE_LAUNCHED` | `true` | ตั้งตอนขั้นเปิดจริง (ข้อ 4.6) แล้ว **redeploy** (ค่าถูกอ่านตอน build) |
| `AUTH_URL` | `https://sanpudam168.com` | ถ้าเปิดหลังบ้านบน Production |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_ALLOWED_ACCOUNTS` | ตามระบบ admin | เพิ่ม redirect URI `https://sanpudam168.com/api/auth/callback/google` ใน Google Cloud Console |

**ต้องไม่ตั้ง** ใน Production: `CLIENT_REVIEW_*`, `CLIENT_REVIEW_LOCAL`, `CMS_WRITER_*` (ตัวเขียน FAQ เขียน staging เท่านั้น อยู่นอกขอบเขตรอบนี้),
`PROMOTION_*`, `MONGODB_DNS_SERVERS`, `AUTH_REDIRECT_PROXY_URL`, `CLOUDINARY_API_*` (เว็บไม่ใช้ตอนรัน)

Preview (`dev`) คงค่าเดิมของ Client Review ทั้งหมด และ **ต้องไม่ตั้ง** `SITE_LAUNCHED`

## 4. ลำดับการเปิด

1. **รวมโค้ด**: push `dev` → ตรวจ Preview (review mode ยังมีป้าย "ข้อความตัวอย่าง", หลังบ้านใช้ได้) → PR `dev` → `main` (ต้องอนุมัติ)
2. **Atlas**: สร้างผู้ใช้ 2 คนและ Network Access ตามข้อ 2
3. **Dry run ของการย้ายข้อมูล** (อ่านอย่างเดียว):
   ```bash
   node --env-file=.env.local --import ./tests/support/register.mjs migration/scripts/promote-to-production.mjs
   ```
   - อ่าน staging ด้วยบัญชี review read-only, ใช้ไฟล์ยืนยัน `migration/confirmations/owner-launch-confirmation.json`
   - ถ้าตั้ง `PROMOTION_MONGODB_*` แล้ว จะอ่าน Production แบบ read-only เพื่อแสดงผล created/updated/unchanged
   - ตรวจรายงาน `migration/reports/promotion-dry-run-*.md` (ข้อความก่อน/หลังของช่องที่ลบย่อหน้าตัวอย่าง) และจด **plan hash**
   - ถ้ามีปัญหาใด ๆ (placeholder ค้าง, ค่าไม่ตรงกับที่ยืนยัน, reference ไม่ครบ, ข้อความตัวอย่างค้าง) สคริปต์ **ปฏิเสธทั้งชุด** และไม่เขียนอะไรเลย
4. **Apply** (ต้องอนุมัติ plan hash ก่อน):
   ```bash
   node --env-file=.env.local --import ./tests/support/register.mjs migration/scripts/promote-to-production.mjs \
     --apply --plan-hash=<hash จาก dry run> --confirm-db=sanpudam168_production
   ```
   สร้าง collection + index, เขียนเอกสาร (คง `_id` เดิม), ตรวจซ้ำหลังเขียน (จำนวน, กฎ Public, reference) และบันทึกผลใน `migration_runs` ของ Production
   รันซ้ำได้: ผลเป็น `unchanged`; เอกสารที่ถูกแก้บน Production หลังย้าย จะเป็น `conflict` และไม่ถูกเขียนทับ
5. **ตั้ง env Production** ตามข้อ 3 (ยังไม่ตั้ง `SITE_LAUNCHED`) → deploy `main` → ตรวจบน URL ของ Vercel:
   หน้าแรก/ประวัติ/วัตถุมงคล 5 รายการ/ข่าว 3 ข่าว/เยี่ยมชม แสดงข้อมูลจริง, ไม่มีป้าย review, ปุ่มโทร/LINE/Maps ทำงาน, `/news/ไม่มีจริง` ได้ 404, robots.txt = `Disallow: /`
6. **เปิดให้ค้นหา**: ตั้ง `SITE_LAUNCHED=true` → redeploy → ตรวจ `https://sanpudam168.com/robots.txt` (Allow + Sitemap), `/sitemap.xml` (หน้า + 5 วัตถุมงคล + 3 ข่าว), meta `index, follow`, ไม่มีแถบ "เว็บไซต์ต้นแบบ"
7. **DNS** (ข้อ 5) แล้วส่ง sitemap ใน Google Search Console

## 5. DNS (Cloudflare)

1. Vercel → Project → Domains: เพิ่ม `sanpudam168.com` (Primary) และ `www.sanpudam168.com` (Redirect 308 → `sanpudam168.com`)
2. Cloudflare → DNS:
   - `A` `@` → ค่าที่ Vercel แสดง (เช่น `76.76.21.21`), Proxy status = **DNS only (เมฆเทา)**
   - `CNAME` `www` → `cname.vercel-dns.com`, **DNS only (เมฆเทา)**
   - **ลบระเบียน `AAAA`** ของ `@` และ `www` (Vercel ไม่รองรับ IPv6 แบบนี้ และจะทำให้ออก certificate ไม่ได้)
   - ลบระเบียนเก่าที่ชี้ไป Cloudflare Workers ของเว็บเดิม (ถ้ามี custom domain ผูกอยู่)
3. รอ Vercel ออก SSL certificate (สถานะ Valid Configuration) แล้วตรวจ `https://sanpudam168.com` และ `https://www.sanpudam168.com` (ต้อง redirect)
4. SSL/TLS ของ Cloudflare ไม่มีผลเมื่อเป็น DNS only; อย่าเปิด proxy (เมฆส้ม) ทับ Vercel

## 6. Rollback

| สถานการณ์ | วิธีถอย |
|---|---|
| โค้ดใหม่มีปัญหา | Vercel → Deployments → **Instant Rollback** ไป deployment ก่อนหน้า |
| ไม่อยากให้ถูก index ชั่วคราว | ลบ `SITE_LAUNCHED` แล้ว redeploy (กลับเป็น noindex + robots ปิด) |
| ข้อมูลบางรายการผิด | ห้ามแก้ staging โดยไม่อนุมัติ; ใน Atlas ตั้ง `status: "draft"` ของรายการนั้นใน Production (หายจากเว็บภายใน ~5 นาทีตาม cache) แล้วแก้ไขผ่านไฟล์ยืนยัน + promotion รอบใหม่ |
| ข้อมูลทั้งชุดผิด | Atlas: drop `sanpudam168_production` (ต้องอนุมัติ) แล้วรัน promotion ใหม่; ระหว่างนั้นเว็บแสดงสถานะ "ยังโหลดเนื้อหาไม่ได้" ไม่แสดงข้อมูลแทน |
| DNS มีปัญหา | คืนระเบียนเดิมใน Cloudflare (บันทึกค่าเดิมไว้ก่อนเปลี่ยน) |

## 7. หลังเปิดเว็บ

1. **Redirect เว็บเดิม**: ตั้ง 301 จาก `https://sanpudam168.1d1d.workers.dev/<path>` → `https://sanpudam168.com/<path>` แบบรักษา path และ query
   (path เดิมตรงกัน: `/history`, `/sakkara`, `/sakkara/<slug>`, `/sakkara?cat=<slug>`, `/news`, `/news/<slug>`, `/visit`)
   เช่น ใน Worker เดิม: `return Response.redirect("https://sanpudam168.com" + url.pathname + url.search, 301)`
2. **ปิด/จำกัดหลังบ้านเว็บเดิม**: ก่อนปิด ให้เจ้าของ **export ข้อความที่ส่งเข้ามาทางฟอร์มติดต่อเดิม** เก็บไว้ จากนั้นปิด `/admin` ของเว็บเดิม (หรือจำกัดด้วย Cloudflare Access) และหยุดรับฟอร์ม
3. Google Search Console: ยืนยันโดเมน, ส่ง `https://sanpudam168.com/sitemap.xml`, ใช้ Change of Address จากโดเมนเดิมถ้าเคยยืนยันไว้
4. ปิดผู้ใช้ promoter ใน Atlas และลบ IP ชั่วคราวออกจาก Network Access
5. งานที่ตกลงไว้ว่าทำหลังเปิด:
   - ฟอร์มติดต่อ (รอบนี้ใช้ปุ่ม LINE/โทรแทน)
   - ตัวเขียน FAQ / `admin_audit_log` สำหรับ Production
   - ไฟล์ og-default เฉพาะ (ตอนนี้ใช้ `brand-og-default` 1200×630 ที่ย้ายมา และสำรองด้วยภาพซุ้มประตู crop 1200×630)
   - videos / reviews / team members เมื่อได้ไฟล์และ consent

## 8. การตรวจหลัง deploy (เช็กลิสต์)

- [ ] หน้า `/`, `/history`, `/sakkara` (+ `?cat=sacred-place|saimu|check-in`), 5 หน้าวัตถุมงคล, `/news`, 3 หน้าข่าว, `/visit` แสดงข้อมูลจริง ไม่มีข้อความ "ตัวอย่าง" หรือป้าย review
- [ ] ปุ่มโทร `0823686168`, LINE `@sanpudam168`, Google Maps, Facebook/TikTok/YouTube เปิดได้ (Facebook ไม่มี `mibextid`)
- [ ] `/visit` มีแผนที่ Google ฝัง
- [ ] slug ที่ไม่มี (`/news/x`, `/sakkara/x`) ได้ HTTP 404 (`curl -I`)
- [ ] `<title>`, description, canonical (`https://sanpudam168.com/...`), og:image ถูกต้อง; JSON-LD `FAQPage` บนหน้าแรก และ `NewsArticle` บนหน้าข่าว
- [ ] robots.txt / sitemap.xml ตามข้อ 4.6; `/admin` มี `X-Robots-Tag: noindex`
- [ ] Preview (`dev`) ยังเป็น review mode มีป้าย และหลังบ้านใช้ได้
