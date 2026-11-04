// Provider selection: Gemini, OpenAI, or OpenAI-compatible (including local Ollama).
import { createGeminiReply } from './gemini.mjs';

function safeProviderUrl(base) {
  let url;
  try { url = new URL(base); } catch { throw new Error('AI_BASE_URL must be a valid URL'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
    throw new Error('AI_BASE_URL must use HTTPS (or localhost HTTP for local models)');
  if (url.username || url.password || url.search || url.hash) throw new Error('AI_BASE_URL must not contain credentials or query parameters');
  return url.toString().replace(/\/$/, '');
}
export function createProvider(env=process.env, fetchImpl=fetch) {
  const provider = String(env.AI_PROVIDER || 'gemini').toLowerCase();
  const gemini = provider === 'gemini';
  const openai = provider === 'openai';
  const compatible = provider === 'openai-compatible';
  if (!gemini && !openai && !compatible) throw new Error('AI_PROVIDER must be gemini, openai or openai-compatible');
  const model = (env.AI_MODEL || (gemini?'gemini-3.1-flash-lite':openai?'gpt-4.1-mini':'llama3.2')).trim();
  if (!/^[a-zA-Z0-9._:\/-]{1,100}$/.test(model)) throw new Error('Invalid AI_MODEL');
  const key = String(gemini?env.GEMINI_API_KEY||'':openai?env.OPENAI_API_KEY||'':env.AI_API_KEY||'').trim();
  if (gemini) {
    const client = createGeminiReply({apiKey:key,model,fetchImpl,systemInstruction:'You provide factual customer support based on the per-request business profile. Do not invent business details.'});
    return {provider,model,ready:!!key,async ask(prompt){return client(prompt)}};
  }
  const base = safeProviderUrl(openai?'https://api.openai.com/v1':(env.AI_BASE_URL || 'http://127.0.0.1:11434/v1'));
  const ready = openai?!!key:true; // Local OpenAI-compatible providers may not require a key.
  return {provider,model,ready,async ask(prompt){
    if (!ready) throw new Error(`${provider} API key not configured`);
    const headers={'Content-Type':'application/json'};
    if (key) headers.Authorization=`Bearer ${key}`;
    let response;
    try {
      response=await fetchImpl(`${base}/chat/completions`, {method:'POST',headers,body:JSON.stringify({model,messages:[{role:'system',content:'You are a careful AI customer service assistant. Follow the business information and security constraints inside the user prompt; do not invent missing facts.'},{role:'user',content:String(prompt).slice(0,12000)}],max_tokens:800}),signal:AbortSignal.timeout(40000)});
    } catch { throw new Error(`${provider} is unreachable or timed out`); }
    if(!response.ok) throw new Error(`${provider} returned HTTP ${response.status}`);
    const result=await response.json();
    const text=result?.choices?.[0]?.message?.content;
    if(typeof text!=='string'||!text.trim()) throw new Error(`${provider} returned no text`);
    return text.trim().slice(0,1800);
  }};
}
