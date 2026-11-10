export async function uploadImage(path: string, file: File) {
  const tokenResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    signal: AbortSignal.timeout(20000),
  });
  if (!tokenResponse.ok)
    throw new Error("No se pudo verificar la sesión para subir la foto.");
  const token = await tokenResponse.json();
  const response = await fetch("/api" + path + "/imagen", {
    method: "PUT",
    credentials: "same-origin",
    signal: AbortSignal.timeout(20000),
    headers: { [token.headerName]: token.token, "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.mensaje ||
        "No se pudo guardar la foto. El producto sí está guardado; vuelve a intentarlo.",
    );
  }
  return response.json() as Promise<{ imagen_version: string }>;
}
export async function prepareImage(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Elige una foto JPG, PNG o WebP de hasta 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("No se pudo preparar la foto.")),
        "image/jpeg",
        0.85,
      ),
    );
    return new File([blob], "producto.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
