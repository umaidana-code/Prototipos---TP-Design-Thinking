import 'dotenv/config';
import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/ai/recommendations', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient();
    const { rubros, rules, orders } = req.body ?? {};

    const prompt = `
Eres el motor de análisis presupuestario de EscenaViva Entertainment (distribuidora de alimentos y electrodomésticos en Argentina).
Analiza el estado actual del presupuesto mensual en pesos argentinos (ARS) y genera recomendaciones claras y simples para redistribuir presupuesto y prevenir quiebres.

Estado actual:
- Rubros: ${JSON.stringify(rubros)}
- Reglas vigentes: ${JSON.stringify(rules)}
- Órdenes recientes y pendientes: ${JSON.stringify((orders ?? []).slice(0, 12))}

Responde en español claro, directo y comprensible para un gerente de compras y operarios.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Responde siempre en español claro y conciso. Usa cifras concretas en ARS y porcentajes basados únicamente en los datos recibidos.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            resumenEjecutivo: {
              type: Type.STRING,
              description: 'Diagnóstico breve de la situación actual en 2 o 3 oraciones.',
            },
            recomendaciones: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rubro: { type: Type.STRING },
                  accion: {
                    type: Type.STRING,
                    description: 'Ej: Reforzar con Fondo Adicional, Mantener, Monitorear, Reasignar',
                  },
                  detalle: { type: Type.STRING },
                  montoSugeridoARS: { type: Type.NUMBER },
                },
                required: ['rubro', 'accion', 'detalle', 'montoSugeridoARS'],
              },
            },
            focosDemanda: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 puntos clave sobre productos o rubros de mayor presión de demanda.',
            },
          },
          required: ['resumenEjecutivo', 'recomendaciones', 'focosDemanda'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    if (message === 'MISSING_API_KEY') {
      res.status(503).json({
        error:
          'No se detectó la clave GEMINI_API_KEY en el entorno. Configurala en Settings > Secrets para activar el análisis con IA.',
      });
      return;
    }
    res.status(500).json({
      error: `No se pudo generar el análisis con IA: ${message}`,
    });
  }
});

app.post('/api/ai/ask', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient();
    const { question, context } = req.body ?? {};

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Ingresá una consulta válida.' });
      return;
    }

    const prompt = `
Contexto presupuestario en vivo de EscenaViva Entertainment:
${JSON.stringify(context)}

Consulta del usuario (operario o gerente de compras):
"${question}"

Responde de forma directa, simple y práctica en español, citando cifras reales del contexto (saldos pagados/ejecutados, comprometidos sin pagar, disponibles, umbral de aprobación y órdenes pendientes). Máximo 4 párrafos cortos o viñetas claras.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Eres el asistente inteligente de compras y presupuesto de EscenaViva Entertainment. Respondes en español claro, sin tecnicismos innecesarios.',
      },
    });

    res.json({ answer: (response.text ?? '').trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    if (message === 'MISSING_API_KEY') {
      res.status(503).json({
        error:
          'No se detectó la clave GEMINI_API_KEY en el entorno. Configurala en Settings > Secrets para usar el asistente inteligente.',
      });
      return;
    }
    res.status(500).json({
      error: `Error al consultar al asistente inteligente: ${message}`,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EscenaViva ERP server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
