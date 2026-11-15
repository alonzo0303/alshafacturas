export type Bloqueo = {
  codigo: string;
  mensaje: string;
  instruccionesPago: string;
};
export default function BloqueoMembresia({
  data,
  onClose,
}: {
  data: Bloqueo;
  onClose: () => void;
}) {
  return (
    <main className="login-page">
      <section className="login-card subscription-lock">
        <p className="eyebrow">AlshaFacturas · Membresía</p>
        <h1>
          {data.codigo === "MEMBRESIA_VENCIDA"
            ? "Membresía vencida"
            : "Membresía programada"}
        </h1>
        <p role="alert">{data.mensaje}</p>
        <h2>Cómo restablecer el servicio</h2>
        <p className="payment-instructions">{data.instruccionesPago}</p>
        <p>
          Cuando la plataforma confirme un pago vigente, podrás iniciar sesión
          nuevamente. Tus datos se conservan.
        </p>
        <button className="primary" onClick={onClose}>
          Volver al acceso
        </button>
      </section>
    </main>
  );
}
