package com.alshagroup.alshafacturas.gestion;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PlanesService {
  private final JdbcTemplate db;
  private final Clock clock;
  public static final ZoneId ZONA = ZoneId.of("America/Lima");
  public static final String VENCIDA =
      "Tu membresía ha vencido. Por favor realiza el pago para restablecer el servicio.";

  public PlanesService(JdbcTemplate db, Clock clock) {
    this.db = db;
    this.clock = clock;
  }

  public record Plan(String codigo, String nombre, int empleados, BigDecimal precio) {}

  public static final List<Plan> PLANES =
      List.of(
          new Plan("INICIO", "Administrador + 2 empleados", 2, new BigDecimal("35")),
          new Plan("EQUIPO", "Administrador + 3 empleados", 3, new BigDecimal("50")),
          new Plan("ILIMITADO", "Administrador + empleados ilimitados", -1, new BigDecimal("70")));

  public record PagoRequest(
      @NotBlank String plan,
      @NotNull BigDecimal importe,
      @NotNull LocalDate desde,
      @NotNull LocalDate hasta,
      @NotBlank @Size(max = 120) String referencia,
      @AssertTrue(message = "Confirma la recepción real del pago") boolean confirmado) {}

  private List<Map<String, Object>> pagos(String sql, Object... args) {
    var rows = db.queryForList(sql, args);
    for (var row : rows)
      for (String field : List.of("desde", "hasta"))
        if (row.get(field) instanceof java.sql.Date date) row.put(field, date.toLocalDate());
    return rows;
  }

  public LocalDate hoy() {
    return LocalDate.now(clock.withZone(ZONA));
  }

  public String instrucciones() {
    return db.queryForObject(
        "SELECT instrucciones FROM configuracion_cobranza WHERE id=1", String.class);
  }

  public Map<String, Object> bloqueo(Long empresa) {
    if (vigente(empresa) != null) return null;
    var pagos =
        pagos(
            "SELECT hasta,desde FROM pagos_suscripcion WHERE empresa_id=? ORDER BY hasta DESC LIMIT"
                + " 1",
            empresa);
    if (pagos.isEmpty()) return null; // Alta inicial del principal, aún sin contrato de pago.
    boolean vencida =
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM pagos_suscripcion WHERE empresa_id=? AND hasta<?)",
            Boolean.class,
            empresa,
            hoy());
    return Map.of(
        "codigo",
        vencida ? "MEMBRESIA_VENCIDA" : "MEMBRESIA_PROGRAMADA",
        "mensaje",
        vencida
            ? VENCIDA
            : "Tu membresía aún no inicia. Revisa la fecha de inicio del plan con la"
                + " administración.",
        "instruccionesPago",
        instrucciones());
  }

  @Transactional
  public void revisarEmpresa(Long empresa, LocalDate fecha) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
    boolean bloqueada =
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM pagos_suscripcion WHERE empresa_id=?) AND NOT"
                + " EXISTS(SELECT 1 FROM pagos_suscripcion WHERE empresa_id=? AND desde<=? AND"
                + " hasta>=?)",
            Boolean.class,
            empresa,
            empresa,
            fecha,
            fecha);
    db.update("UPDATE empresas SET suscripcion_bloqueada=? WHERE id=?", bloqueada, empresa);
    db.update(
        "UPDATE avisos_suscripcion a SET resuelto=true WHERE a.empresa_id=? AND EXISTS(SELECT 1"
            + " FROM pagos_suscripcion p WHERE p.empresa_id=a.empresa_id AND p.desde<=a.vence+1 AND"
            + " p.hasta>=a.vence+1)",
        empresa);
    db.update(
        "INSERT INTO avisos_suscripcion(empresa_id,pago_id,fecha,vence,dias_restantes) SELECT"
            + " p.empresa_id,p.id,?,p.hasta,p.hasta-? FROM pagos_suscripcion p WHERE p.empresa_id=?"
            + " AND p.hasta BETWEEN ? AND ? AND NOT EXISTS(SELECT 1 FROM"
            + " pagos_suscripcion r WHERE r.empresa_id=p.empresa_id AND r.desde<=p.hasta+1 AND"
            + " r.hasta>=p.hasta+1) ON CONFLICT DO NOTHING",
        fecha,
        fecha,
        empresa,
        fecha,
        fecha.plusDays(5));
  }

  public Long propietario(Long empresa) {
    return db.queryForObject(
        "SELECT administrador_principal_id FROM empresas WHERE id=?", Long.class, empresa);
  }

  public long empleados(Long empresa) {
    var owner = propietario(empresa);
    return db.queryForObject(
        "SELECT count(*) FROM usuarios WHERE empresa_id=? AND (activo=true OR"
            + " desactivado_en>CURRENT_TIMESTAMP-INTERVAL '15 days') AND id<>COALESCE(?,0)",
        Long.class,
        empresa,
        owner);
  }

  private Map<String, Object> vigente(Long empresa) {
    LocalDate today = hoy();
    var rows =
        pagos(
            "SELECT * FROM pagos_suscripcion WHERE empresa_id=? AND desde<=? AND hasta>=? ORDER BY"
                + " id DESC LIMIT 1",
            empresa,
            today,
            today);
    return rows.isEmpty() ? null : rows.getFirst();
  }

  private Plan plan(String codigo) {
    return PLANES.stream()
        .filter(p -> p.codigo().equals(codigo))
        .findFirst()
        .orElseThrow(() -> error("Plan no válido"));
  }

  public Map<String, Object> estado(Long empresa) {
    var pago = vigente(empresa);
    var proximos =
        pagos(
            "SELECT * FROM pagos_suscripcion WHERE empresa_id=? AND desde>? ORDER BY desde,id LIMIT"
                + " 1",
            empresa,
            hoy());
    var pasados =
        pagos(
            "SELECT * FROM pagos_suscripcion WHERE empresa_id=? AND hasta<? ORDER BY hasta DESC,id"
                + " DESC LIMIT 1",
            empresa,
            hoy());
    var proximo = proximos.isEmpty() ? null : proximos.getFirst();
    var ultimo = pasados.isEmpty() ? null : pasados.getFirst();
    var referencia = pago != null ? pago : proximo != null ? proximo : ultimo;
    long occupied = empleados(empresa);
    long active =
        db.queryForObject(
            "SELECT count(*) FROM usuarios WHERE empresa_id=? AND activo=true AND"
                + " id<>COALESCE(?,0)",
            Long.class,
            empresa,
            propietario(empresa));
    var result = new LinkedHashMap<String, Object>();
    result.put("propietarioId", propietario(empresa));
    result.put("empleadosActivos", active);
    result.put("cuposOcupados", occupied);
    result.put("cuposReservados", occupied - active);
    result.put("planes", PLANES);
    result.put("vigente", pago != null);
    result.put(
        "estadoSuscripcion",
        pago != null
            ? "ACTIVO"
            : ultimo != null ? "VENCIDO" : proximo != null ? "PROGRAMADO" : "SIN_PLAN");
    result.put("fechaActual", hoy());
    result.put("zonaHoraria", ZONA.toString());
    result.put("pagoReferencia", referencia);
    result.put("pagoProximo", proximo);
    result.put("instruccionesPago", instrucciones());
    result.put("bloqueado", pago == null && referencia != null);
    result.put("plan", referencia == null ? "SIN_PLAN" : referencia.get("plan"));
    result.put(
        "limiteEmpleados",
        referencia == null ? 0 : plan(referencia.get("plan").toString()).empleados());
    result.put("pagoActual", pago);
    result.put(
        "historial",
        pagos(
            "SELECT id,plan,importe,desde,hasta,referencia,creado FROM pagos_suscripcion WHERE"
                + " empresa_id=? ORDER BY id DESC LIMIT 100",
            empresa));
    return result;
  }

  public boolean permiteAcceso(Long empresa, Long user) {
    if (Objects.equals(propietario(empresa), user)) return bloqueo(empresa) == null;
    var pago = vigente(empresa);
    if (pago == null) return false;
    var plan = plan(pago.get("plan").toString());
    return plan.empleados() < 0 || empleados(empresa) <= plan.empleados();
  }

  public void validarCupo(Long empresa) {
    var pago = vigente(empresa);
    if (pago == null)
      throw error(
          "No hay un pago vigente registrado. El superadministrador debe confirmar el plan antes de"
              + " habilitar personal");
    var plan = plan(pago.get("plan").toString());
    if (plan.empleados() >= 0 && empleados(empresa) >= plan.empleados())
      throw error(
          "El plan permite "
              + plan.empleados()
              + " empleados además del administrador principal. Espera el vencimiento de una"
              + " reserva, elimina definitivamente una cuenta desactivada o cambia de plan");
  }

  public void validarReactivar(Long empresa, Long usuario) {
    if (java.util.Objects.equals(propietario(empresa), usuario)) return;
    var pago = vigente(empresa);
    if (pago == null) throw error("El negocio no tiene un plan vigente");
    var plan = plan(pago.get("plan").toString());
    long otros =
        db.queryForObject(
            "SELECT count(*) FROM usuarios WHERE empresa_id=? AND id<>? AND id<>COALESCE(?,0) AND"
                + " (activo OR desactivado_en>CURRENT_TIMESTAMP-INTERVAL '15 days')",
            Long.class,
            empresa,
            usuario,
            propietario(empresa));
    if (plan.empleados() >= 0 && otros >= plan.empleados())
      throw error("No hay cupos disponibles para reactivar esta cuenta");
  }

  @Transactional
  public Map<String, Object> registrar(Long empresa, Long actor, PagoRequest r) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
    var p = plan(r.plan());
    if (r.importe().compareTo(p.precio()) != 0 || r.hasta().isBefore(r.desde()))
      throw error("Revisa el importe del plan y las fechas de vigencia");
    if (p.empleados() >= 0 && empleados(empresa) > p.empleados())
      throw error(
          "Hay más empleados activos que cupos. Desactiva las cuentas sobrantes antes de asignar"
              + " este plan");
    if (db.queryForObject(
            "SELECT count(*) FROM pagos_suscripcion WHERE empresa_id=? AND desde<=? AND hasta>=?",
            Long.class,
            empresa,
            r.hasta(),
            r.desde())
        > 0) throw error("El período se superpone con otro pago registrado");
    db.update(
        "INSERT INTO"
            + " pagos_suscripcion(empresa_id,plan,importe,desde,hasta,referencia,registrado_por)"
            + " VALUES (?,?,?,?,?,?,?)",
        empresa,
        r.plan(),
        r.importe(),
        r.desde(),
        r.hasta(),
        r.referencia().trim(),
        actor);
    revisarEmpresa(empresa, hoy());
    return estado(empresa);
  }

  private ResponseStatusException error(String m) {
    return new ResponseStatusException(HttpStatus.CONFLICT, m);
  }
}
