import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

Deno.serve(async (req) => {
  // CORS — necessário pro navegador conseguir chamar essa função
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { tipo, descricao, fotoUrl, duplicatasCount } = await req.json();

    // Monta o conteúdo enviado pra IA: texto sempre, imagem se tiver foto
    const parts = [];

    const prompt = `
Você é um sistema de análise de ocorrências urbanas (tipo: ${tipo}).
Descrição do cidadão: "${descricao || "Sem descrição"}"
Ocorrências similares próximas: ${duplicatasCount || 0}

Analise o problema relatado e, se houver uma imagem, leve em conta também o que aparece nela
(gravidade visual do dano, risco aparente, etc).

Responda APENAS em JSON, sem nenhum texto fora do JSON, no formato exato:
{
  "criticidade": "baixa" | "media" | "alta",
  "resumo": "um parágrafo curto e técnico explicando a classificação, em português"
}
`;

    parts.push({ text: prompt });

    if (fotoUrl) {
      // Busca a imagem e converte pra base64, pois a API do Gemini exige
      // os bytes da imagem (não aceita URL direta)
      const imgRes = await fetch(fotoUrl);
      const imgBuffer = await imgRes.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(imgBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64,
        },
      });
    }

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
      }),
    });

    const geminiData = await geminiRes.json();
    console.log("Resposta do Gemini:", JSON.stringify(geminiData));
    const textoResposta = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Remove ```json e ``` se a IA tiver colocado por engano
    const limpo = textoResposta.replace(/```json|```/g, "").trim();
    const resultado = JSON.parse(limpo);

    return new Response(JSON.stringify(resultado), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Erro na análise:", err);
    return new Response(
      JSON.stringify({ criticidade: "media", resumo: "Não foi possível analisar automaticamente. Revisão manual recomendada." }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});