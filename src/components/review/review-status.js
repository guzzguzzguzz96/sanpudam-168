// Review labels next to the content they describe. Both render nothing
// without a value, so public pages (which never pass one) are unchanged.

// status: { tone: "sample" | "pending", label, fields } from the review
// view data.
export function ReviewStatus({ status, className = "" }) {
  if (!status?.label) {
    return null;
  }

  return (
    <p className={`review-status review-status--${status.tone} ${className}`.trim()}>
      <span className="review-status__label">{status.label}</span>
      {status.fields?.length ? (
        <span className="review-status__fields">
          ({status.fields.join(", ")})
        </span>
      ) : null}
    </p>
  );
}

// note: a short label such as "นำเข้าจากระบบเดิม · ยังไม่ยืนยัน".
export function ReviewNote({ note, className = "" }) {
  if (!note) {
    return null;
  }

  return <p className={`review-note ${className}`.trim()}>{note}</p>;
}
