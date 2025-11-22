export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required to list models' });
  }

  try {
    // Direct REST call to get models associated with the key
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Filter for models that support content generation
    const validModels = data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
      .map(m => ({
        name: m.name.replace('models/', ''),
        displayName: m.displayName,
        description: m.description,
        version: m.version
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({ models: validModels });

  } catch (error) {
    console.error('Model fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch models', 
      details: error.message 
    });
  }
}