import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-[#74A865] animate-spin mb-4" />
          <p className="text-slate-500">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
        <p className="text-slate-500 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((column, index) => (
              <th
                key={column.key || index}
                className={`py-4 px-6 text-left text-xs font-black uppercase tracking-widest text-slate-400 ${
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
              className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
              onClick={() => onRowClick && onRowClick(item)}
            >
              {columns.map((column, colIndex) => (
                <td
                  key={`${rowIndex}-${column.key || colIndex}`}
                  className={`py-4 px-6 ${
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