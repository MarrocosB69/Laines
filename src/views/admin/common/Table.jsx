import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

const Table = ({ 
  columns = [], 
  data = [], 
  emptyMessage = "Nenhum dado encontrado.",
  loading = false,
  onRowClick,
  className = ""
}) => {
  if (loading) {
    return (
      <div className={`overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)] ${className}`}>
        <div className="flex flex-col gap-3 p-6">
          <div className="skeleton skeleton-line w-48" />
          <div className="skeleton skeleton-card w-full" />
          <div className="skeleton skeleton-card w-full" />
          <div className="skeleton skeleton-card w-2/3" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="laines-feedback-state">
        <AlertCircle className="h-12 w-12" />
        <strong>Nenhum resultado</strong>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)] ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key || index}
                scope="col"
                className={`border-b border-[var(--color-border)] bg-slate-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)] ${
                  column.align === 'right' ? 'text-right' :
                  column.align === 'center' ? 'text-center' : 'text-left'
                }`}
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, rowIndex) => (
            <motion.tr
              key={item.id || rowIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: rowIndex * 0.05 }}
              className={`transition-colors hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick && onRowClick(item)}
            >
              {columns.map((column, colIndex) => (
                <td
                  key={`${rowIndex}-${column.key || colIndex}`}
                  className={`px-4 py-3.5 text-[13px] text-[var(--color-text-primary)] ${
                    rowIndex === data.length - 1 ? '' : 'border-b border-slate-100'
                  } ${
                    column.align === 'right' ? 'text-right' :
                    column.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {column.render ? column.render(item, rowIndex) : item[column.key]}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
