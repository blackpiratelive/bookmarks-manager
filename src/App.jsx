import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Inbox, Star, Archive, Trash2, Tag, Clock, BookOpen, 
  X, ChevronLeft, ChevronRight, Type, Sun, Moon, Coffee, Check, Search, 
  Layout, ExternalLink, Sparkles, Settings, Key, Image as ImageIcon,
  RefreshCw, Server, AlertCircle, MoreHorizontal, FolderInput, Menu,
  Youtube, Code2, ShoppingBag, GraduationCap, FileText, ThumbsUp, GitFork, User, ShoppingCart,
  Download, Upload
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
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for mobile sidebar

  // Settings State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini-api-key') || '');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('gemini-model') || 'gemini-1.5-flash');
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  // Reader/Carousel State
  const [readerSettings, setReaderSettings] = useState({ theme: 'white', font: 'sans', size: 18 });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Helper ref for file input
  const fileInputRef = useRef(null);

  // --- Effects ---
  useEffect(() => localStorage.setItem('things3-bookmarks', JSON.stringify(bookmarks)), [bookmarks]);
  useEffect(() => localStorage.setItem('gemini-api-key', apiKey), [apiKey]);
  useEffect(() => localStorage.setItem('gemini-model', selectedModel), [selectedModel]);
  
  useEffect(() => {
    const closeMenu = () => setActiveMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (readerItem) setCurrentImageIndex(0); // Reset carousel when opening new item
  }, [readerItem]);

  // Close sidebar on view change on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeView]);


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

      const responseText = await response.text();
      let aiData;
      try {
        aiData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Raw Server Response:", responseText);
        throw new Error(`Invalid JSON from server.`);
      }

      if (!response.ok) throw new Error(aiData.details || aiData.error || 'Network error');
      
      setProcessingStatus('Categorizing...');
      
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
      setActiveView(aiData.category ? aiData.category.toLowerCase() : 'inbox');
    } catch (error) {
      console.error("Analysis failed", error);
      alert(`Failed to analyze: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // --- Import / Export Handlers ---
  const handleExport = () => {
    const data = {
      bookmarks,
      settings: {
        apiKey,
        selectedModel
      },
      exportDate: new Date().toISOString(),
      version: 1
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `readit-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Validate structure
        if (!importedData.bookmarks || !Array.isArray(importedData.bookmarks)) {
          throw new Error("Invalid backup file format.");
        }

        if (confirm(`Restore ${importedData.bookmarks.length} bookmarks and settings? This will overwrite current data.`)) {
          setBookmarks(importedData.bookmarks);
          
          if (importedData.settings) {
            if (importedData.settings.apiKey) setApiKey(importedData.settings.apiKey);
            if (importedData.settings.selectedModel) setSelectedModel(importedData.settings.selectedModel);
          }
          
          alert("Import successful!");
        }
      } catch (err) {
        alert("Failed to import: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = null; // Reset so same file can be selected again
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

  const changeCategory = (id, newCategory, e) => {
    e.stopPropagation();
    setBookmarks(bookmarks.map(b => b.id === id ? { ...b, category: newCategory } : b));
    setActiveMenuId(null);
  };

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
    if (activeView === 'inbox') return filtered.filter(b => !b.isArchived);
    if (activeView === 'favorites') return filtered.filter(b => b.isFavorite && !b.isArchived);
    if (activeView === 'archive') return filtered.filter(b => b.isArchived);
    return filtered.filter(b => b.category && b.category.toLowerCase() === activeView.toLowerCase() && !b.isArchived);
  };

  const displayBookmarks = getFilteredBookmarks();

  // --- Components ---

  const CategoryMenu = ({ bookmark }) => (
    <div className="absolute right-0 top-8 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-40 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">Move to...</div>
      {['Videos', 'Coding', 'Articles', 'Research', 'Shopping'].map(cat => (
        <button
          key={cat}
          onClick={(e) => changeCategory(bookmark.id, cat, e)}
          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${bookmark.category === cat ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
        >
          {cat === 'Videos' && <Youtube size={14} />}
          {cat === 'Coding' && <Code2 size={14} />}
          {cat === 'Shopping' && <ShoppingBag size={14} />}
          {cat === 'Articles' && <FileText size={14} />}
          {cat === 'Research' && <GraduationCap size={14} />}
          {cat}
        </button>
      ))}
    </div>
  );

  const CardActions = ({ bookmark }) => (
    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1 rounded-lg backdrop-blur z-10" onClick={e => e.stopPropagation()}>
      <button onClick={(e) => toggleFavorite(bookmark.id, e)} className={`p-1.5 hover:bg-gray-100 rounded transition-colors ${bookmark.isFavorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}>
        <Star size={16} fill={bookmark.isFavorite ? "currentColor" : "none"} />
      </button>
      
      <div className="relative">
        <button 
          onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === bookmark.id ? null : bookmark.id); }}
          className={`p-1.5 hover:bg-gray-100 rounded transition-colors ${activeMenuId === bookmark.id ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900'}`}
        >
          <MoreHorizontal size={16} />
        </button>
        {activeMenuId === bookmark.id && <CategoryMenu bookmark={bookmark} />}
      </div>

      <button onClick={(e) => deleteBookmark(bookmark.id, e)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500">
        <Trash2 size={16} />
      </button>
    </div>
  );

  // --- Renderers ---
  const renderVideoCard = (item) => (
    <div className="flex flex-col gap-4 h-full">
       {item.videoEmbed ? <div className="w-full aspect-video rounded-lg overflow-hidden bg-black shadow-inner"><iframe src={item.videoEmbed} title={item.title} className="w-full h-full pointer-events-none" /></div> : <div className="w-full h-48 bg-gray-900 rounded-lg flex items-center justify-center text-gray-500 relative overflow-hidden">{item.image ? <img src={item.image} className="w-full h-full object-cover opacity-80" /> : <Youtube size={48} />}<div className="absolute inset-0 flex items-center justify-center bg-black/20"><div className="bg-white/20 backdrop-blur-sm p-3 rounded-full border border-white/50"><Youtube size={32} className="text-white fill-current" /></div></div></div>}
       <div className="flex flex-col flex-1">
         <h3 className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight hover:text-blue-600 mb-2">{item.title}</h3>
         <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            {item.metadata?.platform && <span className="flex items-center gap-1 text-red-600 font-medium"><Youtube size={14} /> {item.metadata.platform}</span>}
            {item.metadata?.likes && <span className="flex items-center gap-1"><ThumbsUp size={14} /> {item.metadata.likes}</span>}
            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-bold">AI Summary</span>
         </div>
         <p className="text-gray-600 text-sm leading-relaxed flex-1 line-clamp-3">{item.summary}</p>
       </div>
    </div>
  );

  const renderCodingCard = (item) => (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-3">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-md border border-gray-200"><Code2 size={24} className="text-gray-700" /></div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-1">{item.title}</h3>
              {item.metadata?.author && <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><User size={10}/> {item.metadata.author}</span>}
            </div>
         </div>
      </div>
      <p className="text-sm text-gray-600 mb-4 flex-1 line-clamp-3">{item.summary}</p>
      <div className="flex items-center gap-4 py-3 px-4 bg-gray-50 rounded-lg border border-gray-100 text-sm mt-auto">
         <div className="flex items-center gap-1.5 font-medium text-gray-700"><Star size={16} className="text-yellow-500 fill-yellow-500" />{item.metadata?.stars || '0'}</div>
         <div className="flex items-center gap-1.5 font-medium text-gray-700"><GitFork size={16} className="text-gray-400" />{item.metadata?.forks || '0'}</div>
         <div className="ml-auto text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">{item.metadata?.platform || 'GitHub'}</div>
      </div>
    </div>
  );

  const renderShoppingCard = (item) => (
    <div className="flex gap-4 h-full">
      <div className="w-28 h-32 flex-shrink-0 bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-center relative overflow-hidden group-hover:border-blue-200 transition-colors">
         {item.image ? <img src={item.image} className="max-w-full max-h-full object-contain" /> : <ShoppingBag className="text-gray-300" />}
      </div>
      <div className="flex-1 flex flex-col">
         <div className="flex justify-between items-start">
            <h3 className="font-bold text-gray-900 text-lg line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">{item.title}</h3>
            {item.metadata?.price && <span className="ml-2 bg-green-100 text-green-700 font-bold px-2.5 py-1 rounded-md text-sm whitespace-nowrap shadow-sm">{item.metadata.price}</span>}
         </div>
         <p className="text-sm text-gray-500 mt-2 mb-3 line-clamp-2 flex-1">{item.summary}</p>
         <div className="flex flex-wrap gap-2 mt-auto">
            {item.tags.slice(0,3).map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200">{t}</span>)}
         </div>
      </div>
    </div>
  );

  const renderStandardCard = (item) => (
    <div className="flex gap-4 h-full">
      <div className="flex-1 flex flex-col">
        <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{item.title}</h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed mt-1 flex-1">{item.summary}</p>
        <div className="flex items-center gap-4 text-xs font-medium text-gray-400 mt-auto">
            <span className={`px-2 py-0.5 rounded-full bg-${item.difficulty === 'Easy' ? 'green' : item.difficulty === 'Medium' ? 'yellow' : 'red'}-50 text-${item.difficulty === 'Easy' ? 'green' : item.difficulty === 'Medium' ? 'yellow' : 'red'}-600 border border-${item.difficulty === 'Easy' ? 'green' : item.difficulty === 'Medium' ? 'yellow' : 'red'}-100`}>{item.difficulty}</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {item.readingTime}</span>
            <span className="flex items-center gap-1"><Tag size={12} /> {item.tags.slice(0, 2).join(', ')}</span>
        </div>
      </div>
      {item.image && <div className="hidden sm:block w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200 shadow-sm"><img src={item.image} className="w-full h-full object-cover" alt="" onError={(e) => e.target.style.display = 'none'} /></div>}
    </div>
  );

  // --- Sidebar Content ---
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 mb-6 flex items-center justify-between">
          <h1 className="font-bold text-gray-800 flex items-center gap-2"><BookOpen className="text-blue-500" /> ReadIt</h1>
          <button onClick={() => setIsAdding(true)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"><Plus size={20} /></button>
      </div>
      <div className="px-3 flex-1 overflow-y-auto">
        <NavItem id="inbox" icon={Inbox} label="Inbox" count={bookmarks.filter(b => !b.isArchived).length} />
        <NavItem id="favorites" icon={Star} label="Favorites" count={bookmarks.filter(b => b.isFavorite && !b.isArchived).length} />
        <NavItem id="archive" icon={Archive} label="Logbook" count={bookmarks.filter(b => b.isArchived).length} />
        <div className="mt-8 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Library</div>
        <NavItem id="videos" icon={Youtube} label="Videos" count={bookmarks.filter(b => b.category === 'Videos' && !b.isArchived).length} />
        <NavItem id="coding" icon={Code2} label="Coding" count={bookmarks.filter(b => b.category === 'Coding' && !b.isArchived).length} />
        <NavItem id="articles" icon={FileText} label="Articles" count={bookmarks.filter(b => b.category === 'Articles' && !b.isArchived).length} />
        <NavItem id="research" icon={GraduationCap} label="Research" count={bookmarks.filter(b => b.category === 'Research' && !b.isArchived).length} />
        <NavItem id="shopping" icon={ShoppingBag} label="Shopping" count={bookmarks.filter(b => b.category === 'Shopping' && !b.isArchived).length} />
      </div>
      <div className="px-3 mt-auto mb-2"><NavItem id="settings" icon={Settings} label="Settings" count={0} /></div>
    </div>
  );

  // Reusable NavItem for Sidebar
  const NavItem = ({ id, icon: Icon, label, count }) => (
    <button onClick={() => setActiveView(id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${activeView === id ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>
      <div className="flex items-center gap-3"><Icon size={18} className={activeView === id ? 'text-blue-500' : 'text-gray-400'} /><span>{label}</span></div>
      {count > 0 && <span className="text-xs font-semibold text-gray-400">{count}</span>}
    </button>
  );

  return (
    <div className="flex h-screen w-full bg-[#fcfcfc] text-gray-800 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#f8f9fa] border-r border-gray-200 pt-8 pb-4 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <div className="h-16 flex items-center justify-between px-4 sm:px-8 border-b border-gray-50 bg-white/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-1 -ml-1 text-gray-500 hover:bg-gray-100 rounded-lg">
              <Menu size={24} />
            </button>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 capitalize">{activeView}</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          {activeView === 'settings' ? (
            /* Settings View */
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Key size={24} /></div>
                  <div><h3 className="text-lg font-bold text-gray-900">API Configuration</h3><p className="text-gray-500 text-sm">Manage your Gemini API key</p></div>
                </div>
                <div className="space-y-4">
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIzaSy..." className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all font-mono text-sm" />
                  <p className="text-xs text-gray-400">Stored locally in your browser.</p>
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
                {availableModels.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {availableModels.filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase())).map(model => (
                      <button key={model.name} onClick={() => setSelectedModel(model.name)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group ${selectedModel === model.name ? 'bg-purple-50' : ''}`}>
                        <div><div className={`font-medium text-sm ${selectedModel === model.name ? 'text-purple-700' : 'text-gray-900'}`}>{model.displayName || model.name}</div></div>
                        {selectedModel === model.name && <Check size={16} className="text-purple-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Data Management Section */}
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-50 text-green-600 rounded-lg"><FolderInput size={24} /></div>
                  <div><h3 className="text-lg font-bold text-gray-900">Data Management</h3><p className="text-gray-500 text-sm">Export or import your bookmarks and settings</p></div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors">
                    <Download size={18} /> Export Data
                  </button>
                  
                  <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors">
                    <Upload size={18} /> Import Data
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange} 
                    accept=".json" 
                    className="hidden" 
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Bookmarks Grid */
            <div className={activeView === 'videos' || activeView === 'coding' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6" : "space-y-4 pb-20"}>
              {displayBookmarks.map(bookmark => (
                <div key={bookmark.id} onClick={() => setReaderItem(bookmark)} className="group relative bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ring-1 ring-transparent hover:ring-blue-100 hover:border-blue-200">
                   <CardActions bookmark={bookmark} />
                   {bookmark.category === 'Videos' ? renderVideoCard(bookmark) : bookmark.category === 'Coding' ? renderCodingCard(bookmark) : bookmark.category === 'Shopping' ? renderShoppingCard(bookmark) : renderStandardCard(bookmark)}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {activeView !== 'settings' && (
          <div className="absolute bottom-8 right-4 sm:right-8 z-50">
             <button onClick={() => setIsAdding(true)} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"><Plus size={24} className="sm:w-7 sm:h-7" /></button>
          </div>
        )}
        
        {isAdding && (
           <div className="absolute inset-0 z-[60] bg-white/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !isProcessing && setIsAdding(false)}>
             <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">Add Link</h3>
                <input autoFocus type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Paste URL here..." className="w-full text-lg border-b-2 py-2 outline-none focus:border-blue-500 bg-transparent" onKeyDown={e => e.key === 'Enter' && handleAddBookmark(e)} />
                {isProcessing ? <div className="py-8 flex flex-col items-center justify-center text-blue-500"><div className="animate-spin mb-3"><Sparkles size={24} /></div><span className="text-sm font-medium animate-pulse">{processingStatus}</span></div> : <div className="flex justify-end pt-4"><button onClick={handleAddBookmark} disabled={!newUrl} className="bg-blue-500 text-white px-6 py-2 rounded-full font-medium shadow-md hover:bg-blue-600 disabled:opacity-50 transition-all">Save to Inbox</button></div>}
             </div>
           </div>
        )}

        {/* --- MODAL / READER --- */}
        {readerItem && (
          <div className={`fixed inset-0 z-50 overflow-y-auto transition-colors duration-300 ${readerSettings.theme === 'dark' ? 'bg-gray-900 text-gray-300' : readerSettings.theme === 'sepia' ? 'bg-[#f8f1e3] text-[#4f321c]' : 'bg-white text-gray-900'}`}>
            {/* Header */}
            <div className={`sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b transition-colors ${readerSettings.theme === 'dark' ? 'border-gray-800 bg-gray-900/95' : 'border-gray-100 bg-white/95'} backdrop-blur-sm`}>
              <button onClick={() => setReaderItem(null)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors"><ChevronLeft size={20} /> <span className="font-medium">Back</span></button>
              {readerItem.category !== 'Videos' && readerItem.category !== 'Shopping' && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/5">
                    <button onClick={() => setReaderSettings(s => ({...s, size: Math.max(12, s.size - 2)}))} className="p-1 hover:text-blue-500"><Type size={14} /></button>
                    <button onClick={() => setReaderSettings(s => ({...s, size: Math.min(32, s.size + 2)}))} className="p-1 hover:text-blue-500"><Type size={20} /></button>
                    <div className="w-px h-4 bg-gray-400/30 mx-2"></div>
                    <button onClick={() => setReaderSettings(s => ({...s, font: 'sans'}))} className="text-xs font-sans font-bold">Ag</button>
                    <button onClick={() => setReaderSettings(s => ({...s, font: 'serif'}))} className="text-xs font-serif font-bold">Ag</button>
                    <div className="w-px h-4 bg-gray-400/30 mx-2"></div>
                    <button onClick={() => setReaderSettings(s => ({...s, theme: 'white'}))} className="p-1"><Sun size={16}/></button>
                    <button onClick={() => setReaderSettings(s => ({...s, theme: 'dark'}))} className="p-1"><Moon size={16}/></button>
                </div>
              )}
            </div>

            {/* Content Layouts */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
              {readerItem.category === 'Shopping' ? (
                /* --- SHOPPING LAYOUT --- */
                <div className="space-y-8">
                  {/* Carousel */}
                  <div className="relative aspect-square sm:aspect-[4/3] rounded-xl overflow-hidden bg-white border border-gray-100 flex items-center justify-center group">
                     {readerItem.images && readerItem.images.length > 0 ? (
                        <img src={readerItem.images[currentImageIndex]} className="max-w-full max-h-full object-contain" />
                     ) : (
                        <ShoppingBag size={64} className="text-gray-200" />
                     )}
                     {/* Arrows */}
                     {readerItem.images && readerItem.images.length > 1 && (
                       <>
                         <button onClick={(e) => {e.stopPropagation(); setCurrentImageIndex(i => i > 0 ? i - 1 : readerItem.images.length - 1)}} className="absolute left-4 p-2 bg-black/10 hover:bg-black/20 rounded-full text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft/></button>
                         <button onClick={(e) => {e.stopPropagation(); setCurrentImageIndex(i => i < readerItem.images.length - 1 ? i + 1 : 0)}} className="absolute right-4 p-2 bg-black/10 hover:bg-black/20 rounded-full text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight/></button>
                       </>
                     )}
                     {/* Thumbnails */}
                     {readerItem.images && readerItem.images.length > 1 && (
                       <div className="absolute bottom-4 flex gap-2">
                         {readerItem.images.map((_, idx) => (
                           <div key={idx} className={`w-2 h-2 rounded-full ${idx === currentImageIndex ? 'bg-blue-500' : 'bg-black/20'}`} />
                         ))}
                       </div>
                     )}
                  </div>
                  
                  {/* Product Info */}
                  <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
                      <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-gray-900">{readerItem.title}</h1>
                      {readerItem.metadata?.price && <span className="text-2xl sm:text-3xl font-bold text-green-600 bg-green-50 px-4 py-2 rounded-lg whitespace-nowrap">{readerItem.metadata.price}</span>}
                    </div>
                    <a href={readerItem.url} target="_blank" rel="noreferrer" className="inline-block w-full text-center bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors mb-8">
                      Visit Store <ExternalLink size={16} className="inline ml-2"/>
                    </a>

                    {/* Specs */}
                    {readerItem.specifications && Object.keys(readerItem.specifications).length > 0 && (
                      <div className="mb-8">
                        <h3 className="font-bold text-gray-900 mb-4">Specifications</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 text-sm">
                          {Object.entries(readerItem.specifications).map(([key, val]) => (
                            <div key={key} className="flex border-b border-gray-100 py-2">
                              <span className="font-medium text-gray-500 w-1/3 break-words pr-2">{key}</span>
                              <span className="text-gray-900 w-2/3 break-words">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="bg-gray-50 p-6 rounded-xl">
                       <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2"><Sparkles size={16} className="text-blue-500"/> AI Overview</h3>
                       <p className="text-gray-700 leading-relaxed">{readerItem.summary}</p>
                    </div>
                  </div>
                </div>
              ) : readerItem.category === 'Videos' ? (
                /* --- VIDEO LAYOUT --- */
                <div className="space-y-8">
                  <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl">
                    {readerItem.videoEmbed ? <iframe src={readerItem.videoEmbed} title={readerItem.title} className="w-full h-full" allowFullScreen frameBorder="0" /> : <div className="flex items-center justify-center h-full text-gray-500">Video not embeddable</div>}
                  </div>
                  <div className="space-y-6">
                    <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{readerItem.title}</h1>
                    <div className="flex items-center gap-6 text-sm opacity-70">
                      {readerItem.metadata?.platform && <span className="flex items-center gap-2 font-medium text-red-500"><Youtube size={18} /> {readerItem.metadata.platform}</span>}
                      {readerItem.metadata?.likes && <span>{readerItem.metadata.likes} likes</span>}
                      <span>{readerItem.date}</span>
                    </div>
                    <div className={`p-6 rounded-xl border-l-4 border-blue-500 ${readerSettings.theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2 flex items-center gap-2"><Sparkles size={14} /> AI Summary</h3>
                      <p className="text-lg leading-relaxed">{readerItem.summary}</p>
                    </div>
                  </div>
                  <div className="pt-8 border-t border-black/10">
                    <h3 className="font-bold text-lg mb-4 opacity-80">Original Description</h3>
                    <div className={`prose ${readerSettings.theme === 'dark' ? 'prose-invert' : ''} max-w-none whitespace-pre-wrap leading-relaxed opacity-80`}>{readerItem.originalDescription || "No description available."}</div>
                  </div>
                </div>
              ) : (
                /* --- STANDARD LAYOUT --- */
                <div style={{ fontSize: `${readerSettings.size}px`, lineHeight: '1.8' }} className={readerSettings.font === 'serif' ? 'font-serif' : readerSettings.font === 'mono' ? 'font-mono' : 'font-sans'}>
                    <div className="mb-12 border-b border-black/10 pb-8">
                      <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">{readerItem.title}</h1>
                      <div className="flex flex-wrap items-center gap-4 text-base opacity-60 mb-6">
                         <span className="flex items-center gap-1"><ExternalLink size={16}/> {new URL(readerItem.url).hostname}</span>
                         <span className="flex items-center gap-1"><Clock size={16}/> {readerItem.readingTime} read</span>
                         <span className="flex items-center gap-1"><Layout size={16}/> {readerItem.difficulty}</span>
                         <span>{readerItem.date}</span>
                      </div>
                      {readerItem.image && <div className="rounded-xl overflow-hidden shadow-lg mb-8"><img src={readerItem.image} alt="Cover" className="w-full h-auto object-cover max-h-[400px]" onError={(e) => e.target.style.display = 'none'} /></div>}
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;