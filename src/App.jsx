import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Inbox, 
  Star, 
  Archive, 
  Trash2, 
  Tag, 
  Clock, 
  BookOpen, 
  X, 
  ChevronLeft,
  Type,
  Sun,
  Moon,
  Coffee,
  Check,
  Search,
  Layout,
  ExternalLink,
  Sparkles,
  Settings,
  Key
} from 'lucide-react';

const App = () => {
  // --- State ---
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('things3-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeView, setActiveView] = useState('inbox'); // inbox, favorites, archive, settings
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [readerItem, setReaderItem] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // API Key State
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini-api-key') || '';
  });

  // Reader Mode Settings
  const [readerSettings, setReaderSettings] = useState({
    theme: 'white', 
    font: 'sans', 
    size: 18,
  });

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('things3-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('gemini-api-key', apiKey);
  }, [apiKey]);

  // --- Handlers ---
  const handleAddBookmark = async (e) => {
    e.preventDefault();
    if (!newUrl) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: newUrl,
          apiKey: apiKey // Pass the key to the backend
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
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
      setActiveView('inbox'); // Switch back to inbox to see new item
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Failed to analyze URL. Please check the console or try a different link.");
    } finally {
      setIsProcessing(false);
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

  // Reader Mode
  if (readerItem) {
    const themeClasses = {
      white: 'bg-white text-gray-900',
      dark: 'bg-gray-900 text-gray-300',
      sepia: 'bg-[#f8f1e3] text-[#4f321c]'
    };

    const fontClasses = {
      sans: 'font-sans',
      serif: 'font-serif',
      mono: 'font-mono'
    };

    return (
      <div className={`fixed inset-0 z-50 overflow-y-auto transition-colors duration-300 ${themeClasses[readerSettings.theme]}`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b transition-colors ${
           readerSettings.theme === 'dark' ? 'border-gray-800 bg-gray-900/95' : 
           readerSettings.theme === 'sepia' ? 'border-[#e0d6c2] bg-[#f8f1e3]/95' : 'border-gray-100 bg-white/95'
        } backdrop-blur-sm`}>
          <button 
            onClick={() => setReaderItem(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-medium">Back</span>
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
            <div className="flex flex-wrap items-center gap-4 text-base opacity-60">
               <span className="flex items-center gap-1"><ExternalLink size={16}/> {new URL(readerItem.url).hostname}</span>
               <span>•</span>
               <span className="flex items-center gap-1"><Clock size={16}/> {readerItem.readingTime} read</span>
               <span>•</span>
               <span className="flex items-center gap-1"><Layout size={16}/> {readerItem.difficulty}</span>
               <span>•</span>
               <span>{readerItem.date}</span>
            </div>
          </div>
          <div dangerouslySetInnerHTML={{ __html: readerItem.content }} />
        </div>
      </div>
    );
  }

  // --- Main App View ---
  return (
    <div className="flex h-screen w-full bg-[#fcfcfc] text-gray-800 font-sans">
      
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 bg-[#f8f9fa] border-r border-gray-200 flex flex-col pt-8 pb-4">
        <div className="px-5 mb-6 flex items-center justify-between">
           <h1 className="font-bold text-gray-800 flex items-center gap-2">
             <BookOpen className="text-blue-500" />
             ReadIt
           </h1>
           <button 
             onClick={() => setIsAdding(true)} 
             className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
             title="Add New Link"
           >
             <Plus size={20} />
           </button>
        </div>

        <div className="px-3 flex-1 overflow-y-auto">
          <NavItem id="inbox" icon={Inbox} label="Inbox" count={bookmarks.filter(b => !b.isArchived).length} />
          <NavItem id="favorites" icon={Star} label="Favorites" count={bookmarks.filter(b => b.isFavorite && !b.isArchived).length} />
          <NavItem id="archive" icon={Archive} label="Logbook" count={bookmarks.filter(b => b.isArchived).length} />
          
          <div className="mt-8 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Categories
          </div>
          {['Technology', 'Design', 'Science'].map(cat => (
             <button key={cat} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
               <Tag size={16} className="text-gray-400" />
               {cat}
             </button>
          ))}
        </div>

        {/* Sidebar Footer with Settings */}
        <div className="px-3 mt-auto mb-2">
           <NavItem id="settings" icon={Settings} label="Settings" count={0} />
        </div>

        <div className="px-5 pt-4 border-t border-gray-200">
           <div className="bg-white border border-gray-200 rounded-lg flex items-center px-3 py-1.5 shadow-sm">
             <Search size={14} className="text-gray-400" />
             <input 
               type="text" 
               placeholder="Quick Search..." 
               className="w-full ml-2 text-sm outline-none placeholder:text-gray-400"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        <div className="h-16 flex items-center justify-between px-8 border-b border-gray-50 bg-white/80 backdrop-blur sticky top-0 z-10">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 capitalize">
            {activeView}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Settings View */}
          {activeView === 'settings' ? (
            <div className="max-w-2xl">
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <Key size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">AI Configuration</h3>
                    <p className="text-gray-500 text-sm">Manage your API keys for advanced features</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Gemini API Key</label>
                    <input 
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all font-mono text-sm"
                    />
                    <p className="mt-2 text-xs text-gray-400">
                      Your key is stored locally in your browser. Leaving this empty will use basic web scraping instead of AI.
                    </p>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-50 flex justify-end">
                    <button 
                      onClick={() => setActiveView('inbox')}
                      className="bg-gray-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Bookmarks List View */
            <>
              {displayBookmarks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                  <Inbox size={48} className="mb-4 stroke-1" />
                  <p>No items in {activeView}</p>
                </div>
              ) : (
                <div className="space-y-4 pb-20">
                  {displayBookmarks.map(bookmark => (
                    <div 
                      key={bookmark.id}
                      onClick={() => setReaderItem(bookmark)}
                      className="group relative bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ring-1 ring-transparent hover:ring-blue-100 hover:border-blue-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {bookmark.title}
                        </h3>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => toggleFavorite(bookmark.id, e)}
                            className={`p-2 rounded-lg hover:bg-gray-100 ${bookmark.isFavorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-400'}`}
                          >
                            <Star size={18} fill={bookmark.isFavorite ? "currentColor" : "none"} />
                          </button>
                          <button 
                            onClick={(e) => moveToArchive(bookmark.id, e)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-green-600"
                          >
                             <Check size={18} />
                          </button>
                          <button 
                            onClick={(e) => deleteBookmark(bookmark.id, e)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed">
                        {bookmark.summary}
                      </p>

                      <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
                         <span className={`px-2 py-0.5 rounded-full bg-${bookmark.difficulty === 'Easy' ? 'green' : bookmark.difficulty === 'Medium' ? 'yellow' : 'red'}-50 text-${bookmark.difficulty === 'Easy' ? 'green' : bookmark.difficulty === 'Medium' ? 'yellow' : 'red'}-600 border border-${bookmark.difficulty === 'Easy' ? 'green' : bookmark.difficulty === 'Medium' ? 'yellow' : 'red'}-100`}>
                           {bookmark.difficulty}
                         </span>
                         <span className="flex items-center gap-1">
                           <Clock size={12} /> {bookmark.readingTime}
                         </span>
                         <span className="flex items-center gap-1">
                            <Tag size={12} />
                            {bookmark.tags.join(', ')}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Floating Add Button */}
        {activeView !== 'settings' && (
          <div className="absolute bottom-8 right-8 z-50">
             <button
               onClick={() => setIsAdding(true)}
               className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
             >
               <Plus size={28} />
             </button>
          </div>
        )}

        {/* Add Modal */}
        {isAdding && (
          <div className="absolute inset-0 z-[60] bg-white/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !isProcessing && setIsAdding(false)}>
            <div 
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 p-6 transform transition-all scale-100"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">New Bookmark</h3>
                {!isProcessing && (
                  <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">URL</label>
                   <input 
                     autoFocus
                     type="url" 
                     value={newUrl}
                     onChange={e => setNewUrl(e.target.value)}
                     placeholder="https://example.com/article"
                     className="w-full text-lg border-b-2 border-gray-200 focus:border-blue-500 outline-none py-2 px-1 bg-transparent transition-colors"
                     onKeyDown={e => e.key === 'Enter' && handleAddBookmark(e)}
                   />
                </div>

                {isProcessing ? (
                  <div className="py-8 flex flex-col items-center justify-center text-blue-500">
                    <div className="animate-spin mb-3">
                      <Sparkles size={24} />
                    </div>
                    <span className="text-sm font-medium animate-pulse">
                      {apiKey ? "Gemini AI is analyzing..." : "Reading content..."}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">Generating summary & tags</span>
                  </div>
                ) : (
                  <div className="flex justify-end pt-4">
                     <button 
                       onClick={handleAddBookmark}
                       disabled={!newUrl}
                       className="bg-blue-500 text-white px-6 py-2 rounded-full font-medium shadow-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                     >
                       Save to Inbox
                     </button>
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