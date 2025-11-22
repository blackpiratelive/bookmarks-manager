import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Inbox, 
  Star, 
  Archive, 
  Trash2, 
  Tag, 
  Clock, 
  Zap, 
  BookOpen, 
  X, 
  MoreHorizontal,
  ChevronLeft,
  Type,
  Sun,
  Moon,
  Coffee,
  Check,
  Search,
  Layout,
  ExternalLink,
  Sparkles
} from 'lucide-react';

// --- Utility: Simulated AI Analysis ---
const simulateAIAnalysis = (url) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock data generation based on rudimentary string hashing for consistency
      const hash = url.length;
      const categories = ['Technology', 'Design', 'Science', 'Productivity', 'Finance'];
      const difficulties = ['Easy', 'Medium', 'Advanced'];
      const category = categories[hash % categories.length];
      const readTime = Math.max(2, Math.floor(Math.random() * 15)) + ' min';
      const difficulty = difficulties[hash % difficulties.length];
      
      resolve({
        title: `Article about ${category} from ${new URL(url).hostname}`,
        summary: "This is a simulated AI-generated summary. The content discusses the impact of modern trends on the subject matter, exploring various facets and offering a comprehensive overview of the current landscape. Key points include innovation, sustainability, and future projections.",
        tags: [category.toLowerCase(), 'must-read', '2025', 'research'],
        category: category,
        readingTime: readTime,
        difficulty: difficulty,
        date: new Date().toLocaleDateString(),
        content: `
          <h2 class="text-2xl font-bold mb-4">The Future of ${category}</h2>
          <p class="mb-4">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p class="mb-4">Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
          <h3 class="text-xl font-bold mb-3">Key Takeaways</h3>
          <p class="mb-4">Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
          <p class="mb-4">Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.</p>
          <blockquote class="border-l-4 border-blue-500 pl-4 italic my-6 text-gray-600 dark:text-gray-400">
            "Innovation distinguishes between a leader and a follower."
          </blockquote>
          <p class="mb-4">At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.</p>
        `
      });
    }, 1500);
  });
};

const App = () => {
  // --- State ---
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('things3-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeView, setActiveView] = useState('inbox'); // inbox, favorites, archive, specific-tag
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [readerItem, setReaderItem] = useState(null); // The item currently open in Reader Mode
  const [searchTerm, setSearchTerm] = useState('');

  // Reader Mode Settings
  const [readerSettings, setReaderSettings] = useState({
    theme: 'white', // white, dark, sepia
    font: 'sans', // sans, serif, mono
    size: 18,
  });

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('things3-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // --- Handlers ---
  const handleAddBookmark = async (e) => {
    e.preventDefault();
    if (!newUrl) return;

    setIsProcessing(true);
    try {
      const aiData = await simulateAIAnalysis(newUrl);
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
    } catch (error) {
      console.error("Analysis failed", error);
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
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(term) || 
        b.summary.toLowerCase().includes(term) ||
        b.tags.some(t => t.includes(term))
      );
    }

    // View filter
    switch (activeView) {
      case 'inbox': return filtered.filter(b => !b.isArchived);
      case 'favorites': return filtered.filter(b => b.isFavorite && !b.isArchived);
      case 'archive': return filtered.filter(b => b.isArchived);
      default: return filtered;
    }
  };

  const displayBookmarks = getFilteredBookmarks();

  // --- Components ---

  // 1. Sidebar Item
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

  // 2. Reader Mode
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
        {/* Reader Header */}
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
             {/* Appearance Menu */}
             <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/5">
                <button 
                  onClick={() => setReaderSettings(s => ({...s, size: Math.max(12, s.size - 2)}))}
                  className="p-1 hover:text-blue-500"
                >
                  <Type size={14} />
                </button>
                <div className="w-px h-4 bg-gray-400/30"></div>
                <button 
                   onClick={() => setReaderSettings(s => ({...s, size: Math.min(32, s.size + 2)}))}
                   className="p-1 hover:text-blue-500"
                >
                  <Type size={20} />
                </button>
                
                <div className="w-px h-4 bg-gray-400/30 mx-2"></div>

                <button 
                  onClick={() => setReaderSettings(s => ({...s, font: 'sans'}))} 
                  className={`text-xs font-sans font-bold ${readerSettings.font === 'sans' ? 'text-blue-500' : ''}`}>Ag
                </button>
                <button 
                  onClick={() => setReaderSettings(s => ({...s, font: 'serif'}))} 
                  className={`text-xs font-serif font-bold ${readerSettings.font === 'serif' ? 'text-blue-500' : ''}`}>Ag
                </button>
                <button 
                  onClick={() => setReaderSettings(s => ({...s, font: 'mono'}))} 
                  className={`text-xs font-mono font-bold ${readerSettings.font === 'mono' ? 'text-blue-500' : ''}`}>Ag
                </button>

                <div className="w-px h-4 bg-gray-400/30 mx-2"></div>

                <button onClick={() => setReaderSettings(s => ({...s, theme: 'white'}))} className={`p-1 ${readerSettings.theme === 'white' ? 'text-blue-500' : ''}`}><Sun size={16}/></button>
                <button onClick={() => setReaderSettings(s => ({...s, theme: 'sepia'}))} className={`p-1 ${readerSettings.theme === 'sepia' ? 'text-blue-500' : ''}`}><Coffee size={16}/></button>
                <button onClick={() => setReaderSettings(s => ({...s, theme: 'dark'}))} className={`p-1 ${readerSettings.theme === 'dark' ? 'text-blue-500' : ''}`}><Moon size={16}/></button>
             </div>
          </div>
        </div>

        {/* Reader Content */}
        <div className={`max-w-2xl mx-auto px-6 py-12 ${fontClasses[readerSettings.font]}`} style={{ fontSize: `${readerSettings.size}px`, lineHeight: '1.8' }}>
          {/* Metadata Header */}
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
      
      {/* Sidebar - Things 3 Style */}
      <div className="w-64 flex-shrink-0 bg-[#f8f9fa] border-r border-gray-200 flex flex-col pt-8 pb-4">
        <div className="px-5 mb-6">
           <h1 className="font-bold text-gray-800 flex items-center gap-2">
             <BookOpen className="text-blue-500" />
             ReadIt
           </h1>
        </div>

        <div className="px-3 flex-1 overflow-y-auto">
          <NavItem id="inbox" icon={Inbox} label="Inbox" count={bookmarks.filter(b => !b.isArchived).length} />
          <NavItem id="favorites" icon={Star} label="Favorites" count={bookmarks.filter(b => b.isFavorite && !b.isArchived).length} />
          <NavItem id="archive" icon={Archive} label="Logbook" count={bookmarks.filter(b => b.isArchived).length} />
          
          <div className="mt-8 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Categories
          </div>
          {/* Dynamic Categories (Simulated) */}
          {['Technology', 'Design', 'Science'].map(cat => (
             <button key={cat} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
               <Tag size={16} className="text-gray-400" />
               {cat}
             </button>
          ))}
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
        {/* Toolbar */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-gray-50 bg-white/80 backdrop-blur sticky top-0 z-10">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 capitalize">
            {activeView}
          </h2>
          <div className="flex items-center gap-2">
             {/* Action buttons could go here */}
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
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
        </div>

        {/* Floating Add Button (Things 3 style) */}
        <div className="absolute bottom-8 right-8">
           <button
             onClick={() => setIsAdding(true)}
             className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
           >
             <Plus size={28} />
           </button>
        </div>

        {/* Add Modal */}
        {isAdding && (
          <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !isProcessing && setIsAdding(false)}>
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
                    <span className="text-sm font-medium animate-pulse">AI is reading content...</span>
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