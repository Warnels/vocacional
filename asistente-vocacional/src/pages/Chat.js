import React, { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import "../styles/chat.css";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import personaje from "../assets/personaje.png";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const socket = new WebSocket("ws://localhost:8090");

const preguntas = [
  "¿Cuál es tu área de interés principal? (Ej: Ciencias, Arte, Tecnología, Medicina, Derecho, etc.)",
  "¿Prefieres trabajar con personas, datos o máquinas?",
  "¿Qué actividades disfrutas más en tu tiempo libre?",
  "¿Te gustaría trabajar en equipo o prefieres tareas individuales?",
  "¿Qué asignaturas te gustaban más en el colegio?",
  "¿Cuál es tu nivel de habilidades en matemáticas, escritura o creatividad?",
  "¿Te interesa resolver problemas prácticos o analizar teorías?",
  "¿Te gustaría trabajar en oficina, al aire libre o en un entorno dinámico?",
  "¿Cuál es tu meta profesional a largo plazo? (Ej: tener un negocio, ser investigador, ayudar a la comunidad, etc.)",
  "¿En qué región o ciudad de Ecuador vives o te gustaría estudiar?",
  "¿Estarías dispuesto a mudarte de ciudad para estudiar tu carrera ideal?",
  "¿Te interesa estudiar en una universidad pública, privada o no tienes preferencia?",
];

// Esta función analiza si la respuesta tiene formato de recomendación para mostrarla mejor
function parseRecomendacion(text) {
  const carrera = text.match(/Carrera:\s*(.+)/i)?.[1];
  const motivos = text.match(/Motivos:\s*(.+)/i)?.[1];
  const universidad = text.match(/Universidad:\s*(.+)/i)?.[1];
  const ciudad = text.match(/Ciudad:\s*(.+)/i)?.[1];
  const tipo = text.match(/Tipo:\s*(.+)/i)?.[1];
  const imagen = text.match(/Imagen:\s*(https?:\/\/[^\s]+)/i)?.[1];

  if (carrera && universidad) {
    return { carrera, motivos, universidad, ciudad, tipo, imagen };
  }
  return null;
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [preguntaIndex, setPreguntaIndex] = useState(-1);
  const [historyList, setHistoryList] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const messageHandlerRef = useRef(null);
  const navigate = useNavigate();

  async function guardarRespuesta(userId, pregunta, respuesta) {
    if (!userId) return;
    try {
      await addDoc(collection(db, "users", userId, "respuestasChat"), {
        pregunta,
        respuesta,
        fecha: serverTimestamp(),
      });
    } catch (e) {
      console.error("Guardar respuesta:", e);
    }
  }



  async function sugerirCarrera(userId) {
    try {
      const respuestasRef = collection(db, "users", userId, "respuestasChat");
      const snap = await getDocs(respuestasRef);

      const respuestas = snap.docs
        .map((doc) => {
          const data = doc.data();
          return `Pregunta: ${data.pregunta}\nRespuesta: ${data.respuesta}`;
        })
        .join("\n\n");

      const prompt = `
Eres un orientador vocacional. Basado en las siguientes respuestas de un estudiante, sugiere 1 o 2 carreras profesionales adecuadas y explica brevemente por qué.
Además, recomienda una universidad en Ecuador que esté en la región o ciudad indicada por el estudiante, incluyendo nombre, ciudad, tipo (pública o privada) y una imagen representativa de la carrera o universidad en formato URL.

${respuestas}

Responde en español de forma clara y amigable, usando este formato exacto:

Carrera: <nombre de la carrera>
Motivos: <explicación corta>
Universidad: <nombre de la universidad>
Ciudad: <ciudad>
Tipo: <pública o privada>
Imagen: <url de imagen>

Ejemplo:
Carrera: Ingeniería Ambiental
Motivos: Te interesa la naturaleza, los problemas ecológicos y disfrutas trabajar al aire libre.
Universidad: Universidad Técnica del Norte
Ciudad: Ibarra
Tipo: Pública
Imagen: https://cdn-icons-png.flaticon.com/512/2547/2547478.png
      `;

      agregarMensaje({
        content: "Analizando tus respuestas para darte una recomendación personalizada...",
        role: "assistant",
        id: uuidv4(),
      });

      const response = await axios.post(
        "https://api.deepseek.com/v1/chat/completions", // ✅ URL de DeepSeek
        {
          model: "deepseek-chat", // ✅ Modelo DeepSeek
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.REACT_APP_DEEPSEEK_API_KEY}`, // ✅ Usa la variable que tú tengas para DeepSeek
          },
        }
      );

      const recomendacion = response.data.choices[0].message.content;
      agregarMensaje({
        content: recomendacion,
        role: "assistant",
        id: uuidv4(),
      });
    } catch (err) {
      console.error("Error al obtener sugerencia:", err);
      agregarMensaje({
        content: "Hubo un error al obtener tu recomendación. Intenta más tarde.",
        role: "assistant",
        id: uuidv4(),
      });
    }
  }

  const nuevoChat = async () => {
    if (!user || messages.length === 0) return;
    try {
      await addDoc(collection(db, "users", user.uid, "historialChats"), {
        mensajes: messages,
        fecha: serverTimestamp(),
      });
      setMessages([]);
      setShowHistory(false);
      setPreguntaIndex(0);
    } catch (e) {
      console.error("Guardar historial:", e);
    }
  };

  const verHistorial = async () => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "historialChats"),
      orderBy("fecha", "desc")
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({
      id: d.id,
      fecha: d.data().fecha.toDate().toLocaleString(),
      mensajes: d.data().mensajes,
    }));
    setHistoryList(list);
    setShowHistory(true);
  };

  const handleVerChat = (chat) => {
    setMessages(chat.mensajes);
    setShowHistory(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const nombre =
          firebaseUser.displayName || firebaseUser.email.split("@")[0];
        setUser({
          displayName: nombre,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          uid: firebaseUser.uid,
        });
        setPreguntaIndex(0);
        agregarMensaje({
          content: `¡Hola ${nombre}! Bienvenido al asistente vocacional.`,
          role: "assistant",
          id: uuidv4(),
        });
      } else {
        setUser(null);
        setMessages([]);
        setPreguntaIndex(-1);
        navigate("/login"); // Redirigir si no hay sesión
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const agregarMensaje = (msg) => setMessages((prev) => [...prev, msg]);

  useEffect(() => {
    if (preguntaIndex >= 0 && preguntaIndex < preguntas.length) {
      agregarMensaje({
        content: preguntas[preguntaIndex],
        role: "assistant",
        id: uuidv4(),
      });
    } else if (preguntaIndex === preguntas.length) {
      agregarMensaje({
        content:
          "Gracias por tus respuestas. Ahora voy a ayudarte a elegir la carrera adecuada...",
        role: "assistant",
        id: uuidv4(),
      });
      // Aquí modificamos para que no bloquee el chat y permita seguir conversando
      setPreguntaIndex(-2); // Modo conversación libre activo
      sugerirCarrera(user.uid);
    }
  }, [preguntaIndex]);

  const handleSubmit = async (text) => {
    if (isLoading) return;

    const textoEnviar = text || question;

    // Modo preguntas iniciales
    if (preguntaIndex >= 0 && preguntaIndex < preguntas.length) {
      if (!textoEnviar.trim()) return;
      agregarMensaje({ content: textoEnviar, role: "user", id: uuidv4() });
      guardarRespuesta(user.uid, preguntas[preguntaIndex], textoEnviar);
      setQuestion("");
      setPreguntaIndex(preguntaIndex + 1);
      return;
    }

    // Modo conversación libre después de la recomendación
    if (preguntaIndex === -2) {
      if (!textoEnviar.trim()) return;
      agregarMensaje({ content: textoEnviar, role: "user", id: uuidv4() });
      setQuestion("");
      setIsLoading(true);

      try {
        // Enviar contexto de la conversación completa a la API
        const mensajesContexto = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }));
        // Añadimos el mensaje actual del usuario
        mensajesContexto.push({ role: "user", content: textoEnviar });

        const response = await axios.post(
          "https://api.deepseek.com/v1/chat/completions",
          {
            model: "deepseek-chat",
            messages: mensajesContexto,
            temperature: 0.7,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.REACT_APP_DEEPSEEK_API_KEY}`,
            },
          }
        );

        const respuestaIA = response.data.choices[0].message.content;
        agregarMensaje({ content: respuestaIA, role: "assistant", id: uuidv4() });

        guardarRespuesta(user.uid, textoEnviar, respuestaIA);
      } catch (error) {
        console.error("Error al obtener respuesta IA:", error);
        agregarMensaje({
          content: "Disculpa, hubo un error al procesar tu consulta. Intenta de nuevo.",
          role: "assistant",
          id: uuidv4(),
        });
      } finally {
        setIsLoading(false);
      }

      return;
    }

    // En caso de que preguntaIndex sea -1 o cualquier otro valor, permitir conversación libre igual
    if (!textoEnviar.trim()) return;
    agregarMensaje({ content: textoEnviar, role: "user", id: uuidv4() });
    setQuestion("");
    setIsLoading(true);

    try {
      const mensajesContexto = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));
      mensajesContexto.push({ role: "user", content: textoEnviar });

      const response = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
          messages: mensajesContexto,
          temperature: 0.7,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.REACT_APP_DEEPSEEK_API_KEY}`,
          },
        }
      );

      const respuestaIA = response.data.choices[0].message.content;
      agregarMensaje({ content: respuestaIA, role: "assistant", id: uuidv4() });
      guardarRespuesta(user.uid, textoEnviar, respuestaIA);
    } catch (error) {
      console.error("Error al obtener respuesta IA:", error);
      agregarMensaje({
        content: "Disculpa, hubo un error al procesar tu consulta. Intenta de nuevo.",
        role: "assistant",
        id: uuidv4(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupMessageHandler = () => {
    if (messageHandlerRef.current && socket) {
      socket.removeEventListener("message", messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    navigate("/login");
  };

  return (
    <div className="container-fluid vh-100 dark-theme">
      <div className="row h-100">
        <div className="col-9 d-flex flex-column border-end p-0 chat-section">
          <div className="header p-3 d-flex justify-content-between align-items-center">
            <h5 className="m-0">Asistente Vocacional</h5>
            {user && (
              <button
                className="btn btn-outline-light d-flex align-items-center gap-2"
                onClick={() => setShowProfile(!showProfile)}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Perfil"
                    style={{ width: 32, height: 32, borderRadius: "50%" }}
                  />
                ) : (
                  <span>{user.email}</span>
                )}
              </button>
            )}
          </div>

          <div className="flex-grow-1 overflow-auto p-3 chat-body">
            {showHistory ? (
              <div className="history-list">
                <h6>Historial de Chats</h6>
                {historyList.map((h) => (
                  <div
                    key={h.id}
                    className="history-item"
                    onClick={() => handleVerChat(h)}
                    style={{
                      cursor: "pointer",
                      padding: "5px",
                      borderBottom: "1px solid #444",
                    }}
                  >
                    {h.fecha}
                  </div>
                ))}
              </div>
            ) : (
              messages.map((msg, i) => {
                const isAssistant = msg.role === "assistant";

                const formatted = parseRecomendacion(msg.content);

                return (
                  <div
                    key={i}
                    className={`d-flex mb-2 ${
                      msg.role === "user"
                        ? "justify-content-end"
                        : "justify-content-start"
                    }`}
                  >
                    {isAssistant && (
                      <img
                        src={personaje}
                        alt="Asistente"
                        className="chat-avatar me-2"
                      />
                    )}
                    <div
                      className={`p-2 rounded message-bubble ${
                        msg.role === "user"
                          ? "user-message"
                          : "assistant-message"
                      }`}
                      style={{ maxWidth: "75%", whiteSpace: "pre-wrap" }}
                    >
                      {formatted ? (
                        <div className="recomendacion-card">
                          <h5>🎓 Carrera recomendada</h5>
                          <p>
                            <strong>Carrera:</strong> {formatted.carrera}
                          </p>
                          <p>
                            <strong>Motivos:</strong> {formatted.motivos}
                          </p>
                          <hr />
                          <p>
                            <strong>🏫 Universidad sugerida:</strong>
                          </p>
                          <ul>
                            <li>
                              <strong>Nombre:</strong> {formatted.universidad}
                            </li>
                            <li>
                              <strong>Ciudad:</strong>{" "}
                              {formatted.ciudad || "No especificada"}
                            </li>
                            <li>
                              <strong>Tipo:</strong>{" "}
                              {formatted.tipo || "No especificado"}
                            </li>
                          </ul>
                          {formatted.imagen && (
                            <img
                              src={formatted.imagen}
                              alt={formatted.carrera}
                              style={{
                                width: "100px",
                                marginTop: "10px",
                                borderRadius: "8px",
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {isLoading && (
              <div className="text-muted small mt-2">Escribiendo...</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {!showHistory && (
            <div className="border-top p-3 d-flex gap-2 chat-input">
              <input
                type="text"
                className="form-control bg-dark text-white border-secondary"
                placeholder={
                  preguntaIndex !== -1
                    ? "Escribe tu respuesta..."
                    : "Escribe tu mensaje..."
                }
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                disabled={preguntaIndex === -1 && isLoading}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleSubmit()}
                disabled={preguntaIndex === -1 && isLoading}
              >
                Enviar
              </button>
            </div>
          )}
        </div>

        <div className="col-3 d-flex flex-column position-relative p-4 options-panel">
          <h5>Opciones</h5>
          <ul className="list-group mt-3">
            <li
              className="list-group-item list-group-item-dark"
              onClick={nuevoChat}
              style={{ cursor: "pointer" }}
            >
              Nuevo chat
            </li>
            <li
              className="list-group-item list-group-item-dark"
              onClick={verHistorial}
              style={{ cursor: "pointer" }}
            >
              Ver historial de chats
            </li>
            <li
              className="list-group-item list-group-item-dark"
              onClick={() => navigate("/carreras")}
              style={{ cursor: "pointer" }}
            >
              Ver carreras
            </li>
            <li
              className="list-group-item list-group-item-dark"
              onClick={() =>
                (window.location.href =
                  "https://chatbot-f02ad.web.app/universidades")
              }
              style={{ cursor: "pointer" }}
            >
              Universidades
            </li>
          </ul>

          {showProfile && user && (
            <div
              className="position-absolute bg-dark border rounded p-3 shadow text-white"
              style={{ bottom: 70, right: 20, width: 250, zIndex: 1000 }}
            >
              <div className="d-flex align-items-center gap-3 mb-3">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt="Perfil"
                    style={{ width: 48, height: 48, borderRadius: "50%" }}
                  />
                )}
                <div>
                  <strong>{user.displayName}</strong>
                  <br />
                  <small>{user.email}</small>
                </div>
              </div>
              <button
                className="btn btn-sm btn-outline-danger w-100"
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
