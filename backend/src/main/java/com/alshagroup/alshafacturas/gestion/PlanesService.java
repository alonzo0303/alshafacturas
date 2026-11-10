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

  public PlanesService(JdbcTemplate db) {
    this.db = db;
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

  public Long propietario(Long empresa) {
    return db.queryForObject(
        "SELECT min(id) FROM usuarios WHERE empresa_id=? AND rol='ADMIN'", Long.class, empresa);
  }

  public long empleados(Long empresa) {
    var owner = propietario(empresa);
    return db.queryForObject(
        "SELECT count(*) FROM usuarios WHERE empresa_id=? AND activo=true AND id<>COALESCE(?,0)",
        Long.class,
        empresa,
        owner);
  }

  private Map<String, Object> vigente(Long empresa) {
    LocalDate today = LocalDate.now(ZoneId.of("America/Lima"));
    var rows =
        db.queryForList(
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
    long active = empleados(empresa);
    var result = new LinkedHashMap<String, Object>();
    result.put("propietarioId", propietario(empresa));
    result.put("empleadosActivos", active);
    result.put("planes", PLANES);
    result.put("vigente", pago != null);
    result.put("plan", pago == null ? "SIN_PLAN" : pago.get("plan"));
    result.put("limiteEmpleados", pago == null ? 0 : plan(pago.get("plan").toString()).empleados());
    result.put("pagoActual", pago);
    result.put(
        "historial",
        db.queryForList(
            "SELECT id,plan,importe,desde,hasta,referencia,creado FROM pagos_suscripcion WHERE"
                + " empresa_id=? ORDER BY id DESC LIMIT 100",
            empresa));
    return result;
  }

  public boolean permiteAcceso(Long empresa, Long user) {
    if (Objects.equals(propietario(empresa), user)) return true;
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
              + " empleados además del administrador principal. Desactiva una cuenta o cambia de"
              + " plan");
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
    return estado(empresa);
  }

  private ResponseStatusException error(String m) {
    return new ResponseStatusException(HttpStatus.CONFLICT, m);
  }
}
