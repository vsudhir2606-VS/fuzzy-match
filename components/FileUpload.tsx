
import React, { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onDataLoaded: (data: any[], headers: string[]) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, isLoading }) => {
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      if (data.length > 0) {
        const headers = data[0].map(h => String(h));
        const rows = data.slice(1).map(row => {
          const obj: any = {};
          headers.forEach((h, i) => {
            obj[h] = row[i];
          });
          return obj;
        });
        onDataLoaded(rows, headers);
      }
    };
    reader.readAsBinaryString(file);
  }, [onDataLoaded]);

  return (
    <div className="w-full">
      <label className={`
        flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer
        transition-all duration-200 group
        ${isLoading ? 'bg-gray-50 border-gray-300 pointer-events-none' : 'bg-white border-blue-200 hover:border-blue-400 hover:bg-blue-50/30'}
      `}>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <div className="p-4 mb-4 rounded-full bg-blue-100 text-blue-600 group-hover:scale-110 transition-transform">
            <FileSpreadsheet size={32} />
          </div>
          <p className="mb-2 text-sm text-gray-700 font-medium">
            <span className="font-bold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">Excel (.xlsx, .xls) or CSV files</p>
        </div>
        <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
      </label>
      
      <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-800 text-xs">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
        <p>Ensure your file has clearly labeled columns for 'Customer Names' and 'RPL Names'. You can have both in the same file or mapping across lists.</p>
      </div>
    </div>
  );
};
