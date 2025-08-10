import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";
import "../styles/universidades.css";
import universidades from "../components/listaUniversidades";

const mapContainerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.5, lng: -78 };
const defaultZoom = 6.2;

const Universidades = () => {
  const navigate = useNavigate();
  const [selectedUniversidad, setSelectedUniversidad] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const mapRef = useRef(null);

  // Cargar Google Maps con tu API Key
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: "", // AIzaSyDAJ5leFgEmPStYDXVik2fH40TjQOzLcdk
  });

  const handleVolver = () => {
    navigate("/chat");
  };

  // Pedir ubicación actual al cargar
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("No se pudo obtener ubicación:", err);
          setUserLocation(null);
        }
      );
    } else {
      console.warn("Geolocalización no soportada");
      setUserLocation(null);
    }
  }, []);

  // Filtrar universidades por nombre
  const universidadesFiltradas = universidades.filter((u) =>
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Guardar referencia del mapa
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Centrar mapa al seleccionar universidad
  useEffect(() => {
    if (selectedUniversidad && mapRef.current) {
      mapRef.current.panTo({
        lat: selectedUniversidad.lat,
        lng: selectedUniversidad.lng,
      });
      mapRef.current.setZoom(14);
    }
  }, [selectedUniversidad]);

  if (loadError) return <div>Error al cargar el mapa</div>;
  if (!isLoaded) return <div>Cargando mapa...</div>;

  return (
    <div className="universidades-layout">
      <div className="mapa-section">
        <h2 className="map-title">Universidades del Ecuador</h2>
        <div className="map-box" style={{ height: "500px" }}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={defaultZoom}
            center={userLocation || defaultCenter}
            onLoad={onMapLoad}
          >
            {/* Marcador ubicación usuario */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                }}
                title="Tu ubicación"
              />
            )}

            {/* Marcadores universidades */}
            {universidadesFiltradas.map((u, i) => (
              <Marker
                key={i}
                position={{ lat: u.lat, lng: u.lng }}
                onClick={() => setSelectedUniversidad(u)}
              />
            ))}

            {/* InfoWindow universidad seleccionada */}
            {selectedUniversidad && (
              <InfoWindow
                position={{ lat: selectedUniversidad.lat, lng: selectedUniversidad.lng }}
                onCloseClick={() => setSelectedUniversidad(null)}
              >
                <div>
                  <h3>{selectedUniversidad.nombre}</h3>
                  <p>{selectedUniversidad.ciudad}</p>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>

      <div className="info-container">
        {selectedUniversidad ? (
          <div>
            <h2>{selectedUniversidad.nombre}</h2>
            <p><strong>Ciudad:</strong> {selectedUniversidad.ciudad}</p>
            <p><strong>Tipo:</strong> {selectedUniversidad.tipo}</p>
            <p><strong>Descripción:</strong> {selectedUniversidad.descripcion}</p>
            <p><strong>Año de fundación:</strong> {selectedUniversidad.fundacion || "No disponible"}</p>
            <p><strong>Estudiantes:</strong> {selectedUniversidad.estudiantes ? selectedUniversidad.estudiantes.toLocaleString() : "No disponible"}</p>
            {selectedUniversidad.principalesCarreras && (
              <p><strong>Principales carreras:</strong> {selectedUniversidad.principalesCarreras.join(", ")}</p>
            )}
            {selectedUniversidad.sitioWeb && (
              <p>
                <strong>Sitio web:</strong>{" "}
                <a href={selectedUniversidad.sitioWeb} target="_blank" rel="noopener noreferrer">
                  {selectedUniversidad.sitioWeb}
                </a>
              </p>
            )}
          </div>
        ) : (
          <>
            <h2>Universidades del Ecuador</h2>
            <input
              type="text"
              placeholder="Buscar universidad..."
              className="buscar-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <p>Selecciona una universidad en el mapa o la lista para ver más detalles.</p>
            <ul>
              {universidadesFiltradas.map((u, i) => (
                <li
                  key={i}
                  className="universidad-item"
                  onClick={() => setSelectedUniversidad(u)}
                  style={{ cursor: "pointer" }}
                >
                  {u.nombre}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <button className="btn-volver-fixed" onClick={handleVolver}>
        ← Volver al Chat
      </button>
    </div>
  );
};

export default Universidades;
