package com.alshagroup.alshafacturas.gestion;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.ChronoUnit;
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
          new Plan("INICIO", "Jefe del negocio + 1 usuario", 1, new BigDecimal("30")),
          new Plan("EQUIPO", "Jefe del negocio + 2 usuarios", 2, new BigDecimal("45")),
          new Plan(
              "ILIMITADO", "Jefe del negocio + usuarios ilimitados", -1, new BigDecimal("60")));

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

  public Map<String, Object> recordatorio(Long empresa) {
    var pago = vigente(empresa);
    var result = new LinkedHashMap<String, Object>();
    LocalDate vence = pago == null ? null : (LocalDate) pago.get("hasta");
    boolean renovado =
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM pagos_suscripcion WHERE empresa_id=? AND desde<=? AND"
                + " hasta>=?)",
            Boolean.class,
            empresa,
            hoy().plusDays(1),
            hoy().plusDays(1));
    result.put("venceHoy", hoy().equals(vence) && !renovado);
    result.put("vence", vence);
    result.put("fechaActual", hoy());
    result.put("instruccionesPago", instrucciones());
    return result;
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
    if (rows.isEmpty()) return null;
    var pago = rows.getFirst();
    var upgrades =
        pagos(
            "SELECT * FROM upgrades_suscripcion WHERE empresa_id=? AND pago_id=? AND desde<=? AND"
                + " hasta>=? ORDER BY id DESC LIMIT 1",
            empresa,
            pago.get("id"),
            today,
            today);
    pago.put("tarifa_actual", pago.get("importe"));
    if (!upgrades.isEmpty()) {
      var u = upgrades.getFirst();
      pago.put("plan", u.get("plan"));
      pago.put("limite_empleados", u.get("limite_empleados"));
      pago.put("tarifa_actual", u.get("tarifa"));
    }
    return pago;
  }

  private int limite(Map<String, Object> pago) {
    return ((Number) pago.get("limite_empleados")).intValue();
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
    result.put("limiteEmpleados", referencia == null ? 0 : limite(referencia));
    result.put("pagoActual", pago);
    result.put(
        "upgrades",
        pagos(
            "SELECT id,pago_id,plan_anterior,plan,importe,tarifa,desde,hasta,referencia,creado FROM"
                + " upgrades_suscripcion WHERE empresa_id=? ORDER BY id DESC",
            empresa));
    result.put(
        "historial",
        pagos(
            "SELECT id,plan,importe,limite_empleados,desde,hasta,referencia,creado FROM"
                + " pagos_suscripcion WHERE empresa_id=? ORDER BY id DESC LIMIT 100",
            empresa));
    return result;
  }

  public boolean permiteAcceso(Long empresa, Long user) {
    if (Objects.equals(propietario(empresa), user)) return bloqueo(empresa) == null;
    var pago = vigente(empresa);
    if (pago == null) return false;
    int limite = limite(pago);
    return limite < 0 || empleados(empresa) <= limite;
  }

  public void validarCupo(Long empresa) {
    var pago = vigente(empresa);
    if (pago == null)
      throw error(
          "No hay un pago vigente registrado. El superadministrador debe confirmar el plan antes de"
              + " habilitar personal");
    int limite = limite(pago);
    if (limite >= 0 && empleados(empresa) >= limite)
      throw error(
          "El plan permite "
              + limite
              + " empleados además del administrador principal. Espera el vencimiento de una"
              + " reserva, elimina definitivamente una cuenta desactivada o cambia de plan");
  }

  public void validarReactivar(Long empresa, Long usuario) {
    if (java.util.Objects.equals(propietario(empresa), usuario)) return;
    var pago = vigente(empresa);
    if (pago == null) throw error("El negocio no tiene un plan vigente");
    int limite = limite(pago);
    long otros =
        db.queryForObject(
            "SELECT count(*) FROM usuarios WHERE empresa_id=? AND id<>? AND id<>COALESCE(?,0) AND"
                + " (activo OR desactivado_en>CURRENT_TIMESTAMP-INTERVAL '15 days')",
            Long.class,
            empresa,
            usuario,
            propietario(empresa));
    if (limite >= 0 && otros >= limite)
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
            + " pagos_suscripcion(empresa_id,plan,importe,desde,hasta,referencia,registrado_por,limite_empleados)"
            + " VALUES (?,?,?,?,?,?,?,?)",
        empresa,
        r.plan(),
        r.importe(),
        r.desde(),
        r.hasta(),
        r.referencia().trim(),
        actor,
        p.empleados());
    revisarEmpresa(empresa, hoy());
    return estado(empresa);
  }

  public record UpgradeRequest(
      @NotBlank String plan,
      @NotNull Long pagoId,
      @NotBlank String planAnterior,
      @NotNull LocalDate fecha,
      @NotNull BigDecimal importe,
      @NotBlank @Size(max = 120) String referencia,
      @AssertTrue boolean confirmado,
      @NotNull UUID idempotencia) {}

  public Map<String, Object> cotizarUpgrade(Long empresa, String codigo) {
    var actual = vigente(empresa);
    if (actual == null) throw error("Se necesita un plan vigente para aplicar un upgrade");
    var nuevo = plan(codigo);
    BigDecimal anterior = (BigDecimal) actual.get("tarifa_actual");
    if (nuevo.precio().compareTo(anterior) <= 0)
      throw error("Selecciona un plan superior al actual");
    LocalDate inicio = (LocalDate) actual.get("desde"), fin = (LocalDate) actual.get("hasta");
    long dias = ChronoUnit.DAYS.between(inicio, fin) + 1,
        restantes = ChronoUnit.DAYS.between(hoy(), fin) + 1;
    BigDecimal importe =
        nuevo
            .precio()
            .subtract(anterior)
            .multiply(BigDecimal.valueOf(restantes))
            .divide(BigDecimal.valueOf(dias), 2, RoundingMode.HALF_UP);
    return Map.of(
        "pagoId",
        actual.get("id"),
        "planAnterior",
        actual.get("plan"),
        "plan",
        codigo,
        "fecha",
        hoy(),
        "hasta",
        fin,
        "diasCiclo",
        dias,
        "diasRestantes",
        restantes,
        "importe",
        importe);
  }

  @Transactional
  public Map<String, Object> upgrade(Long empresa, Long actor, UpgradeRequest r) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
    var old =
        db.queryForList(
            "SELECT * FROM upgrades_suscripcion WHERE empresa_id=? AND idempotencia=?",
            empresa,
            r.idempotencia());
    if (!old.isEmpty()) {
      var u = old.getFirst();
      if (!Objects.equals(u.get("pago_id"), r.pagoId())
          || !Objects.equals(u.get("plan"), r.plan())
          || !Objects.equals(u.get("referencia"), r.referencia().trim())
          || ((BigDecimal) u.get("importe")).compareTo(r.importe()) != 0)
        throw error("La clave corresponde a otro upgrade");
      return estado(empresa);
    }
    var q = cotizarUpgrade(empresa, r.plan());
    if (!hoy().equals(r.fecha())
        || !Objects.equals(q.get("pagoId"), r.pagoId())
        || !Objects.equals(q.get("planAnterior"), r.planAnterior())
        || ((BigDecimal) q.get("importe")).compareTo(r.importe()) != 0)
      throw error("La cotización cambió. Vuelve a calcular antes de confirmar");
    if (db.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM pagos_suscripcion WHERE empresa_id=? AND referencia=?) OR"
            + " EXISTS(SELECT 1 FROM upgrades_suscripcion WHERE empresa_id=? AND referencia=?)",
        Boolean.class,
        empresa,
        r.referencia().trim(),
        empresa,
        r.referencia().trim())) throw error("La referencia ya está registrada");
    var nuevo = plan(r.plan());
    db.update(
        "INSERT INTO"
            + " upgrades_suscripcion(empresa_id,pago_id,plan_anterior,plan,limite_empleados,tarifa,importe,desde,hasta,referencia,registrado_por,idempotencia)"
            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        empresa,
        r.pagoId(),
        r.planAnterior(),
        r.plan(),
        nuevo.empleados(),
        nuevo.precio(),
        r.importe(),
        hoy(),
        q.get("hasta"),
        r.referencia().trim(),
        actor,
        r.idempotencia());
    revisarEmpresa(empresa, hoy());
    return estado(empresa);
  }

  private ResponseStatusException error(String m) {
    return new ResponseStatusException(HttpStatus.CONFLICT, m);
  }
}
