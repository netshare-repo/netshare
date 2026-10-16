import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./AdminPagination.css";

const PAGE_SIZES = [10, 20, 25, 50, 100];

export default function AdminPagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const [customSize, setCustomSize] = useState(75);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const isCustomSize = !PAGE_SIZES.includes(pageSize);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  useEffect(() => {
    if (page > pageCount) onPageChange(pageCount);
  }, [page, pageCount, onPageChange]);

  const changeSize = (value) => {
    if (value === "custom") {
      const next = Math.min(500, Math.max(1, customSize));
      onPageSizeChange(next);
      onPageChange(1);
      return;
    }
    onPageSizeChange(Number(value));
    onPageChange(1);
  };

  const changeCustomSize = (value) => {
    setCustomSize(value);
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 500) {
      onPageSizeChange(parsed);
      onPageChange(1);
    }
  };

  return <div className="admin-pagination">
    <div className="admin-pagination-size">
      <span>Rows per page</span>
      <select aria-label="Rows per page" value={isCustomSize ? "custom" : pageSize} onChange={(event) => changeSize(event.target.value)}>
        {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        <option value="custom">Custom</option>
      </select>
      {isCustomSize && <input aria-label="Custom rows per page" type="number" min="1" max="500" value={customSize} onChange={(event) => changeCustomSize(event.target.value)} />}
    </div>
    <span className="admin-pagination-count">{start}-{end} of {total} records</span>
    <div className="admin-pagination-actions">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} /></button>
      <span>Page {page} of {pageCount}</span>
      <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}><ChevronRight size={16} /></button>
    </div>
  </div>;
}
