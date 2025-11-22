import React, { useState, useEffect } from 'react';
import { 
  Plus, Inbox, Star, Archive, Trash2, Tag, Clock, BookOpen, 
  X, ChevronLeft, Type, Sun, Moon, Coffee, Check, Search, 
  Layout, ExternalLink, Sparkles, Settings, Key, Image as ImageIcon,
  RefreshCw, Server, AlertCircle, 
  Youtube, Code2, ShoppingBag, GraduationCap, FileText, ThumbsUp, GitFork, GitBranch, User
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
      setActiveView(aiData.category ? aiData.category.toLowerCase() : 'inbox'); // Auto-switch to new category
    } catch (error) {
      console.error("Analysis failed", error);
      alert(`Failed to analyze: ${error.message}`);
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

    if (activeView === 'inbox') return filtered.filter(b => !b.isArchived);
    if (activeView === 'favorites') return filtered.filter(b => b.isFavorite && !b.isArchived);
    if (activeView === 'archive') return filtered.filter(b => b.isArchived);

    // Category filtering (case insensitive match)
    return filtered.filter(b => b.category && b.category.toLowerCase() === activeView.toLowerCase() && !b.isArchived);
  };

  const displayBookmarks = getFilteredBookmarks();

  // --- Renderers for Different Categories ---

  const renderVideoCard = (item) => (
    <div className="flex flex-col gap-4">
       {/* Embed Video if available */}
       {item.videoEmbed ? (
         <div className="w-full aspect-video rounded-lg overflow-hidden bg-black shadow-inner">
           <iframe 
             src={item.videoEmbed} 
             title={item.title}
             className="w-full h-full" 
             allowFullScreen 
             frameBorder="0"
           />
         </div>
       ) : (
         <div className="w-full h-48 bg-gray-900 rounded-lg flex items-center justify-center text-gray-500">
           {item.image ? <img src={item.image} className="w-full h-full object-cover rounded-lg" /> : <Youtube size={48} />}
         </div>
       )}
       
       <div>
         <div className="flex items-start justify-between mb-2">
           <h3 className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight">{item.title}</h3>
         </div>
         
         <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            {item.metadata?.platform && <span className="flex items-center gap-1 text-red-600 font-medium"><Youtube size={14} /> {item.metadata.platform}</span>}
            {item.metadata?.likes && <span className="flex items-center gap-1"><ThumbsUp size={14} /> {item.metadata.likes} likes</span>}
            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-bold">AI Summary</span>
         </div>

         <p className="text-gray-600 text-sm leading-relaxed">{item.summary}</p>
       </div>
    </div>
  );

  const renderCodingCard = (item) => (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-3">
         <div className="flex items-center gap-2">
            <div className="p-2 bg-gray-100 rounded-md"><Code2 size={20} className="text-gray-700" /></div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg leading-none">{item.title}</h3>
              {item.metadata?.author && <span className="text-xs text-gray-500 flex items-center gap-1 mt-1"><User size={10}/> {item.metadata.author}</span>}
            </div>
         </div>
      </div>

      <p className="text-sm text-gray-600 mb-4 flex-1">{item.summary}</p>

      <div className="flex items-center gap-4 py-3 px-4 bg-gray-50 rounded-lg border border-gray-100 text-sm">
         <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <Star size={16} className="text-yellow-500 fill-yellow-500" />
            {item.metadata?.stars || '0'}
         </div>
         <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <GitFork size={16} className="text-gray-400" />
            {item.metadata?.forks || '0'}
         </div>
         <div className="ml-auto text-xs text-gray-400 bg-white px-2 py-1 rounded border border-gray-200">
            {item.metadata?.platform || 'GitHub'}
         </div>
      </div>
    </div>
  );

  const renderShoppingCard = (item) => (
    <div className="flex gap-4">
      <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-center">
         {item.image ? <img src={item.image} className="max-w-full max-h-full object-contain" /> : <ShoppingBag className="text-gray-300" />}
      </div>
      <div className="flex-1">
         <div className="flex justify-between items-start">
            <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{item.title}</h3>
            {item.metadata?.price && (
              <span className="bg-green-100 text-green-700 font-bold px-2 py-1 rounded text-sm">
                {item.metadata.price}
              </span>
            )}
         </div>
         <p className="text-sm text-gray-500 mt-1 mb-3 line-clamp-2">{item.summary}</p>
         <div className="flex flex-wrap gap-2">
            {item.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{t}</span>)}
         </div>
      </div>
    </div>
  );

  const renderStandardCard = (item) => (
    <div className="flex gap-4">
      <div className="flex-1">
        <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
          {item.title}
        </h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed mt-1">
          {item.summary}
        </p>
        <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
            <span className={`px-2 py-0.5 rounded-full bg-${item.difficulty === 'Easy' ? 'green' : item.difficulty === 'Medium' ? 'yellow' : 'red'}-50 text-${item.difficulty === 'Easy' ? 'green' : item.difficulty === 'Medium' ? 'yellow' : 'red'}-600 border border-${item.difficulty === 'Easy' ? 'green' : item.difficulty === 'Medium' ? 'yellow' : 'red'}-100`}>
              {item.difficulty}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {item.readingTime}
            </span>
            <span className="flex items-center gap-1">
              <Tag size={12} /> {item.tags.join(', ')}
            </span>
        </div>
      </div>
      {item.image && (
        <div className="hidden sm:block w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
           <img src={item.image} className="w-full h-full object-cover" alt="" onError={(e) => e.target.style.display = 'none'} />
        </div>
      )}
    </div>
  );

  // 1. Sidebar Item
  const NavItem = ({ id, icon: Icon, label, count }) => (
    <button
      onClick={() => setActiveView(id)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
        activeView === id ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={activeView === id ? 'text-blue-500' : 'text-gray-400'} />
        <span>{label}</span>
      </div>
      {count > 0 && <span className="text-xs font-semibold text-gray-400">{count}</span>}
    </button>
  );

  return (
    <div className="flex h-screen w-full bg-[#fcfcfc] text-gray-800 font-sans">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 bg-[#f8f9fa] border-r border-gray-200 flex flex-col pt-8 pb-4">
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

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        <div className="h-16 flex items-center justify-between px-8 border-b border-gray-50 bg-white/80 backdrop-blur sticky top-0 z-10">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 capitalize">{activeView}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeView === 'settings' ? (
            // ... Settings View (Same as before but ensuring imports work) ...
            <div className="max-w-2xl mx-auto">
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-6">
                 {/* Settings content remains similar, focusing on API key/models */}
                 <h3 className="text-lg font-bold mb-4">API Settings</h3>
                 <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Gemini API Key" className="w-full px-4 py-2 border rounded mb-4"/>
                 <button onClick={fetchModels} className="bg-gray-100 px-4 py-2 rounded text-sm hover:bg-gray-200">Load Models</button>
                 {availableModels.length > 0 && (
                   <div className="mt-4 max-h-40 overflow-y-auto border rounded">
                     {availableModels.map(m => (
                       <div key={m.name} onClick={() => setSelectedModel(m.name)} className={`p-2 text-sm cursor-pointer hover:bg-blue-50 ${selectedModel === m.name ? 'bg-blue-100' : ''}`}>{m.displayName}</div>
                     ))}
                   </div>
                 )}
              </div>
            </div>
          ) : (
            <div className={activeView === 'videos' || activeView === 'coding' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6" : "space-y-4 pb-20"}>
              {displayBookmarks.map(bookmark => (
                <div 
                  key={bookmark.id} 
                  onClick={() => setReaderItem(bookmark)}
                  className="group relative bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ring-1 ring-transparent hover:ring-blue-100 hover:border-blue-200"
                >
                   {/* Actions Overlay */}
                   <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1 rounded-lg backdrop-blur z-10">
                      <button onClick={(e) => toggleFavorite(bookmark.id, e)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-yellow-500"><Star size={16} /></button>
                      <button onClick={(e) => deleteBookmark(bookmark.id, e)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                   </div>

                   {/* Dynamic Content Rendering */}
                   {bookmark.category === 'Videos' ? renderVideoCard(bookmark) :
                    bookmark.category === 'Coding' ? renderCodingCard(bookmark) :
                    bookmark.category === 'Shopping' ? renderShoppingCard(bookmark) :
                    renderStandardCard(bookmark)
                   }
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Floating Add & Modals (Same as before) */}
        {activeView !== 'settings' && (
          <div className="absolute bottom-8 right-8 z-50">
             <button onClick={() => setIsAdding(true)} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"><Plus size={28} /></button>
          </div>
        )}
        
        {isAdding && (
           <div className="absolute inset-0 z-[60] bg-white/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !isProcessing && setIsAdding(false)}>
             <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">Add Link</h3>
                <input autoFocus type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Paste URL here..." className="w-full text-lg border-b-2 py-2 outline-none focus:border-blue-500" onKeyDown={e => e.key === 'Enter' && handleAddBookmark(e)} />
                {isProcessing && <div className="mt-4 text-blue-500 flex items-center gap-2"><Sparkles size={16} className="animate-spin"/> {processingStatus}</div>}
             </div>
           </div>
        )}

        {/* Reader View (Simplified for brevity, logic exists in previous App.jsx) */}
        {readerItem && (
          <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
            <div className="sticky top-0 flex justify-between items-center p-4 bg-white/95 border-b backdrop-blur">
               <button onClick={() => setReaderItem(null)} className="flex items-center gap-2"><ChevronLeft/> Back</button>
            </div>
            <div className="max-w-2xl mx-auto p-8 prose">
               {readerItem.videoEmbed && <iframe src={readerItem.videoEmbed} className="w-full aspect-video mb-8 rounded-lg"/>}
               <h1>{readerItem.title}</h1>
               <div dangerouslySetInnerHTML={{ __html: readerItem.content }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;