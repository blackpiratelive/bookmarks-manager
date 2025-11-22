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
    const isAmazon = fullUrl.includes('amazon') || fullUrl.includes('amzn');
    
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
      try {
        const scriptTags = $('script');
        for (let i = 0; i < scriptTags.length; i++) {
          const scriptContent = $(scriptTags[i]).html();
          if (scriptContent && scriptContent.includes('ytInitialPlayerResponse')) {
            const match = scriptContent.match(/var ytInitialPlayerResponse = ({.*?});/);
            if (match && match[1]) {
              const data = JSON.parse(match[1]);
              fullDescription = data.videoDetails?.shortDescription || ""; 
              break;
            }
          }
        }
      } catch (e) {}
    }
    if (!fullDescription) {
      fullDescription = $('meta[property="og:description"]').attr('content') || 
                        $('meta[name="description"]').attr('content') || 
                        "";
    }

    // --- 4. DIRECT METADATA & IMAGE SCRAPING ---
    let scrapedMetadata = {};
    let productImagesSet = new Set(); // Use Set to avoid duplicates
    
    // Fix Relative URLs & Collect Images
    $('img').each((i, el) => {
      const $el = $(el);
      const realSrc = $el.attr('data-src') || $el.attr('data-original') || $el.attr('src');
      if (realSrc && !realSrc.startsWith('data:')) {
        try {
          let absUrl = new URL(realSrc, baseUrl).href;
          
          // --- AMAZON SPECIFIC IMAGE CLEANING ---
          // Removes resizing params like ._AC_US40_ to get the original High-Res image
          // Pattern: /images/I/XXXXX._modifiers_.jpg -> /images/I/XXXXX.jpg
          if (absUrl.includes('/images/I/')) {
             absUrl = absUrl.replace(/\._.*(\.[a-zA-Z]+)$/, '$1');
          }

          $el.attr('src', absUrl);
          $el.removeAttr('srcset');
          
          // Collect large images for carousel
          if (!absUrl.includes('icon') && !absUrl.includes('logo') && !absUrl.includes('avatar') && !absUrl.includes('gif')) {
             productImagesSet.add(absUrl);
          }
        } catch (e) {}
      }
    });
    
    // Remove junk
    $('script, style, nav, footer, header, aside, .ad, iframe').remove();
    
    const title = youtubeData.title || $('meta[property="og:title"]').attr('content') || $('title').first().text().trim() || url;
    let image = youtubeData.thumbnail_url || $('meta[property="og:image"]').attr('content') || "";
    
    // Ensure main image is cleaned too if it's Amazon
    if (image && image.includes('/images/I/')) {
       image = image.replace(/\._.*(\.[a-zA-Z]+)$/, '$1');
    } else if (image && !image.startsWith('http')) {
       try { image = new URL(image, baseUrl).href; } catch(e) {}
    }
    
    // prioritize the main OG image in the carousel
    const productImages = Array.from(productImagesSet);
    if (image) {
       // Move main image to front if exists, or add it
       const idx = productImages.indexOf(image);
       if (idx > -1) productImages.splice(idx, 1);
       productImages.unshift(image);
    }

    // Specific Scraping Logic
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
    if (isYoutube) {
      if (youtubeData.author_name) scrapedMetadata.author = youtubeData.author_name;
      scrapedMetadata.platform = 'YouTube';
    }
    // Shopping Price
    const priceSelectors = ['.a-price .a-offscreen', '.price', '[itemprop="price"]', '#priceblock_ourprice', '.product-price', '.offer-price', '.price-box__price'];
    for (const sel of priceSelectors) {
      const price = $(sel).first().text().trim();
      if (price) {
        scrapedMetadata.price = price;
        break;
      }
    }

    let embedUrl = null;
    if (isYoutube) {
      const match = fullUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^#&?]*)/);
      if (match && match[1]) embedUrl = `https://www.youtube.com/embed/${match[1]}`;
    } else if (fullUrl.includes('vimeo.com')) {
      const videoId = fullUrl.split('/').pop();
      if (videoId) embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }

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

        let contextData = "";
        if (isYoutube) {
           contextData = `VIDEO_TITLE: ${title}\nVIDEO_DESCRIPTION: "${fullDescription.substring(0, 15000)}"`;
        } else {
           const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 20000); // Increased limit
           contextData = `WEBPAGE_TEXT: "${bodyText}..."`;
        }

        const prompt = `
          You are a content curator.
          ${contextData}
          
          Scraped Metadata: ${JSON.stringify(scrapedMetadata)}.
          
          Task:
          1. Categorize (Videos, Coding, Shopping, Research, Articles).
          2. Generate a Comprehensive Summary (80-100 words).
          3. If category is 'Shopping':
             - Extract ALL 'Product Information', 'Technical Details', or 'Specifications' found in the text.
             - Return them as a comprehensive key-value object in 'specifications'.
             - Do not summarize or omit rows; if it looks like a spec, include it.
          
          Return JSON:
          {
            "summary": "Detailed summary...",
            "category": "Videos | Coding | Shopping | Research | Articles",
            "difficulty": "Easy | Medium | Advanced",
            "readingTime": "e.g. '5 min'",
            "tags": ["tag1", "tag2"],
            "specifications": { "Material": "Value", "Weight": "Value", "Dimensions": "Value", ... }, 
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

        // Limit image count to avoid payload bloat, but keep high quality ones
        const finalImages = productImages.slice(0, 8);

        return res.status(200).json({
          title,
          content: contentHtml,
          image,
          images: finalImages,
          videoEmbed: embedUrl, 
          originalDescription: fullDescription,
          date: new Date().toLocaleDateString(),
          ...aiData,
          usedModel: modelName
        });

      } catch (aiError) {
        console.error("Gemini AI Error:", aiError);
      }
    }

    // --- FALLBACK ---
    let category = 'Articles';
    if (isYoutube || fullUrl.includes('vimeo')) category = 'Videos';
    else if (fullUrl.includes('github')) category = 'Coding';
    else if (fullUrl.includes('amazon') || fullUrl.includes('ebay')) category = 'Shopping';

    res.status(200).json({
      title,
      summary: fullDescription.substring(0, 200) + "..." || "No summary available.",
      originalDescription: fullDescription,
      content: contentHtml,
      image,
      images: productImages.slice(0, 8),
      category,
      readingTime: "5 min",
      difficulty: "Medium",
      tags: [category.toLowerCase()],
      specifications: {},
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