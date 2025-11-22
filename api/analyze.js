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
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const baseUrl = new URL(fullUrl);
    const isYoutube = fullUrl.includes('youtube.com') || fullUrl.includes('youtu.be');
    const isGithub = fullUrl.includes('github.com');
    
    // --- 1. YouTube oEmbed (Base Metadata) ---
    let youtubeData = {};
    if (isYoutube) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(fullUrl)}&format=json`;
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          youtubeData = await oembedRes.json();
        }
      } catch (e) {
        console.error("YouTube oEmbed failed:", e);
      }
    }

    // --- 2. Fetch Page HTML ---
    const response = await fetch(fullUrl, {
      headers: {
        // Using a standard browser UA helps get the full page structure for YouTube script parsing
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
    
    const html = await response.text();
    const $ = cheerio.load(html);

    // --- 3. ADVANCED DESCRIPTION EXTRACTION ---
    let fullDescription = "";

    if (isYoutube) {
      // Attempt to extract full description from YouTube's embedded JSON
      // YouTube stores full data in a variable called 'ytInitialPlayerResponse'
      try {
        const scriptTags = $('script');
        for (let i = 0; i < scriptTags.length; i++) {
          const scriptContent = $(scriptTags[i]).html();
          if (scriptContent && scriptContent.includes('ytInitialPlayerResponse')) {
            // Extract the JSON object
            const match = scriptContent.match(/var ytInitialPlayerResponse = ({.*?});/);
            if (match && match[1]) {
              const data = JSON.parse(match[1]);
              fullDescription = data.videoDetails?.shortDescription || ""; // 'shortDescription' is actually the full text
              break;
            }
          }
        }
      } catch (e) {
        console.log("YouTube deep scrape failed, falling back to meta", e);
      }
    }

    // Fallback to meta tags if deep scrape failed or not YouTube
    if (!fullDescription) {
      fullDescription = $('meta[property="og:description"]').attr('content') || 
                        $('meta[name="description"]').attr('content') || 
                        "";
    }

    // --- 4. DIRECT METADATA SCRAPING ---
    let scrapedMetadata = {};
    
    // A. Coding (GitHub)
    if (isGithub) {
      try {
        const stars = $('.js-social-count').first().text().trim() || $('#repo-stars-counter-star').text().trim();
        const forks = $('#repo-network-counter').text().trim();
        const author = $('span.author a').text().trim();
        
        if (stars) scrapedMetadata.stars = stars;
        if (forks) scrapedMetadata.forks = forks;
        if (author) scrapedMetadata.author = author;
        scrapedMetadata.platform = 'GitHub';
      } catch (e) {}
    }

    // B. Videos (YouTube)
    if (isYoutube) {
      if (youtubeData.author_name) scrapedMetadata.author = youtubeData.author_name;
      scrapedMetadata.platform = 'YouTube';
    }

    // C. Shopping
    const priceSelectors = ['.a-price .a-offscreen', '.price', '[itemprop="price"]', '#priceblock_ourprice'];
    for (const sel of priceSelectors) {
      const price = $(sel).first().text().trim();
      if (price) {
        scrapedMetadata.price = price;
        break;
      }
    }

    // --- 5. Resolve Video Embed URL ---
    let embedUrl = null;
    if (isYoutube) {
      const match = fullUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^#&?]*)/);
      if (match && match[1]) embedUrl = `https://www.youtube.com/embed/${match[1]}`;
    } else if (fullUrl.includes('vimeo.com')) {
      const videoId = fullUrl.split('/').pop();
      if (videoId) embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }

    // --- 6. Standard Cleanup ---
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
    
    const title = youtubeData.title || $('meta[property="og:title"]').attr('content') || $('title').first().text().trim() || url;
    let image = youtubeData.thumbnail_url || $('meta[property="og:image"]').attr('content') || "";
    if (image && !image.startsWith('http')) try { image = new URL(image, baseUrl).href; } catch(e) {}
    
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

        // Prepare Prompt Context
        let contextData = "";
        if (isYoutube) {
           // We pass the DEEP SCRAPED description to the AI for a better summary
           contextData = `
             VIDEO_TITLE: ${title}
             VIDEO_DESCRIPTION (Full): "${fullDescription.substring(0, 15000)}"
             (Summarize the video content based on this description.)
           `;
        } else {
           const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 15000);
           contextData = `WEBPAGE_TEXT: "${bodyText.substring(0, 12000)}..."`;
        }

        const prompt = `
          You are an expert content analyst.
          ${contextData}
          
          I have already scraped this metadata: ${JSON.stringify(scrapedMetadata)}.
          
          Task:
          1. Determine the Category (Videos, Coding, Shopping, Research, Articles).
          2. Generate a **Comprehensive Summary**. 
             - NOT just 1-2 sentences. 
             - Write a detailed paragraph (approx 80-120 words).
             - Include key takeaways or plot points if applicable.
          3. Extract additional metadata.

          Return JSON:
          {
            "summary": "Detailed, engaging paragraph summary...",
            "category": "Videos | Coding | Shopping | Research | Articles",
            "difficulty": "Easy | Medium | Advanced",
            "readingTime": "e.g. '5 min'",
            "tags": ["tag1", "tag2", "tag3"],
            "metadata": {
              "likes": "...",
              "stars": "${scrapedMetadata.stars || ''}",
              "forks": "${scrapedMetadata.forks || ''}",
              "author": "${scrapedMetadata.author || ''}",
              "price": "${scrapedMetadata.price || ''}",
              "platform": "..."
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
          originalDescription: fullDescription, // Return the deep-scraped full description
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
    if (isYoutube || fullUrl.includes('vimeo')) category = 'Videos';
    else if (fullUrl.includes('github') || fullUrl.includes('gitlab')) category = 'Coding';
    else if (fullUrl.includes('amazon') || fullUrl.includes('ebay')) category = 'Shopping';

    res.status(200).json({
      title,
      summary: fullDescription.substring(0, 200) + "..." || "No summary available.",
      originalDescription: fullDescription,
      content: contentHtml,
      image,
      category,
      readingTime: "5 min",
      difficulty: "Medium",
      tags: [category.toLowerCase()],
      metadata: scrapedMetadata,
      videoEmbed: embedUrl,
      date: new Date().toLocaleDateString(),
      usedModel: 'Manual Fallback'
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to analyze URL', details: error.message });
  }
}