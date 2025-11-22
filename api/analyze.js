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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const baseUrl = new URL(fullUrl);

    // --- Helper: Detect Video Embed URL ---
    let embedUrl = null;
    if (fullUrl.includes('youtube.com') || fullUrl.includes('youtu.be')) {
      const videoId = fullUrl.includes('v=') ? fullUrl.split('v=')[1].split('&')[0] : fullUrl.split('/').pop();
      if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (fullUrl.includes('vimeo.com')) {
      const videoId = fullUrl.split('/').pop();
      if (videoId) embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }

    // Fix Relative URLs
    $('img').each((i, el) => {
      const $el = $(el);
      const realSrc = $el.attr('data-src') || $el.attr('data-original') || $el.attr('src');
      if (realSrc && !realSrc.startsWith('data:')) {
        try {
          $el.attr('src', new URL(realSrc, baseUrl).href);
          $el.removeAttr('srcset');
        } catch (e) {}
      }
    });

    $('script, style, nav, footer, header, aside, .ad, iframe').remove();
    
    const title = $('title').first().text().trim() || url;
    
    // Capture original description from meta tags before AI runs
    const originalDescription = $('meta[name="description"]').attr('content') || 
                                $('meta[property="og:description"]').attr('content') || 
                                "";
    
    let image = $('meta[property="og:image"]').attr('content') || "";
    if (image && !image.startsWith('http')) {
      try { image = new URL(image, baseUrl).href; } catch(e) {}
    }
    
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 15000);
    let contentHtml = $('article').html() || $('main').html() || $('body').html() || "<div>No readable content found.</div>";

    // --- AI ANALYSIS ---
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = userModel || "gemini-1.5-flash";
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
          Analyze this webpage content.
          URL: ${fullUrl}
          Text: "${bodyText.substring(0, 12000)}..."
          
          Determine the Category based on the content:
          - "Videos": If it's YouTube, Vimeo, Netflix, or video content.
          - "Coding": If it's GitHub, GitLab, StackOverflow, or programming documentation.
          - "Shopping": If it's a product page (Amazon, Ebay, etc) with a price.
          - "Research": If it's an academic paper, PDF, or deep scientific study.
          - "Articles": General blog posts, news, essays.

          Return JSON:
          {
            "summary": "Concise 2-sentence summary.",
            "category": "Videos | Coding | Shopping | Research | Articles",
            "difficulty": "Easy | Medium | Advanced",
            "readingTime": "e.g. '5 min'",
            "tags": ["tag1", "tag2", "tag3"],
            "metadata": {
              "likes": "e.g. '1.2K' (if video)",
              "stars": "e.g. '4.5k' (if coding repo)",
              "forks": "e.g. '300' (if coding repo)",
              "author": "Username or Channel Name",
              "price": "e.g. '$29.99' (if shopping)",
              "platform": "e.g. 'YouTube', 'GitHub', 'Amazon'"
            }
          }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let aiData;
        try {
          aiData = JSON.parse(responseText);
        } catch (e) {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("Invalid JSON");
          aiData = JSON.parse(jsonMatch[0]);
        }

        return res.status(200).json({
          title,
          content: contentHtml,
          image,
          videoEmbed: embedUrl, 
          originalDescription: originalDescription, // Pass this back explicitly
          date: new Date().toLocaleDateString(),
          ...aiData,
          usedModel: modelName
        });

      } catch (aiError) {
        console.error("Gemini AI Error:", aiError);
      }
    }

    // --- FALLBACK (Manual) ---
    let category = 'Articles';
    if (fullUrl.includes('youtube') || fullUrl.includes('vimeo')) category = 'Videos';
    else if (fullUrl.includes('github') || fullUrl.includes('gitlab')) category = 'Coding';
    else if (fullUrl.includes('amazon') || fullUrl.includes('ebay')) category = 'Shopping';

    res.status(200).json({
      title,
      summary: originalDescription || "No summary available.",
      originalDescription: originalDescription,
      content: contentHtml,
      image,
      category,
      readingTime: "5 min",
      difficulty: "Medium",
      tags: [category.toLowerCase()],
      metadata: {},
      videoEmbed: embedUrl,
      date: new Date().toLocaleDateString(),
      usedModel: 'Manual Fallback'
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to analyze URL', details: error.message });
  }
}