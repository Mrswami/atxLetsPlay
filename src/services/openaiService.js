/**
 * OpenAI & OpenRouter Service for ATX Let's Play Map
 * Supports both direct OpenAI keys (sk-...) and OpenRouter keys (sk-or-v1-...)
 */

export function getStoredOpenAIKey() {
  return (
    localStorage.getItem('atx_openai_key') ||
    import.meta.env.VITE_OPENAI_API_KEY ||
    import.meta.env.VITE_OPENROUTER_API_KEY ||
    ''
  );
}

export function setStoredOpenAIKey(key) {
  if (key && key.trim()) {
    localStorage.setItem('atx_openai_key', key.trim());
  } else {
    localStorage.removeItem('atx_openai_key');
  }
}

function getApiConfig(apiKey, requestedModel = 'gpt-4o-mini') {
  const isOpenRouter = apiKey.startsWith('sk-or-v1-');

  let endpoint = 'https://api.openai.com/v1/chat/completions';
  let model = requestedModel;

  if (isOpenRouter) {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    if (!requestedModel.includes('/')) {
      model = `openai/${requestedModel}`;
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (isOpenRouter) {
    headers['HTTP-Referer'] = 'https://atxletsplay.firebaseapp.com';
    headers['X-Title'] = "ATX Let's Play";
  }

  return { endpoint, model, headers };
}

/**
 * Natural language map query parser using OpenAI / OpenRouter
 */
export async function searchMapWithOpenAI({ query, locations = [], model = 'gpt-4o-mini' }) {
  const apiKey = getStoredOpenAIKey();
  if (!apiKey) {
    throw new Error('API Key is missing. Please add your key in Settings or .env file.');
  }

  const { endpoint, model: resolvedModel, headers } = getApiConfig(apiKey, model);

  const systemPrompt = `You are an expert GIS and Austin spatial search assistant for ATX Let's Play.
You will receive a user query and a list of available Austin courts/landmarks with metadata (id, name, district, sport, address, lat, lng, amenities).
Respond strictly in JSON format with this structure:
{
  "explanation": "Short friendly explanation of matching places",
  "matchedIds": ["id1", "id2"],
  "suggestedCenter": { "lat": 30.2747, "lng": -97.7404 },
  "suggestedZoom": 13,
  "categoryFilter": "all"
}`;

  const userPrompt = `User Query: "${query}"

Available Locations:
${JSON.stringify(
  locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    district: loc.district,
    sport: loc.sport || loc.category,
    address: loc.address,
    lat: loc.lat,
    lng: loc.lng,
    amenities: loc.amenities || [],
  })),
  null,
  2
)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: resolvedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `AI API call failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

/**
 * AI Map Assistant Chat / Location Guide
 */
export async function askAustinAiAssistant({ prompt, locationContext = null, model = 'gpt-4o-mini' }) {
  const apiKey = getStoredOpenAIKey();
  if (!apiKey) {
    throw new Error('API Key is missing. Please configure it in Settings or .env file.');
  }

  const { endpoint, model: resolvedModel, headers } = getApiConfig(apiKey, model);

  const systemPrompt = `You are ATX Scout, an upbeat local Austin sport & landmark AI guide.
Help players find pickup games, local food spots, landmarks, court lighting, and neighborhood vibes in Austin, Texas.
Keep answers concise, engaging, and action-oriented. Use emojis appropriately.`;

  const messages = [{ role: 'system', content: systemPrompt }];
  if (locationContext) {
    messages.push({
      role: 'system',
      content: `Current Location Context: ${JSON.stringify(locationContext)}`,
    });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: resolvedModel,
      messages,
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `AI API request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

