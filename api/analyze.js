import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, apiKey, model: userModel } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // 1. Fetch the HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Ensure base URL has a protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const baseUrl = new URL(fullUrl);

    // 2. Fix Relative URLs (Images/Links) & Handle Lazy Loading
    $('img').each((i, el) => {
      const $el = $(el);
      
      // Handle lazy loading attributes common in modern web
      const realSrc = $el.attr('data-src') || $el.attr('data-original') || $el.attr('src');
      
      if (realSrc && !realSrc.startsWith('data:')) {
        try {
          // Resolve absolute URL
          const absoluteUrl = new URL(realSrc, baseUrl).href;
          $el.attr('src', absoluteUrl);
          
          // Remove srcset to prevent browser from using relative paths in it
          $el.removeAttr('srcset');
          $el.removeAttr('data-src'); 
          $el.removeAttr('loading'); // Remove native lazy loading to ensure reader shows it
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    });

    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        try {
          $(el).attr('href', new URL(href, baseUrl).href);
          $(el).attr('target', '_blank');
        } catch (e) {}
      }
    });

    // 3. Extract Core Data
    $('script, style, nav, footer, header, aside, .ad, .advertisement, iframe, .cookie-banner').remove();
    
    const title = $('title').first().text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  url;
                  
    const description = $('meta[name="description"]').attr('content') || 
                        $('meta[property="og:description"]').attr('content') || 
                        "";
                        
    // Fix OG Image relative paths too
    let image = $('meta[property="og:image"]').attr('content') || "";
    if (image && !image.startsWith('http')) {
      try { image = new URL(image, baseUrl).href; } catch(e) {}
    }
    
    // Get text for AI context
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 15000);
    
    // Get content HTML for Reader Mode
    let contentHtml = $('article').html() || $('main').html() || $('body').html() || "<div>No readable content found.</div>";

    // --- AI ANALYSIS ---
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = userModel || "gemini-1.5-flash";
        
        // Configure model to return JSON specifically
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
          You are a content curator. Analyze the text below from a webpage.
          
          Text to analyze: "${bodyText.substring(0, 12000)}..."
          
          Return a JSON object with this structure:
          {
            "summary": "A concise, 2-sentence summary.",
            "category": "One of: Technology, Science, Finance, Health, Design, Productivity, News, Entertainment, General",
            "difficulty": "Easy, Medium, or Advanced",
            "readingTime": "e.g. '5 min'",
            "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
          }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // --- ROBUST JSON PARSING ---
        // Even with JSON mode, sometimes models add wrapping. 
        // We try standard parse first, then fallback to regex extraction.
        let aiData;
        try {
          aiData = JSON.parse(responseText);
        } catch (e) {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("Invalid JSON format from AI");
          aiData = JSON.parse(jsonMatch[0]);
        }

        return res.status(200).json({
          title,
          content: contentHtml,
          image,
          date: new Date().toLocaleDateString(),
          ...aiData,
          usedModel: modelName
        });

      } catch (aiError) {
        console.error("Gemini AI Error:", aiError);
        // Fallback to manual scraping if AI fails (e.g. quota exceeded)
      }
    }

    // --- FALLBACK (Manual Scraping) ---
    const wordCount = bodyText.split(' ').length;
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
    const difficulty = wordCount > 1500 ? 'Advanced' : wordCount > 800 ? 'Medium' : 'Easy';
    
    const categoryKeywords = {
      'Technology': ['software', 'code', 'app', 'tech', 'ai', 'data'],
      'Design': ['ui', 'ux', 'color', 'font', 'layout'],
      'Finance': ['money', 'stock', 'market', 'business', 'economy'],
      'Science': ['research', 'study', 'biology', 'physics', 'space']
    };

    let category = 'General';
    const lowerText = bodyText.toLowerCase();
    
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(k => lowerText.includes(k))) {
        category = cat;
        break;
      }
    }

    res.status(200).json({
      title,
      summary: description || "No summary available.",
      content: contentHtml,
      image,
      category,
      readingTime: `${readTimeMinutes} min`,
      difficulty,
      tags: [category.toLowerCase()],
      date: new Date().toLocaleDateString(),
      usedModel: 'Manual Fallback'
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze URL',
      details: error.message 
    });
  }
}