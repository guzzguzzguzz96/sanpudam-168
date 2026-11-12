import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

// Read-only content list for /admin/content. Receives the list DTO only
// (title, type, publication and review status). Filters are plain links,
// so the page works without client JavaScript. No edit or publish actions.

const typeHref = (key) => (key ? `/admin/content?type=${encodeURIComponent(key)}` : "/admin/content");

function StatusBadge({ status, kind }) {
  const tone = status.known ? `${kind}-${status.value}` : "unknown";
  return <span className={`admin-status admin-status--${tone}`}>{status.label}</span>;
}

function TypeFilter({ types, total, active }) {
  const options = [{ key: null, label: "ทั้งหมด", count: total }, ...types.filter((type) => type.count > 0)];
  return (
    <nav aria-label="กรองตามประเภทเนื้อหา" className="admin-filter">
      <ul className="admin-filter__list">
        {options.map((option) => {
          const current = option.key === active;
          return (
            <li key={option.key ?? "all"}>
              <Link
                aria-current={current ? "page" : undefined}
                className={`admin-filter__link${current ? " admin-filter__link--active" : ""}`}
                href={typeHref(option.key)}
                prefetch={false}
              >
                {option.label} <span className="admin-filter__count">{option.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ContentInventory({ inventory, filter }) {
  const typesWithContent = inventory.types.filter((type) => type.count > 0).length;
  const activeType = inventory.types.find((type) => type.key === filter.type);

  return (
    <Section aria-labelledby="admin-inventory-title" className="admin-section">
      <Container>
        <h2 id="admin-inventory-title" className="admin-inventory__summary">
          ทั้งหมด {inventory.total} รายการ จาก {typesWithContent} ประเภท
        </h2>
        <p className="admin-panel__text">ข้อมูลจากฐานข้อมูลทดสอบ (staging) อ่านอย่างเดียว ยังแก้ไขหรือเผยแพร่จากหน้านี้ไม่ได้</p>

        {inventory.status === "empty" ? (
          <p className="admin-panel__alert">ยังไม่มีเนื้อหาในฐานข้อมูล</p>
        ) : (
          <>
            {inventory.types.filter((type) => type.count > 0).length > 1 ? (
              <TypeFilter active={filter.type} total={inventory.total} types={inventory.types} />
            ) : null}
            {filter.invalid ? (
              <p className="admin-panel__alert" role="status">
                ไม่พบประเภทเนื้อหาที่เลือก จึงแสดงทุกประเภท
              </p>
            ) : null}
            {filter.items.length === 0 ? (
              <p className="admin-panel__alert">ไม่มีรายการในประเภท{activeType?.label ?? "นี้"}</p>
            ) : (
              <table className="admin-table">
                <caption className="sr-only">
                  {activeType ? `รายการ${activeType.label} ${filter.items.length} รายการ` : `รายการเนื้อหาทั้งหมด ${filter.items.length} รายการ`}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">ชื่อหรือหัวข้อ</th>
                    <th scope="col">ประเภท</th>
                    <th scope="col">สถานะการเผยแพร่</th>
                    <th scope="col">สถานะการตรวจทาน</th>
                  </tr>
                </thead>
                <tbody>
                  {filter.items.map((item) => (
                    <tr key={`${item.type}-${item.id}`}>
                      <th scope="row" className="admin-table__title">
                        {item.title}
                      </th>
                      <td data-label="ประเภท">{item.typeLabel}</td>
                      <td data-label="การเผยแพร่">
                        <StatusBadge kind="publication" status={item.publication} />
                      </td>
                      <td data-label="การตรวจทาน">
                        <StatusBadge kind="review" status={item.review} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Container>
    </Section>
  );
}

const UNAVAILABLE_TEXT = {
  environment: "รายการเนื้อหาจากฐานข้อมูลทดสอบไม่เปิดใช้ในสภาพแวดล้อมนี้",
};

export function ContentInventoryUnavailable({ reason }) {
  return (
    <Section aria-labelledby="admin-inventory-unavailable" className="admin-section">
      <Container>
        <div className="admin-panel admin-panel--notice">
          <h2 id="admin-inventory-unavailable" className="admin-panel__title">
            ยังแสดงรายการเนื้อหาไม่ได้
          </h2>
          <p className="admin-panel__text">{UNAVAILABLE_TEXT[reason] ?? "ระบบอ่านข้อมูลเนื้อหาไม่สำเร็จในขณะนี้ กรุณาลองใหม่ภายหลัง"}</p>
        </div>
      </Container>
    </Section>
  );
}
