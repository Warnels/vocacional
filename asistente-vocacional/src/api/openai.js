import { Configuration, OpenAIApi } from "openai";

// Configuración para DeepSeek
const configuration = new Configuration({
  apiKey: "sk-3f254ac037e145859698453a24d42588", // Reemplaza con tu clave de API de DeepSeek
  basePath: "https://api.deepseek.com/v1",
});

const openai = new OpenAIApi(configuration);

// Prompt personalizado
const basePrompt = `
Eres un orientador vocacional profesional en Ecuador.
Tu tarea es guiar a estudiantes según sus intereses, habilidades y ubicación hacia una carrera universitaria adecuada.
Debes recomendar carreras universitarias que existan en Ecuador, y sugerir universidades cercanas a la región del estudiante (Sierra, Costa, Amazonía, Galápagos o una ciudad específica si está disponible).
Habla de forma empática, clara, motivadora y positiva.
Si el usuario expresa un interés específico (por ejemplo, arte, medicina, tecnología), enfócate en eso.
Cuando sea posible, menciona universidades públicas y privadas de esa región.
Si no tienes información suficiente sobre la ubicación, sugiere opciones generales en el país.
`;

export const sugerirCarrera = async (conversacionUsuario) => {
  try {
    const response = await openai.createChatCompletion({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: basePrompt },
        ...conversacionUsuario,
      ],
      temperature: 0.7,
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error al conectar con DeepSeek:", error.response?.data || error.message);
    return "Lo siento, hubo un error al procesar tu solicitud.";
  }
};
