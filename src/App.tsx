import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Layers, 
  Wand2, 
  Loader2, 
  AlertCircle,
  Key,
  Check,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Minus,
  Download
} from 'lucide-react';
import JSZip from 'jszip';

import DropZone from './components/DropZone';
import Editor from './components/Editor';
import { BrandDNA, GeneratedAsset, AssetType } from './types';
import { analyzeBrandDNA, generateBrandAsset, refineAsset } from './services/geminiService';
import { fileToBase64 } from './utils';

interface CategoryGroup {
  id: string;
  label: string;
  items: { id: AssetType; label: string }[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'Apparel',
    label: 'Apparel',
    items: [
      { id: 'T-Shirt', label: 'T-Shirt' },
      { id: 'Cap', label: 'Cap' }
    ]
  },
  {
    id: 'Signage',
    label: 'Large Format Signage',
    items: [
      { id: 'Billboard', label: 'Billboard' },
      { id: 'Poster', label: 'Poster' }
    ]
  },
  {
    id: 'Hard Goods',
    label: 'Hard Goods',
    items: [
      { id: 'Mug', label: 'Mug' },
      { id: 'Tote', label: 'Tote' }
    ]
  }
];

function App() {
  // State
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [masterAsset, setMasterAsset] = useState<string | null>(null);
  const [brandDNA, setBrandDNA] = useState<BrandDNA | null>(null);
  const [isDnaExpanded, setIsDnaExpanded] = useState(false);
  
  // Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(['T-Shirt']));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Apparel']));

  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  
  // Status
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'generating' | 'error'>('idle');
  const [isZipping, setIsZipping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Editing
  const [editingAsset, setEditingAsset] = useState<GeneratedAsset | null>(null);

  // Check API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
        setApiKeyReady(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setApiKeyReady(true);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!apiKeyReady) {
      await handleSelectKey();
    }
    
    try {
      setStatus('analyzing');
      const base64 = await fileToBase64(file);
      setMasterAsset(base64);
      setGeneratedAssets([]); // Clear previous
      
      const dna = await analyzeBrandDNA(base64);
      setBrandDNA(dna);
      setIsDnaExpanded(false); // Reset expansion state on new upload
      setStatus('idle');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMsg(e.message || "Failed to analyze image");
    }
  };

  const handleGenerate = async () => {
    if (!brandDNA || selectedItems.size === 0) return;

    setStatus('generating');
    try {
      const results: GeneratedAsset[] = [];
      const itemsToGenerate = Array.from(selectedItems);
      
      // Parallel generation for each selected item
      await Promise.all(itemsToGenerate.map(async (itemType) => {
        try {
          const imgBase64 = await generateBrandAsset(itemType, brandDNA);
          results.push({
            id: crypto.randomUUID(),
            category: itemType,
            imageUrl: imgBase64,
            prompt: `Generating ${itemType}...`,
            timestamp: Date.now()
          });
        } catch (err) {
          console.error(`Failed to generate ${itemType}`, err);
        }
      }));

      setGeneratedAssets(prev => [...prev, ...results]);
      setStatus('idle');
    } catch (e: any) {
      setStatus('error');
      setErrorMsg("Failed to generate assets. " + e.message);
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleGroupSelection = (group: CategoryGroup) => {
    const allChildIds = group.items.map(i => i.id);
    const hasAllSelected = allChildIds.every(id => selectedItems.has(id));
    
    const newSelected = new Set(selectedItems);
    if (hasAllSelected) {
      // Deselect all
      allChildIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all
      allChildIds.forEach(id => newSelected.add(id));
    }
    setSelectedItems(newSelected);
  };

  const handleRefine = async (assetId: string, mask: string, instruction: string) => {
    const asset = generatedAssets.find(a => a.id === assetId);
    if (!asset) return;

    try {
      const newImageBase64 = await refineAsset(asset.imageUrl, mask, instruction);
      setGeneratedAssets(prev => prev.map(a => 
        a.id === assetId ? { ...a, imageUrl: newImageBase64 } : a
      ));
      setEditingAsset(null);
    } catch (e: any) {
      alert("Refinement failed: " + e.message);
    }
  };

  const handleDownload = (asset: GeneratedAsset, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = asset.imageUrl;
    link.download = `brand-kit-${asset.category}-${asset.id.slice(0, 4)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    if (generatedAssets.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder("Global_Brand_Expansion_Kit");

      generatedAssets.forEach((asset) => {
        // Strip the data URL prefix to get raw base64
        const base64Data = asset.imageUrl.split(',')[1];
        if (base64Data) {
          folder?.file(`${asset.category}-${asset.id.slice(0, 4)}.png`, base64Data, { base64: true });
        }
      });

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = "Global_Brand_Expansion_Kit.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Failed to zip files", e);
      alert("Failed to create zip file");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-slate-100 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar */}
      <aside className="w-full md:w-[340px] bg-[#0B0F17] border-r border-slate-800/50 flex flex-col shrink-0 md:h-screen z-20">
        
        {/* Sticky Header */}
        <div className="p-6 pt-8 pb-6 border-b border-slate-800/50 shrink-0">
          <div className="flex items-center gap-3 text-indigo-500">
            <Layers className="w-6 h-6" strokeWidth={2.5} />
            <span className="text-xl font-bold text-indigo-100 tracking-tight">Brand Engine</span>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Categories List */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">
              Expansion Categories
            </div>

            <div className="space-y-1">
              {CATEGORY_GROUPS.map(group => {
                const allChildIds = group.items.map(i => i.id);
                const selectedChildrenCount = allChildIds.filter(id => selectedItems.has(id)).length;
                const isAllSelected = selectedChildrenCount === group.items.length;
                const isIndeterminate = selectedChildrenCount > 0 && !isAllSelected;
                const isExpanded = expandedGroups.has(group.id);

                return (
                  <div key={group.id} className="mb-2">
                    {/* Parent Group Row */}
                    <div className="flex items-center gap-2 group p-2 rounded hover:bg-slate-800/50 transition-colors">
                      {/* Expansion Toggle */}
                      <button 
                        onClick={() => toggleGroupExpansion(group.id)}
                        className="text-slate-500 hover:text-white transition-colors"
                      >
                          {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                      </button>

                      {/* Parent Checkbox */}
                      <div 
                        onClick={() => toggleGroupSelection(group)}
                        className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200 ${
                          isAllSelected || isIndeterminate
                            ? 'bg-indigo-600 border-indigo-600' 
                            : 'border-slate-600 hover:border-slate-500 bg-transparent'
                        }`}
                      >
                        {isAllSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                        {isIndeterminate && <Minus size={14} className="text-white" strokeWidth={3} />}
                      </div>

                      <span 
                          onClick={() => toggleGroupExpansion(group.id)}
                          className="text-sm font-medium text-slate-300 cursor-pointer flex-1"
                      >
                          {group.label}
                      </span>
                    </div>

                    {/* Children Items */}
                    {isExpanded && (
                      <div className="ml-9 pl-3 border-l border-slate-800/50 space-y-1 mt-1">
                        {group.items.map(item => {
                          const isSelected = selectedItems.has(item.id);
                          return (
                            <div 
                              key={item.id} 
                              onClick={() => toggleItemSelection(item.id)}
                              className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-slate-800/30 transition-colors"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 ${
                                  isSelected 
                                    ? 'bg-indigo-500 border-indigo-500' 
                                    : 'border-slate-600 bg-transparent'
                                }`}>
                                  {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                              </div>
                              <span className={`text-sm ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                                {item.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Brand DNA Card */}
          <div>
            {brandDNA ? (
              <div className="bg-[#131722] rounded-xl p-4 border border-slate-800/60 shadow-lg animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="flex items-center gap-2 mb-3 text-slate-400">
                  <Sparkles size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Brand DNA Extracted</span>
                </div>
                
                {/* Palette Circles */}
                <div className="flex gap-2 mb-3">
                  {brandDNA.palette.map((color, i) => (
                    <div 
                      key={i} 
                      className="w-6 h-6 rounded-full ring-2 ring-[#131722] shadow-sm transform transition-transform hover:scale-110" 
                      style={{ backgroundColor: color }} 
                      title={color}
                    />
                  ))}
                </div>

                <p className={`text-xs text-slate-400 leading-relaxed ${!isDnaExpanded ? 'line-clamp-3' : ''}`}>
                  {brandDNA.description}
                </p>

                {brandDNA.description.length > 150 && (
                  <button 
                    onClick={() => setIsDnaExpanded(!isDnaExpanded)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium mt-1 mb-2 focus:outline-none"
                  >
                    {isDnaExpanded ? 'Read Less' : 'Read More'}
                  </button>
                )}
                {!isDnaExpanded && brandDNA.description.length <= 150 && <div className="mb-3"></div>}

                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-1 bg-[#1E2330] rounded text-[10px] text-slate-300 border border-slate-700/50">
                      {brandDNA.style}
                  </span>
                  <span className="px-2 py-1 bg-[#1E2330] rounded text-[10px] text-slate-300 border border-slate-700/50">
                      {brandDNA.keywords[0]}
                  </span>
                </div>
              </div>
            ) : (
              // Placeholder DNA Card
              <div className="bg-[#131722] rounded-xl p-4 border border-slate-800/60 border-dashed opacity-50">
                <div className="flex items-center gap-2 mb-3 text-slate-500">
                  <Sparkles size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Brand DNA</span>
                </div>
                <div className="h-6 w-full bg-slate-800/50 rounded mb-2"></div>
                <div className="h-12 w-full bg-slate-800/50 rounded"></div>
              </div>
            )}
          </div>

        </div>

        {/* Sticky Generate Button Footer */}
        <div className="p-6 border-t border-slate-800/50 bg-[#0B0F17] shrink-0">
          {/* API Key Warning */}
          {!apiKeyReady && (
             <div onClick={handleSelectKey} className="mb-4 text-xs text-amber-500 cursor-pointer hover:underline flex items-center gap-1">
               <AlertCircle size={12}/> <span>Connect API Key to enable generation</span>
             </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!brandDNA || status === 'generating' || selectedItems.size === 0}
            className={`w-full py-3.5 rounded-lg font-bold text-sm tracking-wide shadow-lg flex items-center justify-center gap-2 transition-all duration-300 ${
              !brandDNA || status === 'generating' || selectedItems.size === 0
                ? 'bg-[#1E2330] text-slate-500 cursor-not-allowed'
                : 'bg-[#564ceb] hover:bg-[#4f46e5] text-white shadow-[#564ceb]/25 hover:shadow-[#564ceb]/40 hover:-translate-y-0.5'
            }`}
          >
            {status === 'generating' ? (
              <><Loader2 className="animate-spin" size={18} /> Processing ({selectedItems.size})...</>
            ) : (
              <><Wand2 size={18} /> Generate {selectedItems.size} Assets</>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto bg-[#02040a]">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* Master Asset Zone */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">Master Brand Asset</h2>
            <DropZone onFileAccepted={handleFileUpload} currentImage={masterAsset} />
            {status === 'analyzing' && <p className="text-indigo-400 text-sm animate-pulse">Extracting Brand DNA...</p>}
          </section>

          {/* Results Gallery */}
          {generatedAssets.length > 0 && (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold text-white tracking-tight">Brand Kit Gallery</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-xs font-medium text-slate-400 border border-slate-700">
                    {generatedAssets.length} items
                  </span>
                </div>
                
                <button 
                  onClick={handleDownloadAll}
                  disabled={isZipping}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium border border-slate-700 transition-colors"
                >
                  {isZipping ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />}
                  {isZipping ? 'Packaging...' : 'Download All'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {generatedAssets.map((asset) => (
                  <div 
                    key={asset.id} 
                    className="group relative bg-[#0B0F17] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10"
                    onClick={() => setEditingAsset(asset)}
                  >
                    <div className="aspect-square relative overflow-hidden">
                        <img 
                            src={asset.imageUrl} 
                            alt={asset.category} 
                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                        />
                         {/* Hover Edit/Download Prompt */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-[2px] gap-3">
                            <button 
                              className="bg-white hover:bg-indigo-50 text-slate-900 px-4 py-2 rounded-full font-bold text-xs shadow-xl transform scale-95 group-hover:scale-100 transition-all flex items-center gap-2"
                              title="Refine Asset"
                            >
                                <Sparkles size={14}/> Refine
                            </button>
                            <button 
                              onClick={(e) => handleDownload(asset, e)}
                              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-full shadow-xl transform scale-95 group-hover:scale-100 transition-all border border-slate-600"
                              title="Download Asset"
                            >
                                <Download size={14}/>
                            </button>
                        </div>
                    </div>
                    <div className="p-3 border-t border-slate-800/50">
                        <p className="text-xs font-medium text-slate-300">{asset.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Error Banner */}
          {status === 'error' && (
            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <AlertCircle size={16}/> {errorMsg}
            </div>
          )}

        </div>
      </main>

      {/* Editor Modal */}
      {editingAsset && (
        <Editor 
            asset={editingAsset} 
            onClose={() => setEditingAsset(null)}
            onRefine={handleRefine}
        />
      )}
    </div>
  );
}

export default App;