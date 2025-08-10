import React, { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { v4 as uuidv4 } from "uuid";
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
import { marked } from "marked";

const preguntas = [
  {
    texto: "¿Cuál es tu área de interés principal?",
    opciones: ["Ciencias", "Arte", "Tecnología", "Medicina", "Derecho"],
  },
  {
    texto: "¿Prefieres trabajar con personas, datos o máquinas?",
    opciones: ["Personas", "Datos", "Máquinas"],
  },
  {
    texto: "¿Qué actividades disfrutas más en tu tiempo libre?",
    opciones: ["Leer", "Deporte", "Videojuegos", "Arte", "Ciencia"],
  },
  {
    texto: "¿Te gustaría trabajar en equipo o prefieres tareas individuales?",
    opciones: ["En equipo", "Individual"],
  },
  {
    texto: "¿Qué asignaturas te gustaban más en el colegio?",
    opciones: ["Matemáticas", "Lengua", "Ciencias", "Historia", "Arte"],
  },
  {
    texto: "¿Cuál es tu nivel de habilidades en matemáticas, escritura o creatividad?",
    opciones: ["Alto", "Medio", "Bajo"],
  },
  {
    texto: "¿Te interesa resolver problemas prácticos o analizar teorías?",
    opciones: ["Problemas prácticos", "Analizar teorías"],
  },
  {
    texto: "¿Te gustaría trabajar en oficina, al aire libre o en un entorno dinámico?",
    opciones: ["Oficina", "Al aire libre", "Entorno dinámico"],
  },
  {
    texto: "¿Cuál es tu meta profesional a largo plazo?",
    opciones: ["Tener un negocio", "Ser investigador", "Ayudar a la comunidad", "Otro"],
  },
  {
    texto: "¿En qué región o ciudad de Ecuador vives o te gustaría estudiar?",
    opciones: ["Quito", "Guayaquil", "Cuenca", "Otra"],
  },
  {
    texto: "¿Estarías dispuesto a mudarte de ciudad para estudiar tu carrera ideal?",
    opciones: ["Sí", "No"],
  },
  {
    texto: "¿Te interesa estudiar en una universidad pública, privada o no tienes preferencia?",
    opciones: ["Pública", "Privada", "Sin preferencia"],
  },
];

function convertirMarkdown(texto) {
  return { __html: marked.parse(texto) };
}

function extraerPorcentajes(texto) {
  const regex = /###\s*\d+\.\s*.*?(\d{1,3})%/g;
  const resultados = [];
  let match;
  while ((match = regex.exec(texto)) !== null) {
    resultados.push(match[1]);
  }
  return resultados;
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
Eres un orientador vocacional. Basado en las siguientes respuestas de un estudiante, sugiere 1 o 2 carreras profesionales adecuadas y detalla las razones, universidades y lugares para estudiar, sin usar símbolos Markdown como asteriscos o guiones, solo texto claro y bien estructurado:

${respuestas}
      `;

      agregarMensaje({
        content: "Analizando tus respuestas para darte una recomendación personalizada...",
        role: "assistant",
        id: uuidv4(),
      });

      setIsLoading(true);

      const response = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.REACT_APP_DEEPSEEK_API_KEY}`,
          },
        }
      );

      setIsLoading(false);

      const recomendacion = response.data.choices[0].message.content;
      agregarMensaje({
        content: recomendacion,
        role: "assistant",
        id: uuidv4(),
      });
    } catch (err) {
      setIsLoading(false);
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
        const nombre = firebaseUser.displayName || firebaseUser.email.split("@")[0];
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
        navigate("/login");
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
        content: preguntas[preguntaIndex].texto,
        role: "assistant",
        id: uuidv4(),
      });
    } else if (preguntaIndex === preguntas.length) {
      agregarMensaje({
        content: "Gracias por tus respuestas. Ahora voy a ayudarte a elegir la carrera adecuada...",
        role: "assistant",
        id: uuidv4(),
      });
      setPreguntaIndex(-2);
      sugerirCarrera(user.uid);
    }
  }, [preguntaIndex]);

  const handleSubmit = async (text) => {
    if (isLoading) return;
    const textoEnviar = text || question;
    if (!textoEnviar.trim()) return;

    agregarMensaje({ content: textoEnviar, role: "user", id: uuidv4() });
    setQuestion("");
  };

  const handleOpcion = (opcion) => {
    agregarMensaje({ content: opcion, role: "user", id: uuidv4() });
    guardarRespuesta(user.uid, preguntas[preguntaIndex].texto, opcion);
    setPreguntaIndex(preguntaIndex + 1);
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
                    style={{ cursor: "pointer", padding: "5px", borderBottom: "1px solid #444" }}
                  >
                    {h.fecha}
                  </div>
                ))}
              </div>
            ) : (
              messages.map((msg, i) => {
                const isAssistant = msg.role === "assistant";

                return (
                  <div
                    key={i}
                    className={`d-flex mb-2 ${
                      isAssistant ? "justify-content-start" : "justify-content-end"
                    }`}
                  >
                    {isAssistant && <img src={personaje} alt="Asistente" className="chat-avatar me-2" />}
                    {isAssistant ? (
                      <div
                        className="p-2 rounded assistant-message"
                        style={{ maxWidth: "75%", whiteSpace: "pre-wrap" }}
                        dangerouslySetInnerHTML={convertirMarkdown(msg.content)}
                      />
                    ) : (
                      <div
                        className="p-2 rounded user-message"
                        style={{ maxWidth: "75%", whiteSpace: "pre-wrap" }}
                      >
                        {msg.content}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {isLoading && <div className="text-muted small mt-2">Escribiendo...</div>}
            <div ref={messagesEndRef} />
          </div>

          {!showHistory && (
            preguntaIndex >= 0 && preguntaIndex < preguntas.length ? (
              <div className="border-top p-3 d-flex flex-column gap-2 chat-input">
                {preguntas[preguntaIndex].opciones.map((op, idx) => (
                  <button
                    key={idx}
                    className="btn btn-outline-primary w-100"
                    onClick={() => handleOpcion(op)}
                  >
                    {op}
                  </button>
                ))}
              </div>
            ) : (
              <div className="border-top p-3 d-flex gap-2 chat-input">
                <input
                  type="text"
                  className="form-control bg-dark text-white border-secondary"
                  placeholder="Escribe tu mensaje..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  disabled={isLoading}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleSubmit()}
                  disabled={isLoading}
                >
                  Enviar
                </button>
              </div>
            )
          )}
        </div>

        <div className="col-3 d-flex flex-column position-relative p-4 options-panel">
          <h5>Opciones</h5>
          <ul className="list-group mt-3">
            <li className="list-group-item list-group-item-dark" onClick={nuevoChat} style={{ cursor: "pointer" }}>
              Nuevo chat
            </li>
            <li className="list-group-item list-group-item-dark" onClick={verHistorial} style={{ cursor: "pointer" }}>
              Ver historial de chats
            </li>
            <li className="list-group-item list-group-item-dark" onClick={() => navigate("/carreras")} style={{ cursor: "pointer" }}>
              Ver carreras
            </li>
            <li className="list-group-item list-group-item-dark" onClick={() => (window.location.href = "https://chatbot-f02ad.web.app/universidades")} style={{ cursor: "pointer" }}>
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
              <button className="btn btn-sm btn-outline-danger w-100" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
