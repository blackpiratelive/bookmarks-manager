/**
 * Vercel Serverless Function for Fetching and Parsing Article Content.
 * * Purpose: This function acts as a secure proxy to fetch external URLs, bypass CORS restrictions,
 * and strip the HTML down to clean, readable article content (for Reader Mode and AI analysis).
 * * Dependencies (MUST be installed in your Node.js project for Vercel deployment):
 * 1. node-fetch (or native fetch if using Vercel's Node environment)
 * 2. jsdom (to simulate a browser environment for parsing)
 * 3. @mozilla/readability (to reliably extract the main article text)
 */
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

// NOTE: Ensure 'node-fetch' is imported if using an older Node environment.
// For modern Vercel runtimes, you can often use the global 'fetch' function directly.

export default async function handler(req, res) {
    // Vercel functions typically receive the URL parameters in the query object
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is missing.' });
    }

    try {
        console.log(`Attempting to fetch and parse: ${url}`);

        // 1. Fetch the raw HTML content from the external URL
        const fetchResponse = await fetch(url);
        
        if (!fetchResponse.ok) {
            console.error(`Failed to fetch URL: ${fetchResponse.status}`);
            return res.status(fetchResponse.status).json({ error: `Failed to fetch URL: ${fetchResponse.statusText}` });
        }

        const html = await fetchResponse.text();

        // 2. Use JSDOM to create a DOM environment
        const doc = new JSDOM(html, { url });

        // 3. Use Readability (Mozilla's parser) to extract the clean article content
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        if (!article || !article.textContent) {
            return res.status(404).json({ error: 'Could not extract main article content.' });
        }

        const cleanContent = article.textContent.trim();
        const wordCount = cleanContent.split(/\s+/).length;

        // 4. Return the clean data to the client
        res.status(200).json({
            title: article.title || new URL(url).hostname.replace('www.', ''),
            content: cleanContent, // The clean text for AI and Reader Mode
            wordCount: wordCount
        });

    } catch (error) {
        console.error('Error during article fetching/parsing:', error);
        res.status(500).json({ error: 'Internal server error during content processing.' });
    }
}