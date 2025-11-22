import React, { useState, useEffect } from 'react';
import { 
  Plus, Inbox, Star, Archive, Trash2, Tag, Clock, BookOpen, 
  X, ChevronLeft, Type, Sun, Moon, Coffee, Check, Search, 
  Layout, ExternalLink, Sparkles, Settings, Key, Image as ImageIcon,
  RefreshCw, Server, AlertCircle
} from 'lucide-react';

const App = () => {
  // --- State ---
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('things3-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeView, setActiveView] = useState('inbox'); 
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [readerItem, setReaderItem] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // Settings State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini-api-key') || '');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('gemini-model') || 'gemini-1.5-flash');
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  // Reader Mode Settings
  const [readerSettings, setReaderSettings] = useState({
    theme: 'white', font: 'sans', size: 18,
  });

  // --- Effects ---
  useEffect(() => localStorage.setItem('things3-bookmarks', JSON.stringify(bookmarks)), [bookmarks]);
  useEffect(() => localStorage.setItem('gemini-api-key', apiKey), [apiKey]);
  useEffect(() => localStorage.setItem('gemini-model', selectedModel), [selectedModel]);

  // --- Actions ---

  const fetchModels = async () => {
    if (!apiKey) return alert("Please enter an API Key first");
    
    setIsLoadingModels(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      
      setAvailableModels(data.models);
    } catch (err) {
      alert(`Error loading models: ${err.message}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleAddBookmark = async (e) => {
    e.preventDefault();
    if (!newUrl) return;

    setIsProcessing(true);
    setProcessingStatus('Fetching content...');
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: newUrl,
          apiKey: apiKey,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Network error');
      }
      
      setProcessingStatus('AI analyzing...');
      const aiData = await response.json();
      
      const newBookmark = {
        id: Date.now().toString(),
        url: newUrl,
        isFavorite: false,
        isArchived: false,
        ...aiData
      };
      
      setBookmarks([newBookmark, ...bookmarks]);
      setNewUrl('');
      setIsAdding(false);
      setActiveView('inbox');
    } catch (error) {
      console.error("Analysis failed", error);
      alert(`Failed to analyze: ${error.message}. Try a different URL or Model.`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const toggleFavorite = (id, e) => {
    e.stopPropagation();
    setBookmarks(bookmarks.map(b => b.id === id ? { ...b, isFavorite: !b.isFavorite } : b));
  };

  const deleteBookmark = (id, e) => {
    e.stopPropagation();
    if (confirm('Delete this bookmark?')) {
      setBookmarks(bookmarks.filter(b => b.id !== id));
    }
  };

  const moveToArchive = (id, e) => {
    e.stopPropagation();
    setBookmarks(bookmarks.map(b => b.id === id ? { ...b, isArchived: !b.isArchived } : b));
  };

  // --- Filtering ---
  const getFilteredBookmarks = () => {
    let filtered = bookmarks;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(term) || 
        b.summary.toLowerCase().includes(term) ||
        b.tags.some(t => t.includes(term))
      );
    }

    switch (activeView) {
      case 'inbox': return filtered.filter(b => !b.isArchived);
      case 'favorites': return filtered.filter(b => b.isFavorite && !b.isArchived);
      case 'archive': return filtered.filter(b => b.isArchived);
      default: return filtered;
    }
  };

  const displayBookmarks = getFilteredBookmarks();

  // --- Components ---
  const NavItem = ({ id, icon: Icon, label, count }) => (
    <button
      onClick={() => setActiveView(id)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
        activeView === id 
          ? 'bg-gray-200 text-gray-900' 
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={activeView === id ? 'text-blue-500' : 'text-gray-400'} />
        <span>{label}</span>
      </div>
      {count > 0 && (
        <span className="text-xs font-semibold text-gray-400">{count}</span>
      )}
    </button>
  );

  // Reader Mode View
  if (readerItem) {
    const themeClasses = {
      white: 'bg-white text-gray-900',
      dark: 'bg-gray-900 text-gray-300',
      sepia: 'bg-[#f8f1e3] text-[#4f321c]'
    };
    const fontClasses = { sans: 'font-sans', serif: 'font-serif', mono: 'font-mono' };

    return (
      <div className={`fixed inset-0 z-50 overflow-y-auto transition-colors duration-300 ${themeClasses[readerSettings.theme]}`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b transition-colors ${
           readerSettings.theme === 'dark' ? 'border-gray-800 bg-gray-900/95' : 
           readerSettings.theme === 'sepia' ? 'border-[#e0d6c2] bg-[#f8f1e3]/95' : 'border-gray-100 bg-white/95'
        } backdrop-blur-sm`}>
          <button onClick={() => setReaderItem(null)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors">
            <ChevronLeft size={20} /> <span className="font-medium">Back</span>
          </button>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/5">
                <button onClick={() => setReaderSettings(s => ({...s, size: Math.max(12, s.size - 2)}))} className="p-1 hover:text-blue-500"><Type size={14} /></button>
                <div className="w-px h-4 bg-gray-400/30"></div>
                <button onClick={() => setReaderSettings(s => ({...s, size: Math.min(32, s.size + 2)}))} className="p-1 hover:text-blue-500"><Type size={20} /></button>
                <div className="w-px h-4 bg-gray-400/30 mx-2"></div>
                <button onClick={() => setReaderSettings(s => ({...s, font: 'sans'}))} className={`text-xs font-sans font-bold ${readerSettings.font === 'sans' ? 'text-blue-500' : ''}`}>Ag</button>
                <button onClick={() => setReaderSettings(s => ({...s, font: 'serif'}))} className={`text-xs font-serif font-bold ${readerSettings.font === 'serif' ? 'text-blue-500' : ''}`}>Ag</button>
                <button onClick={() => setReaderSettings(s => ({...s, font: 'mono'}))} className={`text-xs font-mono font-bold ${readerSettings.font === 'mono' ? 'text-blue-500' : ''}`}>Ag</button>
                <div className="w-px h-4 bg-gray-400/30 mx-2"></div>
                <button onClick={() => setReaderSettings(s => ({...s, theme: 'white'}))} className={`p-1 ${readerSettings.theme === 'white' ? 'text-blue-500' : ''}`}><Sun size={16}/></button>
                <button onClick={() => setReaderSettings(s => ({...s, theme: 'sepia'}))} className={`p-1 ${readerSettings.theme === 'sepia' ? 'text-blue-500' : ''}`}><Coffee size={16}/></button>
                <button onClick={() => setReaderSettings(s => ({...s, theme: 'dark'}))} className={`p-1 ${readerSettings.theme === 'dark' ? 'text-blue-500' : ''}`}><Moon size={16}/></button>
             </div>
          </div>
        </div>

        <div className={`max-w-2xl mx-auto px-6 py-12 ${fontClasses[readerSettings.font]}`} style={{ fontSize: `${readerSettings.size}px`, lineHeight: '1.8' }}>
          <div className="mb-12 border-b border-black/10 pb-8">
            <h1 className="text-4xl font-bold mb-4 leading-tight">{readerItem.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-base opacity-60 mb-8">
               <span className="flex items-center gap-1"><ExternalLink size={16}/> {new URL(readerItem.url).hostname}</span>
               <span>•</span>
               <span className="flex items-center gap-1"><Clock size={16}/> {readerItem.readingTime} read</span>
               <span>•</span>
               <span className="flex items-center gap-1"><Layout size={16}/> {readerItem.difficulty}</span>
               <span>•</span>
               <span>{readerItem.date}</span>
            </div>
            {readerItem.image && (
              <div className="mb-8 rounded-xl overflow-hidden shadow-lg">
                <img src={readerItem.image} alt="Cover" className="w-full h-auto object-cover max-h-[400px]" onError={(e) => e.target.style.display = 'none'} />
              </div>
            )}
          </div>
          <div className="prose-content" dangerouslySetInnerHTML={{ __html: readerItem.content }} />
          <style>{`
            .prose-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 2rem 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .prose-content p { margin-bottom: 1.5em; }
            .prose-content h1, .prose-content h2, .prose-content h3 { margin-top: 2em; margin-bottom: 0.5em; font-weight: bold; line-height: 1.3; }
            .prose-content a { text-decoration: underline; text-underline-offset: 4px; color: inherit; opacity: 0.8; }
            .prose-content blockquote { border-left: 4px solid currentColor; opacity: 0.7; padding-left: 1rem; margin: 2rem 0; font-style: italic; }
            .prose-content ul, .prose-content ol { margin: 1.5rem 0; padding-left: 2rem; }
            .prose-content li { margin-bottom: 0.5rem; list-style-type: disc; }
          `}</style>
        </div>
      </div>
    );
  }

  // --- Main View ---
  return (
    <div className="flex h-screen w-full bg-[#fcfcfc] text-gray-800 font-sans">
      <div className="w-64 flex-shrink-0 bg-[#f8f9fa] border-r border-gray-200 flex flex-col pt-8 pb-4">
        <div className="px-5 mb-6 flex items-center justify-between">
           <h1 className="font-bold text-gray-800 flex items-center gap-2"><BookOpen className="text-blue-500" /> ReadIt</h1>
           <button onClick={() => setIsAdding(true)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all" title="Add New Link">
             <Plus size={20} />
           </button>
        </div>
        <div className="px-3 flex-1 overflow-y-auto">
          <NavItem id="inbox" icon={Inbox} label="Inbox" count={bookmarks.filter(b => !b.isArchived).length} />
          <NavItem id="favorites" icon={Star} label="Favorites" count={bookmarks.filter(b => b.isFavorite && !b.isArchived).length} />
          <NavItem id="archive" icon={Archive} label="Logbook" count={bookmarks.filter(b => b.isArchived).length} />
          <div className="mt-8 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categories</div>
          {['Technology', 'Design', 'Science'].map(cat => (
             <button key={cat} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"><Tag size={16} className="text-gray-400" />{cat}</button>
          ))}
        </div>
        <div className="px-3 mt-auto mb-2"><NavItem id="settings" icon={Settings} label="Settings" count={0} /></div>
        <div className="px-5 pt-4 border-t border-gray-200">
           <div className="bg-white border border-gray-200 rounded-lg flex items-center px-3 py-1.5 shadow-sm">
             <Search size={14} className="text-gray-400" />
             <input type="text" placeholder="Quick Search..." className="w-full ml-2 text-sm outline-none placeholder:text-gray-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-white relative">
        <div className="h-16 flex items-center justify-between px-8 border-b border-gray-50 bg-white/80 backdrop-blur sticky top-0 z-10">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 capitalize">{activeView}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeView === 'settings' ? (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Key size={24} /></div>
                  <div><h3 className="text-lg font-bold text-gray-900">API Configuration</h3><p className="text-gray-500 text-sm">Manage your Gemini API key</p></div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Gemini API Key</label>
                    <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIzaSy..." className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all font-mono text-sm" />
                    <p className="mt-2 text-xs text-gray-400">Stored locally in your browser.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Server size={24} /></div>
                    <div><h3 className="text-lg font-bold text-gray-900">AI Model</h3><p className="text-gray-500 text-sm">Select which model to use</p></div>
                  </div>
                  <button onClick={fetchModels} disabled={!apiKey || isLoadingModels} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium">
                    <RefreshCw size={14} className={isLoadingModels ? "animate-spin" : ""} /> {isLoadingModels ? "Loading..." : "Load Models"}
                  </button>
                </div>

                <div className="space-y-4">
                  {availableModels.length > 0 ? (
                    <>
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        <input type="text" placeholder="Search models (e.g., 'flash', 'pro')..." value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-500 outline-none" />
                      </div>
                      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                        {availableModels
                          .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()))
                          .map(model => (
                            <button key={model.name} onClick={() => setSelectedModel(model.name)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group ${selectedModel === model.name ? 'bg-purple-50' : ''}`}>
                              <div>
                                <div className={`font-medium text-sm ${selectedModel === model.name ? 'text-purple-700' : 'text-gray-900'}`}>{model.displayName || model.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{model.name}</div>
                              </div>
                              {selectedModel === model.name && <Check size={16} className="text-purple-600" />}
                            </button>
                          ))}
                      </div>
                    </>
                  ) : (
                     <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                       <p className="text-gray-500 text-sm">Click "Load Models" to fetch available models associated with your API key.</p>
                       <div className="mt-4 p-2 bg-white inline-block rounded border border-gray-200 text-xs font-mono">Current: {selectedModel}</div>
                     </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {displayBookmarks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                  <Inbox size={48} className="mb-4 stroke-1" />
                  <p>No items in {activeView}</p>
                </div>
              ) : (
                <div className="space-y-4 pb-20">
                  {displayBookmarks.map(bookmark => (
                    <div key={bookmark.id} onClick={() => setReaderItem(bookmark)} className="group relative bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ring-1 ring-transparent hover:ring-blue-100 hover:border-blue-200">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 pr-4">
                           <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{bookmark.title}</h3>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => toggleFavorite(bookmark.id, e)} className={`p-2 rounded-lg hover:bg-gray-100 ${bookmark.isFavorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-400'}`}><Star size={18} fill={bookmark.isFavorite ? "currentColor" : "none"} /></button>
                          <button onClick={(e) => moveToArchive(bookmark.id, e)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-green-600"><Check size={18} /></button>
                          <button onClick={(e) => deleteBookmark(bookmark.id, e)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed">{bookmark.summary}</p>
                          <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
                             <span className={`px-2 py-0.5 rounded-full bg-${bookmark.difficulty === 'Easy' ? 'green' : bookmark.difficulty === 'Medium' ? 'yellow' : 'red'}-50 text-${bookmark.difficulty === 'Easy' ? 'green' : bookmark.difficulty === 'Medium' ? 'yellow' : 'red'}-600 border border-${bookmark.difficulty === 'Easy' ? 'green' : bookmark.difficulty === 'Medium' ? 'yellow' : 'red'}-100`}>{bookmark.difficulty}</span>
                             <span className="flex items-center gap-1"><Clock size={12} /> {bookmark.readingTime}</span>
                             <span className="flex items-center gap-1"><Tag size={12} /> {bookmark.tags.join(', ')}</span>
                          </div>
                        </div>
                        {bookmark.image && <div className="hidden sm:block w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200"><img src={bookmark.image} className="w-full h-full object-cover" alt="" onError={(e) => e.target.style.display = 'none'} /></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {activeView !== 'settings' && (
          <div className="absolute bottom-8 right-8 z-50">
             <button onClick={() => setIsAdding(true)} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"><Plus size={28} /></button>
          </div>
        )}

        {isAdding && (
          <div className="absolute inset-0 z-[60] bg-white/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !isProcessing && setIsAdding(false)}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 p-6 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">New Bookmark</h3>
                {!isProcessing && <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>}
              </div>
              <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">URL</label>
                   <input autoFocus type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://example.com/article" className="w-full text-lg border-b-2 border-gray-200 focus:border-blue-500 outline-none py-2 px-1 bg-transparent transition-colors" onKeyDown={e => e.key === 'Enter' && handleAddBookmark(e)} />
                </div>
                {isProcessing ? (
                  <div className="py-8 flex flex-col items-center justify-center text-blue-500">
                    <div className="animate-spin mb-3"><Sparkles size={24} /></div>
                    <span className="text-sm font-medium animate-pulse">{processingStatus}</span>
                    <span className="text-xs text-gray-400 mt-1">Using model: {selectedModel}</span>
                  </div>
                ) : (
                  <div className="flex justify-end pt-4">
                     <button onClick={handleAddBookmark} disabled={!newUrl} className="bg-blue-500 text-white px-6 py-2 rounded-full font-medium shadow-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Save to Inbox</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;