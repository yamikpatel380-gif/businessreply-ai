// Gemini REST API using native Node.js fetch; keys stay in request headers only.
// Retry transient upstream failures with bounded exponential backoff and jitter.
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
export function createGeminiReply({
  apiKey,
  model = 'gemini-3.1-flash-lite',
  systemInstruction = '',
  fetchImpl = fetch,
  sleepImpl = pause,
  maxAttempts = 3,
}) {
  return async question => {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid GEMINI_MODEL');
    const attempts = Math.max(1, Math.min(4, Number(maxAttempts) || 3));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const body = JSON.stringify({
      systemInstruction:{parts:[{text:systemInstruction}]},
      contents:[{role:'user',parts:[{text:String(question || '').slice(0,6500)}]}],
      generationConfig:{maxOutputTokens:800},
    });
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let response;
      try {
        response = await fetchImpl(url, {
          method:'POST',
          headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
          body,
          signal:AbortSignal.timeout(40000),
        });
      } catch (e) {
        if (attempt < attempts && (e?.name === 'TimeoutError' || e?.name === 'AbortError' || e instanceof TypeError)) {
          await sleepImpl(1200 * 2 ** (attempt - 1) + Math.floor(Math.random()*400));
          continue;
        }
        throw new Error('Gemini connection failed after retries. Check internet or try again later.');
      }
      if (!response.ok) {
        const transient = [408,429,500,502,503,504].includes(response.status);
        if (transient && attempt < attempts) {
          await sleepImpl(1200 * 2 ** (attempt - 1) + Math.floor(Math.random()*400));
          continue;
        }
        if (response.status===429) throw new Error('Gemini HTTP 429: quota/rate limit reached. Check AI Studio usage and limits.');
        if (response.status===503 || response.status===502 || response.status===504)
          throw new Error(`Gemini HTTP ${response.status}: service temporarily unavailable after ${attempt} attempts. Try again later; no reply was sent.`);
        if (response.status===403) throw new Error('Gemini HTTP 403: API access denied. Check API key/project eligibility and permissions.');
        if (response.status===400) throw new Error('Gemini HTTP 400: request rejected. Check model configuration.');
        if (response.status===401) throw new Error('Gemini HTTP 401: API key was not accepted.');
        if (response.status===404) throw new Error(`Gemini HTTP 404: model ${model} not found or not available to this project.`);
        throw new Error(`Gemini API returned HTTP ${response.status}`);
      }
      let data;
      try { data=await response.json(); }
      catch { throw new Error('Gemini returned invalid response JSON'); }
      const answer=(data.candidates||[])
        .flatMap(c=>c.content?.parts||[])
        .map(part=>typeof part.text==='string'?part.text:'')
        .join('\n').trim();
      if (!answer) throw new Error('Gemini returned no text. Response may have been filtered.');
      return answer.slice(0,1600);
    }
  };
}
