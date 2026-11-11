import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type Session } from "../lib/api";
import { Field, ErrorNotice } from "../components/ui";
export default function Login({
  onLogin,
  admin = false,
}: {
  onLogin: (session: Session) => void;
  admin?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      onLogin(
        await api<Session>(
          admin ? "/auth/admin/login" : "/auth/login",
          "POST",
          {
            ruc: data.get("ruc") || null,
            empresaId: data.get("empresaId")
              ? Number(data.get("empresaId"))
              : null,
            correo: data.get("correo"),
            password: data.get("password"),
          },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-brand">
        <span className="wordmark">
          ALSHA<span>FACTURAS</span>
        </span>
        <p>Inventario, ventas y control de tu negocio.</p>
      </div>
      <section className="login-card">
        <p className="eyebrow">
          {admin ? "Administración de plataforma" : "Acceso empresarial"}
        </p>
        <h1>Inicia sesión</h1>
        <p>
          {admin
            ? "Gestiona las empresas de AlshaFacturas."
            : "Ingresa con tu correo y contraseña. No necesitas RUC."}
        </p>
        <form className="form" onSubmit={submit}>
          <ErrorNotice message={error} />
          <Field label="Correo electrónico">
            <input
              name="correo"
              type="email"
              required
              autoComplete="username"
            />
          </Field>
          <Field label="Contraseña">
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>
          {!admin && (
            <details>
              <summary>¿Tu correo pertenece a varios negocios?</summary>
              <p className="hint">
                Indica uno de estos datos solo si necesitas identificar tu
                negocio.
              </p>
              <Field label="Código de negocio (opcional)">
                <input name="empresaId" type="number" min="1" step="1" />
              </Field>
              <Field label="RUC de la empresa (opcional)">
                <input
                  name="ruc"
                  inputMode="numeric"
                  pattern="[0-9]{11}"
                  maxLength={11}
                />
              </Field>
            </details>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Verificando…" : "Iniciar sesión"}
          </button>
        </form>
        <Link to={admin ? "/login" : "/admin/login"}>
          {admin ? "Acceso empresarial" : "Administración de plataforma"}
        </Link>
      </section>
      <p className="login-footer">Alsha Group · Gestión empresarial</p>
    </main>
  );
}
