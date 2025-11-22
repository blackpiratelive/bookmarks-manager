import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // 1. Fetch the actual content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    
    const html = await response.text();
    const $ = cheerio.load(html);

    // 2. Extract Metadata
    const title = $('title').first().text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  url;
    
    const description = $('meta[name="description"]').attr('content') || 
                        $('meta[property="og:description"]').attr('content') || 
                        "No summary available for this link.";

    // 3. Extract Main Content (Simplified readability)
    // Remove scripts, styles, and navs to get cleaner text stats
    $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(' ').length;
    
    // Estimate reading time (200 words per minute)
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    // 4. Generate Simple Content for Reader Mode
    // We try to grab the article tag or main container, falling back to body
    let contentHtml = $('article').html() || $('main').html() || $('body').html();
    
    // 5. Basic Categorization & Difficulty Heuristics
    const techKeywords = ['code', 'software', 'programming', 'react', 'api', 'developer'];
    const designKeywords = ['ui', 'ux', 'design', 'color', 'typography', 'layout'];
    const scienceKeywords = ['research', 'study', 'data', 'analysis', 'science'];
    
    let category = 'General';
    const lowerBody = bodyText.toLowerCase();
    
    if (techKeywords.some(k => lowerBody.includes(k))) category = 'Technology';
    else if (designKeywords.some(k => lowerBody.includes(k))) category = 'Design';
    else if (scienceKeywords.some(k => lowerBody.includes(k))) category = 'Science';

    const difficulty = wordCount > 1500 ? 'Advanced' : wordCount > 800 ? 'Medium' : 'Easy';

    // 6. Generate Tags
    const tags = [category.toLowerCase()];
    if (readTimeMinutes > 10) tags.push('long-read');
    if (lowerBody.includes('tutorial') || lowerBody.includes('how to')) tags.push('tutorial');

    res.status(200).json({
      title,
      summary: description,
      content: contentHtml,
      category,
      readingTime: `${readTimeMinutes} min`,
      difficulty,
      tags,
      date: new Date().toLocaleDateString()
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze URL',
      details: error.message 
    });
  }
}