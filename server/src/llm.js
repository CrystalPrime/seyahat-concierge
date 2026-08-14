const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-cloud";
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT) || 1024;
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 45000;

// Calls Ollama's native /api/chat endpoint (non-streaming) and returns the
// assistant message content as a string.
async function ollamaChat(messages, { temperature = 0, numPredict = OLLAMA_NUM_PREDICT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: { temperature, num_predict: numPredict },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    const content = data?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Ollama boş cevap döndürdü");
    }
    return content;
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`Ollama isteği ${OLLAMA_TIMEOUT_MS}ms içinde yanıt vermedi`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { ollamaChat, OLLAMA_BASE_URL, OLLAMA_MODEL };
