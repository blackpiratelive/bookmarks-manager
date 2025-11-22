import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Folder, Tag, BookOpen, Settings, Sun, Moon, Zap, Clock, Info, Loader2, List, Trash2, Plus, X, Search, ChevronLeft
} from 'lucide-react';

// --- CONFIGURATION CONSTANTS ---
const API_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const API_KEY = ""; // Kept empty as per instructions. Canvas environment handles injection.
const WPM = 200; // Words Per Minute for reading time calculation

// --- LOCAL STORAGE CONFIGURATION ---
const LOCAL_STORAGE_KEY = 'bookmark_manager_data';

// LLM Schema for Structured Output
const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: {
      type: "STRING",
      description: "A single, broad category for the bookmark (e.g., Technology, Finance, History, Self-Improvement).",
    },
    tags: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Up to 5 relevant keywords/tags.",
    },
    summary: {
      type: "STRING",
      description: "A concise, single-paragraph summary of the article's main points.",
    },
    difficulty: {
      type: "STRING",
      description: "The reading difficulty level (Easy, Medium, or Hard).",
    },
  },
  propertyOrdering: ["category", "tags", "summary", "difficulty"],
};

// --- LOCAL STORAGE HELPERS ---

/**
 * Loads bookmarks from localStorage and returns an array.
 * @returns {Array} List of bookmarks.
 */
const loadBookmarksFromLS = () => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    // Ensure the structure is an array
    const parsedData = data ? JSON.parse(data) : [];
    return Array.isArray(parsedData) ? parsedData : [];
  } catch (error) {
    console.error("Error loading data from localStorage:", error);
    return [];
  }
};

/**
 * Saves the current list of bookmarks to localStorage.
 * @param {Array} bookmarks - The array of bookmarks to save.
 */
const saveBookmarksToLS = (bookmarks) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (error) {
    console.error("Error saving data to localStorage:", error);
  }
};

// --- VERCEL FUNCTION CALL FOR ARTICLE CONTENT ---
/**
 * This function calls the deployed Vercel function (or a local development proxy).
 * The Vercel function handles the actual fetching and parsing of the URL content.
 */
const handleFetchArticleContent = async (url) => {
  try {
    // In a deployed Vercel environment, this URL points to the serverless function.
    const apiUrl = `/api/fetch-article?url=${encodeURIComponent(url)}`;
    
    // Simulate Vercel fetch response for development environment
    // NOTE: This block should be removed or commented out when deployed alongside a real Vercel function.
    if (!window.location.hostname.includes('vercel.app')) { 
        const normalizedUrl = url.toLowerCase();
        const keyword = normalizedUrl.split('/').pop().replace(/[^a-zA-Z0-9]/g, ' ').trim();
        let content = `(Simulated Content via Vercel Function Mock) This article focuses on "${keyword || 'Digital Productivity'}" and discusses the role of serverless architecture in modern web apps, specifically using Vercel. It analyzes how functions deployed in the API directory handle cross-origin requests securely, enabling robust data fetching that is impossible directly from the browser. This pattern is crucial for building reliable reader-mode functionality.`;
        const lengthMultiplier = Math.floor(Math.random() * 5) + 3; 
        content = content.repeat(lengthMultiplier);
        const wordCount = content.split(/\s+/).length;
        const title = new URL(url).hostname.replace('www.', '');
        return { content: content.trim(), wordCount, title };
    }
    
    // --- REAL VERCEL FETCH LOGIC ---
    const response = await fetch(apiUrl);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Article fetch failed: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    return {
        content: data.content,
        wordCount: data.wordCount,
        title: data.title
    };
  } catch (error) {
    console.error("Failed to fetch article content:", error.message);
    throw new Error("Could not fetch and parse article. Check the URL or Vercel Function status.");
  }
};


// --- GEMINI API HOOK (With Exponential Backoff) ---
const useGeminiApi = () => {
  const callGeminiApi = useCallback(async (prompt, structured = false) => {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: {
        parts: [{ text: "You are an expert AI content analyzer designed to summarize, categorize, and tag web articles. Respond only with the requested JSON object." }]
      },
      generationConfig: structured ? {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA
      } : undefined,
    };

    const url = `${API_URL_BASE}/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;
    const maxRetries = 5;
    let delay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
          const text = candidate.content.parts[0].text;
          return structured ? JSON.parse(text) : text;
        }
        return null;

      } catch (error) {
        console.warn(`Gemini API call failed (Attempt ${i + 1}):`, error);
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          console.error("GemINI API call failed permanently.");
          return null;
        }
      }
    }
  }, []);

  return callGeminiApi;
};

// --- COMPONENTS ---

// 1. READER MODE COMPONENT
const ReaderMode = ({ content, title, readingTime, difficulty, onClose, isVisible }) => {
  const [fontSize, setFontSize] = useState(16);
  const [font, setFont] = useState('sans'); // 'sans', 'serif', 'mono'
  const [theme, setTheme] = useState('white'); // 'white', 'dark', 'bookish'

  const fontClasses = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono',
  };

  const themeClasses = {
    white: 'bg-white text-gray-900',
    dark: 'bg-gray-900 text-gray-100',
    bookish: 'bg-amber-50 text-amber-900',
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 transition-colors duration-300"
         style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
         aria-modal="true" role="dialog"
         data-theme={theme}
         data-font={font}
    >
      {/* Theme Background */}
      <div className={`absolute inset-0 ${themeClasses[theme]}`}></div>

      {/* Control Panel (Top) */}
      <div className="sticky top-0 z-10 p-2 rounded-xl bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-xl flex justify-between items-center mb-6">
        <button onClick={onClose} className="flex items-center text-gray-700 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 mr-1" />
          <span className="font-medium text-sm">Exit Reader</span>
        </button>

        <div className="flex items-center space-x-4 text-sm">
          {/* Metrics */}
          <span className="flex items-center text-gray-500 dark:text-gray-400">
            <Clock className="w-4 h-4 mr-1" /> {readingTime} min
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${difficulty === 'Easy' ? 'bg-green-100 text-green-800' : difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
            {difficulty}
          </span>
        </div>

        {/* Settings Controls (Right) */}
        <div className="flex space-x-3 items-center">
          {/* Font Selector */}
          <select value={font} onChange={(e) => setFont(e.target.value)}
                  className="p-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200 text-sm">
            <option value="sans">Sans-Serif</option>
            <option value="serif">Serif</option>
            <option value="mono">Monospace</option>
          </select>

          {/* Font Size Adjust */}
          <div className="flex items-center space-x-1">
            <button onClick={() => setFontSize(s => Math.max(12, s - 1))} className="p-1 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">A-</button>
            <span className="text-sm w-8 text-center">{fontSize}px</span>
            <button onClick={() => setFontSize(s => Math.min(24, s + 1))} className="p-1 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">A+</button>
          </div>

          {/* Theme Switcher */}
          <div className="flex rounded-full overflow-hidden border border-gray-300 dark:border-gray-600">
            <button onClick={() => setTheme('white')} className={`p-1.5 transition-colors ${theme === 'white' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}><Sun className="w-4 h-4" /></button>
            <button onClick={() => setTheme('dark')} className={`p-1.5 transition-colors ${theme === 'dark' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}><Moon className="w-4 h-4" /></button>
            <button onClick={() => setTheme('bookish')} className={`p-1.5 transition-colors ${theme === 'bookish' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}><BookOpen className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`mx-auto max-w-3xl p-8 rounded-2xl shadow-2xl relative ${theme === 'bookish' ? 'bg-amber-100/90' : 'bg-white/95 dark:bg-gray-800/95'} transition-colors`}>
        <div className={`${fontClasses[font]}`} style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}>
          <h1 className="text-4xl font-extrabold mb-6" style={{ fontSize: `${fontSize * 1.8}px` }}>{title}</h1>
          {/* Display content, replacing double newlines with paragraphs */}
          {content.split('\n\n').map((paragraph, index) => (
            <p key={index} className="mb-6 indent-8 text-justify">{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

// 2. BOOKMARK DETAIL VIEW
const BookmarkDetail = ({ bookmark, onBack, onRunAiAnalysis, onDelete, isAnalyzing }) => {
  const { title, url, summary, tags, category, difficulty, readingTimeMinutes, id, content_placeholder } = bookmark;

  // Function to determine badge style
  const getDifficultyStyle = (level) => {
    switch (level) {
      case 'Easy': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const [isReaderMode, setIsReaderMode] = useState(false);

  // Fallback values for content metrics
  const displayReadingTime = readingTimeMinutes ? Math.ceil(readingTimeMinutes) : 0;
  const displayDifficulty = difficulty || 'Unknown';
  const displaySummary = summary || 'Run AI analysis to generate a concise summary.';

  return (
    <>
      <div className="p-6 h-full flex flex-col">
        {/* Header and Controls */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <button onClick={onBack} className="flex items-center text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors">
            <ChevronLeft className="w-5 h-5 mr-1" />
            <span className="font-semibold text-sm">All Bookmarks</span>
          </button>
          <div className="flex space-x-3">
            <button onClick={() => setIsReaderMode(true)} className="flex items-center bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
              <BookOpen className="w-4 h-4 mr-1.5" /> Reader Mode
            </button>
            <button onClick={() => onDelete(id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-800/50 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title and URL */}
        <div className="py-6">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">{title}</h1>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm truncate block hover:underline">
            {url}
          </a>
        </div>

        {/* AI Analysis Section */}
        <div className="space-y-6 flex-grow overflow-y-auto pr-2">
          {/* Analysis Metrics */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md">
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">AI Insight & Metrics</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center">
                <Folder className="w-4 h-4 mr-2 text-blue-500" />
                <span className="font-medium">Category:</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">{category || 'Uncategorized'}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 text-green-500" />
                <span className="font-medium">Reading Time:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{displayReadingTime} min</span>
              </div>
              <div className="flex items-center">
                <Zap className="w-4 h-4 mr-2 text-yellow-500" />
                <span className="font-medium">Difficulty:</span>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${getDifficultyStyle(displayDifficulty)}`}>{displayDifficulty}</span>
              </div>
            </div>

            {tags && tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                <span className="font-medium text-sm flex items-center mb-1 text-gray-600 dark:text-gray-400"><Tag className="w-4 h-4 mr-2" /> Tags:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {tags.map((tag, index) => (
                    <span key={index} className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary Block */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md">
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Summary</h2>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{displaySummary}</p>
          </div>

          {/* AI Run Button */}
          {(!summary || isAnalyzing) && (
            <div className="text-center p-4">
              <button
                onClick={() => onRunAiAnalysis(bookmark)}
                disabled={isAnalyzing}
                className={`flex items-center justify-center mx-auto px-6 py-2 rounded-full font-bold text-white transition-all duration-300 ${isAnalyzing ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'}`}
              >
                {isAnalyzing ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-5 h-5 mr-2" />
                )}
                {isAnalyzing ? 'Analyzing...' : 'Run AI Analysis'}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Analyzes content to generate summary, tags, category, and difficulty.</p>
            </div>
          )}
          <div className="h-4"></div> {/* Spacer */}
        </div>
      </div>

      {/* Reader Mode Overlay */}
      <ReaderMode
        isVisible={isReaderMode}
        onClose={() => setIsReaderMode(false)}
        content={content_placeholder || 'No main content found for reading.'}
        title={title}
        readingTime={displayReadingTime}
        difficulty={displayDifficulty}
      />
    </>
  );
};

// 3. BOOKMARK LIST ITEM
const BookmarkListItem = ({ bookmark, onSelect }) => {
  const { title, url, summary, category, difficulty } = bookmark;

  const getDifficultyStyle = (level) => {
    switch (level) {
      case 'Easy': return 'bg-green-50 text-green-600 border-green-200';
      case 'Medium': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
      case 'Hard': return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const hasAnalysis = summary && category;

  return (
    <div
      onClick={() => onSelect(bookmark)}
      className="flex items-center p-3 my-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md cursor-pointer transition-all duration-150"
    >
      <div className="flex-grow min-w-0">
        <div className="font-semibold text-gray-900 dark:text-white truncate">{title}</div>
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
           className="text-xs text-blue-500 hover:underline truncate block">
          {url}
        </a>
      </div>

      <div className="flex items-center space-x-3 text-xs ml-4">
        {hasAnalysis ? (
          <>
            <span className={`px-2 py-0.5 rounded-lg font-medium border ${getDifficultyStyle(difficulty || 'Unknown')}`}>
              {difficulty || 'N/A'}
            </span>
            <span className="px-2 py-0.5 rounded-lg font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {category || 'N/A'}
            </span>
          </>
        ) : (
          <span className="flex items-center text-yellow-600 dark:text-yellow-400">
            <Zap className="w-4 h-4 mr-1" /> Needs Analysis
          </span>
        )}
      </div>
    </div>
  );
};

// 4. MAIN APP COMPONENT
const App = () => {
  const callGeminiApi = useGeminiApi();

  const [bookmarks, setBookmarks] = useState([]);
  const [selectedBookmark, setSelectedBookmark] = useState(null);
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filter, setFilter] = useState('All'); // 'All', 'Uncategorized', or category name
  const [searchQuery, setSearchQuery] = useState('');

  // --- Initial Data Load from localStorage ---
  useEffect(() => {
    const loadedData = loadBookmarksFromLS();
    // Ensure sorting by date (using ISO string for comparison)
    loadedData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setBookmarks(loadedData);
    setLoading(false);
  }, []);

  // --- Helper to update state and localStorage ---
  const updateBookmarks = useCallback((newBookmarks) => {
    // Sort before setting state and saving
    const sortedBookmarks = newBookmarks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setBookmarks(sortedBookmarks);
    saveBookmarksToLS(sortedBookmarks);
  }, []);

  // --- CRUD Operations ---

  const handleAddBookmark = async () => {
    if (!newUrl || isAdding) return;
    setIsAdding(true);

    try {
      // 1. Fetch content and metrics using the updated handler (calling Vercel Function)
      const { content, wordCount, title } = await handleFetchArticleContent(newUrl);

      // 2. Calculate final metrics
      const readingTime = wordCount / WPM; // Calculate reading time

      // 3. Create new bookmark object
      const newBookmark = {
        id: crypto.randomUUID(), // Unique ID for localStorage
        url: newUrl,
        title: title, // Title now comes from the fetch result
        content_placeholder: content, // The clean, parsed content for Reader Mode
        category: null,
        tags: [],
        summary: null,
        difficulty: null,
        readingTimeMinutes: readingTime,
        createdAt: new Date().toISOString(), 
      };

      // 4. Update state and reset input
      updateBookmarks([newBookmark, ...bookmarks]);
      setNewUrl('');
    } catch (e) {
      console.error("Error adding bookmark:", e);
      // In a real app, you'd show a custom error message box here.
      alert(e.message || "Failed to add bookmark. Check the URL and server function.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteBookmark = (id) => {
    const updatedBookmarks = bookmarks.filter(b => b.id !== id);
    updateBookmarks(updatedBookmarks);
    setSelectedBookmark(null);
  };

  const handleRunAiAnalysis = async (bookmark) => {
    if (isAnalyzing || !bookmark.content_placeholder) return;
    setIsAnalyzing(true);

    // Use the fetched/simulated content for analysis
    const prompt = `Analyze the tone, subject matter, and complexity of the following article content. Provide a single category, a list of up to five relevant tags, a concise summary, and classify the reading difficulty as 'Easy', 'Medium', or 'Hard'. Content: "${bookmark.content_placeholder}"`;

    try {
      const result = await callGeminiApi(prompt, true);

      if (result) {
        // Create an updated bookmark object
        const updatedBookmark = {
          ...bookmark,
          category: result.category,
          tags: result.tags,
          summary: result.summary,
          difficulty: result.difficulty,
        };

        // Update the main bookmarks array
        const updatedBookmarks = bookmarks.map(b => 
          b.id === bookmark.id ? updatedBookmark : b
        );
        
        // Update state and local storage
        updateBookmarks(updatedBookmarks);

        // Update local state to reflect changes immediately in detail view
        setSelectedBookmark(updatedBookmark); 
      }
    } catch (e) {
      console.error("AI Analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Filtering and Categorization ---

  const categories = useMemo(() => {
    const cats = bookmarks.reduce((acc, b) => {
      if (b.category) acc.add(b.category);
      return acc;
    }, new Set());
    return ['All', 'Uncategorized', ...Array.from(cats)].sort();
  }, [bookmarks]);

  const tags = useMemo(() => {
    const allTags = bookmarks.reduce((acc, b) => {
      if (b.tags && Array.isArray(b.tags)) {
        b.tags.forEach(tag => acc.add(tag));
      }
      return acc;
    }, new Set());
    return ['All', ...Array.from(allTags)].sort();
  }, [bookmarks]);

  const filteredBookmarks = useMemo(() => {
    let list = bookmarks;

    // 1. Filter by Category/Filter (Filter is the same as the sidebar 'category')
    if (filter === 'Uncategorized') {
      list = list.filter(b => !b.category);
    } else if (filter !== 'All') {
      list = list.filter(b => b.category === filter || b.tags?.includes(filter));
    }

    // 2. Filter by Search Query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      list = list.filter(b =>
        b.title.toLowerCase().includes(query) ||
        b.url.toLowerCase().includes(query) ||
        b.summary?.toLowerCase().includes(query) ||
        b.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return list;
  }, [bookmarks, filter, searchQuery]);


  // --- UI/Styling ---

  // Things 3 inspired palette and structure
  const sidebarItemClass = (item) => `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center ${
    filter === item
      ? 'bg-blue-500 text-white shadow-md'
      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
        <Loader2 className="w-8 h-8 animate-spin mr-3" />
        <p>Loading Bookmarks...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      {/* Sidebar (Things 3 Style - Narrow & Functional) */}
      <div className={`p-4 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out ${selectedBookmark ? 'hidden md:block w-64' : 'w-full md:w-64'}`}>
        <h2 className="text-xl font-bold mb-6 text-blue-600 dark:text-blue-400 flex items-center">
          <List className="w-5 h-5 mr-2" /> Bookmarks Hub
        </h2>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="w-4 h-4 absolute top-2.5 left-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Categories / Folders */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2 px-3">Categories</h3>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} className={sidebarItemClass(cat)}>
                <Folder className="w-4 h-4 mr-3" />
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2 px-3">Tags</h3>
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 10).map((tag) => (
              <button key={tag} onClick={() => setFilter(tag)} className={sidebarItemClass(tag)}>
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-grow overflow-hidden transition-all duration-300 ease-in-out ${selectedBookmark ? 'md:flex' : 'flex-col'}`}>
        {/* Bookmark List (Visible only when not in detail view on mobile, or always on desktop) */}
        <div className={`flex-grow md:max-w-md p-4 overflow-y-auto border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${selectedBookmark ? 'hidden md:block' : 'block'}`}>
          <h1 className="text-3xl font-extrabold mb-6">
            {filter} <span className="text-gray-500 dark:text-gray-400 text-base font-normal">({filteredBookmarks.length})</span>
          </h1>

          {/* Add New Bookmark Input */}
          <div className="mb-6 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col space-y-2">
            <input
              type="url"
              placeholder="Paste URL to add bookmark..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBookmark()}
              className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleAddBookmark}
              disabled={isAdding || !newUrl}
              className={`w-full flex items-center justify-center px-4 py-2 rounded-lg text-white font-semibold transition-all duration-200 ${
                isAdding ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 mr-2" />}
              {isAdding ? 'Fetching & Adding...' : 'Add Bookmark'}
            </button>
          </div>

          {/* List of Bookmarks */}
          <div className="space-y-2">
            {filteredBookmarks.length > 0 ? (
              filteredBookmarks.map(b => (
                <BookmarkListItem
                  key={b.id}
                  bookmark={b}
                  onSelect={setSelectedBookmark}
                />
              ))
            ) : (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl">
                <Info className="w-8 h-8 mx-auto mb-3" />
                <p>No bookmarks found for the current filter/search.</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail View (Takes full width on mobile, or remaining space on desktop) */}
        <div className={`flex-grow overflow-y-auto bg-white dark:bg-gray-800 transition-all duration-300 ${selectedBookmark ? 'block' : 'hidden md:block'}`}>
          {selectedBookmark ? (
            <BookmarkDetail
              bookmark={selectedBookmark}
              onBack={() => setSelectedBookmark(null)}
              onRunAiAnalysis={handleRunAiAnalysis}
              onDelete={handleDeleteBookmark}
              isAnalyzing={isAnalyzing}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600 p-8">
              <p className="text-center">
                <ChevronLeft className="w-8 h-8 mx-auto mb-2" />
                Select a bookmark from the list to view details and run AI analysis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;