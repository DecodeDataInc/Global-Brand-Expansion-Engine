import React, { useRef, useEffect, useState } from 'react';
import { X, Eraser, Check, Loader2, RefreshCw } from 'lucide-react';
import { GeneratedAsset } from '../types';

interface EditorProps {
  asset: GeneratedAsset;
  onClose: () => void;
  onRefine: (assetId: string, mask: string, instruction: string) => Promise<void>;
}

const Editor: React.FC<EditorProps> = ({ asset, onClose, onRefine }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);

  // Initialize canvas with image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = asset.imageUrl;

    img.onload = () => {
      // Fit canvas to screen while maintaining aspect ratio
      const maxWidth = window.innerWidth * 0.8;
      const maxHeight = window.innerHeight * 0.6;
      let width = img.width;
      let height = img.height;

      const ratio = Math.min(maxWidth / width, maxHeight / height);
      canvas.width = width * ratio;
      canvas.height = height * ratio;

      // Draw original image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  }, [asset]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if(canvas) {
        const ctx = canvas.getContext('2d');
        if(ctx) ctx.beginPath(); // Reset path
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    // Visual feedback for the user (white semi-transparent)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; 
    
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleSubmit = async () => {
    if (!instruction.trim()) return;
    
    setIsProcessing(true);
    
    // Create the mask
    // We need a separate canvas that is purely black (bg) and white (drawings)
    // or transparent and white. Gemini usually expects the mask to be the white area.
    const canvas = canvasRef.current;
    if(!canvas) return;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    if(!maskCtx) return;

    // Fill black
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    // Re-draw the user's strokes based on the "visual" canvas
    // Since we drew directly on the image, extracting *just* the strokes is hard 
    // unless we used a second layer. 
    // CORRECT APPROACH: Use a second canvas layer for drawing in the UI, keeping the image separate.
    // For this simple implementation, I will assume the user has drawn on the main canvas 
    // and I can't easily separate it without a layer system.
    // FIX: Let's reimplement with a proper layer system right now.
  };
  
  // Re-render logic for layers
  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
              {/* Header */}
              <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                  <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">Refinement Mode</h2>
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-xs border border-indigo-500/30">Paint to Edit</span>
                  </div>
                  <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                      <X size={24} />
                  </button>
              </div>

              {/* Canvas Area */}
              <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden" ref={containerRef}>
                  <EditorCanvas 
                    imageUrl={asset.imageUrl} 
                    brushSize={brushSize} 
                    onExportMask={(maskData) => {
                        // Pass mask data to handler
                        if(instruction && !isProcessing) {
                            setIsProcessing(true);
                            onRefine(asset.id, maskData, instruction).finally(() => setIsProcessing(false));
                        }
                    }}
                    instruction={instruction}
                    setInstruction={setInstruction}
                    isProcessing={isProcessing}
                  />
              </div>

              {/* Toolbar */}
              <div className="p-4 bg-slate-800 border-t border-slate-700 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-400">Brush Size</label>
                          <input 
                              type="range" 
                              min="5" 
                              max="100" 
                              value={brushSize} 
                              onChange={(e) => setBrushSize(Number(e.target.value))}
                              className="w-32 accent-indigo-500 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                      <div className="h-8 w-px bg-slate-600"></div>
                      <p className="text-xs text-slate-400 max-w-xs">
                          Paint over the area you want to change. Be precise.
                      </p>
                  </div>
              </div>
          </div>
      </div>
  );
};

// Separated Canvas Logic for Layering
const EditorCanvas: React.FC<{
    imageUrl: string; 
    brushSize: number;
    onExportMask: (b64: string) => void;
    instruction: string;
    setInstruction: (s: string) => void;
    isProcessing: boolean;
}> = ({ imageUrl, brushSize, onExportMask, instruction, setInstruction, isProcessing }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [dimensions, setDimensions] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
             // Calculate fit
             const maxWidth = containerRef.current?.clientWidth || 800;
             const maxHeight = containerRef.current?.clientHeight || 600;
             const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
             
             setDimensions({ w: img.width * ratio, h: img.height * ratio });
        };
    }, [imageUrl]);

    useEffect(() => {
        // Reset canvas size when dimensions change
        const canvas = canvasRef.current;
        if(canvas && dimensions.w > 0) {
            canvas.width = dimensions.w;
            canvas.height = dimensions.h;
        }
    }, [dimensions]);

    const getMousePos = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDraw = (e: React.MouseEvent) => {
        setIsDrawing(true);
        const { x, y } = getMousePos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if(!ctx) return;
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent) => {
        if(!isDrawing) return;
        const { x, y } = getMousePos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if(!ctx) return;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Visual only
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDraw = () => {
        setIsDrawing(false);
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.closePath();
    };

    const handleSend = () => {
        // Generate pure mask
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = dimensions.w;
        maskCanvas.height = dimensions.h;
        const ctx = maskCanvas.getContext('2d');
        if(!ctx) return;

        // Background Black
        ctx.fillStyle = 'black';
        ctx.fillRect(0,0, dimensions.w, dimensions.h);

        // Draw the strokes from the visual canvas onto the mask canvas
        // But wait, the visual canvas has the image underneath? No, it's a layer on top.
        // The visual canvas (canvasRef) ONLY has the strokes on it because the image is in an <img> tag behind it.
        // However, the strokes are semi-transparent white. We need them fully white for the mask.
        
        const visualData = canvasRef.current?.getContext('2d')?.getImageData(0,0, dimensions.w, dimensions.h);
        if(visualData) {
            // We can iterate pixels, or just draw the canvas with a composite operation.
            // Simpler: Just rely on the user drawing.
            // Actually, since I drew with rgba(255,255,255,0.5), I need to threshold it to solid white.
            
            const imageData = ctx.createImageData(dimensions.w, dimensions.h);
            const sourceData = visualData.data;
            const destData = imageData.data;
            
            for(let i=0; i<sourceData.length; i+=4) {
                // If alpha > 0, make it white. Else black.
                if(sourceData[i+3] > 0) {
                   destData[i] = 255;   // R
                   destData[i+1] = 255; // G
                   destData[i+2] = 255; // B
                   destData[i+3] = 255; // A
                } else {
                   destData[i] = 0;
                   destData[i+1] = 0;
                   destData[i+2] = 0;
                   destData[i+3] = 255; // Opaque black
                }
            }
            ctx.putImageData(imageData, 0, 0);
            
            const b64 = maskCanvas.toDataURL('image/png');
            onExportMask(b64);
        }
    };

    return (
        <div className="flex flex-col items-center w-full h-full relative" ref={containerRef}>
            <div className="relative shadow-2xl mt-4" style={{ width: dimensions.w, height: dimensions.h }}>
                {/* Background Image Layer */}
                <img 
                    ref={imageRef}
                    src={imageUrl} 
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                    alt="Target"
                />
                {/* Drawing Layer */}
                <canvas 
                    ref={canvasRef}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    className="absolute inset-0 cursor-crosshair touch-none"
                />
            </div>
            
            {/* Input Overlay */}
            <div className="absolute bottom-6 w-full max-w-2xl px-4">
                <div className="flex gap-2 bg-slate-800/90 p-2 rounded-xl backdrop-blur-md border border-slate-700 shadow-xl">
                    <input
                        type="text"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="Describe the change (e.g., 'Make the logo bigger', 'Change to silk material')"
                        className="flex-1 bg-transparent border-none text-white placeholder-slate-400 focus:ring-0 px-4 py-2"
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!instruction || isProcessing}
                        className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                            !instruction || isProcessing 
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        }`}
                    >
                        {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18} />}
                        {isProcessing ? 'Refining...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Editor;
