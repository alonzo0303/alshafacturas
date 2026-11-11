import { useEffect, useState } from "react";
import { prepareImage } from "../lib/images";
import { ErrorNotice, Field } from "./ui";
export function ProductImage({
  id,
  version,
  common = false,
  name,
  className = "product-photo",
}: {
  id: number;
  version?: string | null;
  common?: boolean;
  name: string;
  className?: string;
}) {
  const [failedVersion, setFailedVersion] = useState<string | null>(null);
  return version && failedVersion !== version ? (
    <img
      className={className}
      src={`/api/${common ? "catalogo-comun" : "productos"}/${id}/imagen?v=${encodeURIComponent(version)}`}
      alt={name}
      loading="lazy"
      onError={() => setFailedVersion(version)}
    />
  ) : (
    <span
      className={`${className} photo-placeholder`}
      aria-label={`Sin foto de ${name}`}
    >
      Sin foto
    </span>
  );
}
export function ImageEditor({
  initialUrl,
  onChange,
  disabled = false,
  onBusyChange,
}: {
  initialUrl?: string;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState(initialUrl || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [blob, setBlob] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (blob) URL.revokeObjectURL(blob);
    },
    [blob],
  );
  return (
    <div className="image-editor">
      <ErrorNotice message={error} />
      {preview && (
        <img
          src={preview}
          alt="Vista previa de la foto del producto"
          className="product-photo"
        />
      )}
      <Field label="Foto del producto (opcional)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            onBusyChange?.(true);
            setError("");
            try {
              const photo = await prepareImage(file);
              const url = URL.createObjectURL(photo);
              setBlob(url);
              setPreview(url);
              onChange(photo);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              onBusyChange?.(false);
            }
          }}
        />
      </Field>
      {preview && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => {
            setPreview("");
            setBlob(null);
            onChange(null);
          }}
        >
          Quitar foto
        </button>
      )}
      <small>
        {busy
          ? "Preparando foto…"
          : "JPG, PNG o WebP, hasta 10 MB. Elegir la foto solo muestra una vista previa; se guarda al confirmar el formulario."}
      </small>
    </div>
  );
}
