import React, { useState, useRef } from 'react';
import { Upload, ImagePlus } from 'lucide-react';

interface DropZoneProps {
  onFileAccepted: (file: File) => void;
  currentImage: string | null;
}

const DropZone: React.FC<DropZoneProps> = ({ onFileAccepted, currentImage }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileAccepted(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileAccepted(e.target.files[0]);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-[320px] rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group overflow-hidden bg-[#05080f] ${
        isDragOver
          ? 'border-2 border-indigo-500 bg-indigo-500/5'
          : 'border border-dashed border-[#564ceb]/50 hover:border-[#564ceb] hover:bg-[#564ceb]/5'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
      
      {currentImage ? (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center p-8">
            <img 
                src={currentImage} 
                alt="Master Asset" 
                className="max-h-full max-w-full object-contain shadow-2xl drop-shadow-2xl"
            />
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                <p className="text-white font-bold text-sm flex items-center gap-2 bg-[#564ceb] px-4 py-2 rounded-full shadow-lg">
                    <Upload size={16} /> Replace Asset
                </p>
            </div>
        </div>
      ) : (
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-[#131722] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform border border-slate-800 shadow-xl">
            <ImagePlus className="text-indigo-500" size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Upload Brand Asset</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
            Drag & drop your logo or hero product shot here to extract Brand DNA.
          </p>
        </div>
      )}
    </div>
  );
};

export default DropZone;