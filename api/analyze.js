import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Increase timeout limit helper for Vercel (if using Pro, otherwise 10s hard limit on free)
  
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

    // 2. Fix Relative URLs (Images/Links)
    const baseUrl = new URL(url);
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http')) {
        try {
          $(el).attr('src', new URL(src, baseUrl).href);
        } catch (e) {}
      }
    });
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        try {
          $(el).attr('href', new URL(href, baseUrl).href);
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
                        
    const image = $('meta[property="og:image"]').attr('content') || "";
    
    // Get text for AI context
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 15000);
    
    // Get content HTML for Reader Mode
    let contentHtml = $('article').html() || $('main').html() || $('body').html() || "<div>No readable content found.</div>";

    // --- AI ANALYSIS ---
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Use selected model or default to flash-1.5
        const modelName = userModel || "gemini-1.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `
          You are a content curator. Analyze the text below from a webpage.
          Return ONLY a valid JSON object. Do not include markdown formatting like \`\`\`json.
          
          Text to analyze: "${bodyText.substring(0, 10000)}..."
          
          Required JSON Structure:
          {
            "summary": "A concise, 2-sentence summary of the content.",
            "category": "Pick one: Technology, Science, Finance, Health, Design, Productivity, News, Entertainment, or General.",
            "difficulty": "Easy, Medium, or Advanced",
            "readingTime": "Calculated reading time (e.g. '5 min')",
            "tags": ["array", "of", "5", "lowercase", "keywords"]
          }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // --- ROBUST JSON PARSING ---
        // Find the first '{' and the last '}' to extract just the JSON object
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          throw new Error("AI did not return a valid JSON object");
        }
        
        const aiData = JSON.parse(jsonMatch[0]);

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
        // Don't fail completely, fall back to manual scraping below
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