import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Field, ErrorNotice } from "./ui";
export default function BarcodeScanner({
  value,
  onChange,
  onScan,
  label = "Buscar por nombre, SKU o código de barras",
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  onScan: (value: string) => void;
  label?: string;
  name?: string;
}) {
  const [camera, setCamera] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null),
    active = useRef(false);
  useEffect(() => {
    const state = active;
    state.current = true;
    return () => {
      state.current = false;
      controls.current?.stop();
      controls.current = null;
    };
  }, []);
  function stop() {
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject;
    if (stream instanceof MediaStream)
      stream.getTracks().forEach((t) => t.stop());
    setCamera(false);
    setBusy(false);
  }
  function accept(code: string) {
    const text = code.trim();
    if (!text) return;
    onChange(text);
    onScan(text);
  }
  async function start() {
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setError(
        "La cámara en vivo necesita HTTPS o localhost. Puedes escanear una foto o usar un lector USB/Bluetooth.",
      );
      return;
    }
    setCamera(true);
    setBusy(true);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const handle = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        video.current!,
        (result, _error, c) => {
          if (result && active.current) {
            c.stop();
            stop();
            accept(result.getText());
          }
        },
      );
      if (!active.current) {
        handle.stop();
        return;
      }
      controls.current = handle;
      setBusy(false);
    } catch {
      if (active.current) {
        stop();
        setError(
          "No se pudo abrir la cámara. Revisa sus permisos o escanea una foto.",
        );
      }
    }
  }
  async function photo(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError("La imagen debe pesar menos de 20 MB.");
      return;
    }
    stop();
    setError("");
    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(
        url,
      );
      if (active.current) accept(result.getText());
    } catch {
      if (active.current)
        setError(
          "No se encontró un código legible en la foto. Acércalo y evita reflejos.",
        );
    } finally {
      URL.revokeObjectURL(url);
      if (active.current) setBusy(false);
    }
  }
  return (
    <div className="scanner">
      <ErrorNotice message={error} />
      <div className="scanner-input">
        <Field label={label}>
          <input
            name={name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                accept(value);
              }
            }}
            autoComplete="off"
          />
        </Field>
        <button type="button" onClick={() => accept(value)}>
          Buscar código
        </button>
      </div>
      <div className="scanner-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => (camera ? stop() : void start())}
        >
          {camera ? "Detener cámara" : "Escanear con cámara"}
        </button>
        <label className="file-scan">
          Escanear foto
          <input
            aria-label="Imagen de código de barras"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            onChange={(e) => {
              void photo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <video
        ref={video}
        className="camera-preview"
        muted
        playsInline
        hidden={!camera}
      />
      {busy && <p role="status">Preparando lectura…</p>}
      <small>
        También puedes usar un lector USB o Bluetooth: enfoca el campo y
        escanea. Las imágenes se procesan en este dispositivo.
      </small>
    </div>
  );
}
