// Carreras.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ososImage from "../assets/ososbuscando-sinfondo.png";
import { carreras } from "./infocarreras";
import "./Carreras.css";

const CarreraCard = ({ carrera }) => {
  return (
    <article className="carrera-card" tabIndex={0} aria-label={`Carrera: ${carrera.nombre}`}>
      <img
        src={carrera.imagen}
        alt={`Imagen de la carrera ${carrera.nombre}`}
        className="carrera-card__image"
        loading="lazy"
        onError={(e) => e.target.src = "/default-image.png"} // fallback imagen si hay error
      />
      <div className="carrera-card__content">
        <h2 className="carrera-card__title">{carrera.nombre}</h2>
        <p className="carrera-card__duration">
          <strong>Duración:</strong> {carrera.duracion}
        </p>
        <p className="carrera-card__description">{carrera.descripcion}</p>
        <p className="carrera-card__universities">
          <strong>Universidades:</strong> {carrera.universidades.join(", ")}
        </p>
        <button
          className="carrera-card__btn-info"
          onClick={() => window.open(carrera.urlSenescyt, "_blank")}
          disabled={!carrera.urlSenescyt}
          aria-disabled={!carrera.urlSenescyt}
          title={carrera.urlSenescyt ? "Abrir página SENESCYT" : "Información no disponible"}
        >
          Más información
        </button>
      </div>
    </article>
  );
};

const Carreras = () => {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState("");

  const carrerasFiltradas = carreras.filter((carrera) =>
    carrera.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="carreras-app">
      <header className="carreras-header">
        <img src={ososImage} alt="Oso buscando" className="carreras-header__logo" />
        <h1 className="carreras-header__title">Carreras Universitarias en Ecuador</h1>
      </header>

      <main className="carreras-main">
        <section className="carreras-search">
          <label htmlFor="busqueda" className="carreras-search__label">
            Buscar carrera
          </label>
          <div className="carreras-search__input-wrapper">
            <input
              id="busqueda"
              type="search"
              placeholder=" Busca una carrera..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="carreras-search__input"
              autoFocus
              aria-label="Buscar carrera"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </section>

        <section className="carreras-list" aria-live="polite" aria-atomic="true">
          {carrerasFiltradas.length === 0 ? (
            <p className="carreras-no-results">No se encontraron resultados.</p>
          ) : (
            carrerasFiltradas.map((carrera) => (
              <CarreraCard key={carrera.nombre} carrera={carrera} />
            ))
          )}
        </section>
      </main>

      <footer className="carreras-footer">
        <button className="carreras-footer__btn-back" onClick={() => navigate("/chat")}>
          ← Volver al chat
        </button>
      </footer>
    </div>
  );
};

export default Carreras;
