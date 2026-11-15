package com.alshagroup.alshafacturas.experiencia;

import static com.alshagroup.alshafacturas.experiencia.ExperienciaDtos.*;

import com.alshagroup.alshafacturas.gestion.*;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AvisosService {
  private final JdbcTemplate db;
  private final PerfilesService perfiles;
  private final ExperienciaScope scope;
  private final PlanesService planes;
  private final RolesService roles;
  private final AuditoriaService audit;

  public AvisosService(
      JdbcTemplate d,
      PerfilesService p,
      ExperienciaScope s,
      PlanesService ps,
      RolesService r,
      AuditoriaService a) {
    db = d;
    perfiles = p;
    scope = s;
    planes = ps;
    roles = r;
    audit = a;
  }

  private List<String> strings(Object value) {
    return perfiles.mapper().readValue(value.toString(), List.class);
  }

  private Map<String, Object> salida(Map<String, Object> row) {
    var r = new LinkedHashMap<>(row);
    for (String field : List.of("disparadores", "paginas", "roles"))
      r.put(field, strings(r.get(field)));
    r.remove("solicitud");
    r.remove("idempotencia");
    for (String field : List.of("desde", "hasta"))
      if (r.get(field) instanceof java.sql.Date date) r.put(field, date.toLocalDate());
    return r;
  }

  public List<Map<String, Object>> reglas(Long empresa) {
    return db
        .queryForList(
            "SELECT DISTINCT ON(familia) * FROM reglas_avisos WHERE empresa_id IS NULL OR"
                + " empresa_id=? ORDER BY familia,version DESC LIMIT 200",
            empresa)
        .stream()
        .map(this::salida)
        .toList();
  }

  private void variables(String s) {
    var match = java.util.regex.Pattern.compile("\\{\\{([^}]+)}}").matcher(s);
    while (match.find())
      if (!Set.of("fechaVencimiento", "diasRestantes", "instruccionesPago", "negocio")
          .contains(match.group(1)))
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Variable de mensaje no permitida");
  }

  @Transactional
  public Map<String, Object> publicar(UsuarioPrincipal p, Aviso r) {
    String request = perfiles.serial(r);
    var duplicate =
        db.queryForList("SELECT * FROM reglas_avisos WHERE idempotencia=?", r.idempotencia());
    if (!duplicate.isEmpty()) {
      if (!perfiles
          .mapper()
          .readTree(duplicate.getFirst().get("solicitud").toString())
          .equals(perfiles.mapper().readTree(request)))
        throw new ResponseStatusException(HttpStatus.CONFLICT, "La clave corresponde a otro aviso");
      return salida(duplicate.getFirst());
    }
    if (r.empresaId() != null) scope.empresa(p, r.empresaId());
    if (r.localId() != null) {
      if (r.empresaId() == null)
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Selecciona empresa para restringir un local");
      scope.validarLocal(r.empresaId(), r.localId());
    }
    if (r.desde() != null && r.hasta() != null && r.hasta().isBefore(r.desde()))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vigencia del aviso inválida");
    for (String role : r.roles())
      if (!Set.of("ADMIN", "VENDEDOR", "ALMACENERO", "COMPRAS", "PERSONAL").contains(role)
          && (r.empresaId() == null || !roles.existe(r.empresaId(), role)))
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Rol no disponible para el ámbito del aviso");
    variables(r.titulo());
    variables(r.mensaje());
    UUID perfil = null;
    if (r.plantillaId() != null)
      perfil =
          (UUID)
              perfiles
                  .plantilla(
                      r.plantillaId(), r.empresaId() == null ? p.getEmpresaId() : r.empresaId())
                  .get("familia");
    UUID familia = UUID.randomUUID();
    int version = 1;
    if (r.baseId() != null) {
      var previous =
          db.queryForList("SELECT * FROM reglas_avisos WHERE id=? FOR UPDATE", r.baseId());
      if (previous.isEmpty())
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aviso no encontrado");
      var old = previous.getFirst();
      if (!Objects.equals(old.get("empresa_id"), r.empresaId())
          || !Objects.equals(old.get("local_id"), r.localId()))
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Conserva el ámbito al versionar el aviso");
      familia = (UUID) old.get("familia");
      version =
          db.queryForObject(
              "SELECT max(version)+1 FROM reglas_avisos WHERE familia=?", Integer.class, familia);
      db.update("UPDATE reglas_avisos SET activa=false WHERE familia=?", familia);
    }
    Long id =
        db.queryForObject(
            "INSERT INTO"
                + " reglas_avisos(familia,version,empresa_id,local_id,perfil_familia,nombre,titulo,mensaje,disparadores,paginas,roles,condicion,frecuencia,prioridad,accion,activa,desde,hasta,solicitud,idempotencia)"
                + " VALUES (?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?,?,?,?,?,?,?,?::jsonb,?)"
                + " RETURNING id",
            Long.class,
            familia,
            version,
            r.empresaId(),
            r.localId(),
            perfil,
            r.nombre().trim(),
            r.titulo().trim(),
            r.mensaje().trim(),
            perfiles.serial(r.disparadores()),
            perfiles.serial(r.paginas()),
            perfiles.serial(r.roles()),
            r.condicion().name(),
            r.frecuencia().name(),
            r.prioridad(),
            r.accion().name(),
            r.activa(),
            r.desde(),
            r.hasta(),
            request,
            r.idempotencia());
    audit.registrar(
        p,
        r.empresaId() == null ? p.getEmpresaId() : r.empresaId(),
        r.localId(),
        "AVISO_PUBLICADO",
        id,
        "Versión " + version);
    return salida(db.queryForMap("SELECT * FROM reglas_avisos WHERE id=?", id));
  }

  public String sesion(String id) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(id.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private boolean permiso(UsuarioPrincipal p, String permission) {
    return p.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(permission));
  }

  @Transactional
  public Map<String, Object> reclamar(UsuarioPrincipal p, Solicitar request, String session) {
    var response = new LinkedHashMap<String, Object>();
    response.put("aviso", null);
    if (scope.root(p)) return response;
    long e = p.getEmpresaId(), l = LocalesService.actual();
    String hash = sesion(session);
    LocalDate today = planes.hoy();
    // Un solo aviso informativo por sesión. El bloqueo financiero sigue en el filtro de acceso.
    db.queryForObject("SELECT id FROM usuarios WHERE id=? FOR UPDATE", Long.class, p.getId());
    if (db.queryForObject(
            "SELECT count(*) FROM aviso_entregas WHERE empresa_id=? AND usuario_original_id=? AND"
                + " sesion_hash=? AND (estado<>'RESERVADO' OR"
                + " reservada_en>CURRENT_TIMESTAMP-INTERVAL '5 minutes')",
            Long.class,
            e,
            p.getId(),
            hash)
        > 0) return response;
    var config = perfiles.configuracion(e, l);
    var profile = (Map<String, Object>) config.get("plantilla");
    var state = planes.estado(e);
    var payment = (Map<String, Object>) state.get("pagoActual");
    LocalDate expires = payment == null ? null : LocalDate.parse(payment.get("hasta").toString());
    long remaining = expires == null ? Long.MAX_VALUE : ChronoUnit.DAYS.between(today, expires);
    String name =
        db.queryForObject("SELECT razon_social FROM empresas WHERE id=?", String.class, e);
    var candidates =
        db.queryForList(
            "SELECT * FROM reglas_avisos WHERE activa AND (empresa_id IS NULL OR empresa_id=?) AND"
                + " (local_id IS NULL OR local_id=?) AND (desde IS NULL OR desde<=?) AND (hasta IS"
                + " NULL OR hasta>=?) AND (perfil_familia IS NULL OR perfil_familia=?) ORDER BY"
                + " prioridad DESC,id",
            e,
            l,
            today,
            today,
            profile.get("familia"));
    for (var rule : candidates) {
      if (!strings(rule.get("disparadores")).contains(request.trigger().name())) continue;
      var pages = strings(rule.get("paginas"));
      if (request.trigger() != Trigger.POST_LOGIN
          && !pages.isEmpty()
          && !pages.contains(request.pagina().name())) continue;
      var allowedRoles = strings(rule.get("roles"));
      if (!allowedRoles.isEmpty()
          && !allowedRoles.contains(p.getRol())
          && !(allowedRoles.contains("PERSONAL") && !"ADMIN".equals(p.getRol()))) continue;
      if ("SUSCRIPCION_POR_VENCER".equals(rule.get("condicion"))
          && (remaining < 0
              || remaining > 5
              || Boolean.FALSE.equals(state.get("vigente"))
              || Boolean.TRUE.equals(
                  db.queryForObject(
                      "SELECT EXISTS(SELECT 1 FROM pagos_suscripcion WHERE empresa_id=? AND"
                          + " desde<=? AND hasta>=?)",
                      Boolean.class,
                      e,
                      expires.plusDays(1),
                      expires.plusDays(1))))) continue;
      String frequency = rule.get("frecuencia").toString(),
          key =
              switch (frequency) {
                case "DIA" -> "D:" + today;
                case "SESION" -> "S:" + hash;
                default -> "V:" + rule.get("version");
              };
      var delivered =
          db.queryForList(
              "INSERT INTO"
                  + " aviso_entregas(regla_id,regla_familia,empresa_id,local_id,usuario_id,usuario_original_id,clave_frecuencia,sesion_hash,estado)"
                  + " VALUES (?,?,?,?,?,?,?,?,'RESERVADO') ON"
                  + " CONFLICT(regla_familia,empresa_id,usuario_original_id,clave_frecuencia) DO"
                  + " UPDATE SET"
                  + " regla_id=EXCLUDED.regla_id,local_id=EXCLUDED.local_id,sesion_hash=EXCLUDED.sesion_hash,reservada_en=CURRENT_TIMESTAMP"
                  + " WHERE aviso_entregas.estado='RESERVADO' AND"
                  + " aviso_entregas.reservada_en<=CURRENT_TIMESTAMP-INTERVAL '5 minutes' RETURNING"
                  + " id",
              rule.get("id"),
              rule.get("familia"),
              e,
              l,
              p.getId(),
              p.getId(),
              key,
              hash);
      if (delivered.isEmpty()) continue;
      String
          title =
              render(
                  rule.get("titulo").toString(),
                  expires,
                  remaining,
                  state.get("instruccionesPago").toString(),
                  name),
          body =
              render(
                  rule.get("mensaje").toString(),
                  expires,
                  remaining,
                  state.get("instruccionesPago").toString(),
                  name);
      String action = rule.get("accion").toString();
      if (action.equals("VER_RENDIMIENTO") && !permiso(p, "RENDIMIENTO_VER")
          || action.equals("VER_ACTIVIDADES") && !permiso(p, "ACTIVIDADES_GESTIONAR"))
        action = "CERRAR";
      response.put(
          "aviso",
          Map.of(
              "entregaId",
              delivered.getFirst().get("id"),
              "titulo",
              title,
              "mensaje",
              body,
              "accion",
              action,
              "prioridad",
              rule.get("prioridad"),
              "version",
              rule.get("version")));
      break;
    }
    return response;
  }

  private String render(
      String value, LocalDate expires, long days, String instructions, String negocio) {
    return value
        .replace(
            "{{fechaVencimiento}}",
            expires == null
                ? "sin plan registrado"
                : expires.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")))
        .replace("{{diasRestantes}}", expires == null ? "sin vigencia" : Long.toString(days))
        .replace("{{instruccionesPago}}", instructions)
        .replace("{{negocio}}", negocio);
  }

  @Transactional
  public void responder(UsuarioPrincipal p, UUID id, Respuesta r, String session) {
    var rows =
        db.queryForList(
            "SELECT * FROM aviso_entregas WHERE id=? AND empresa_id=? AND usuario_original_id=? AND"
                + " sesion_hash=? FOR UPDATE",
            id,
            p.getEmpresaId(),
            p.getId(),
            sesion(session));
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Entrega de aviso no encontrada");
    String old = rows.getFirst().get("estado").toString();
    if (Set.of("CERRADO", "ACEPTADO", "ACCION").contains(old)) return;
    if ("LIBERAR".equals(r.estado())) {
      if ("RESERVADO".equals(old))
        db.update(
            "UPDATE aviso_entregas SET reservada_en=CURRENT_TIMESTAMP-INTERVAL '5 minutes' WHERE"
                + " id=?",
            id);
      return;
    }
    db.update(
        "UPDATE aviso_entregas SET"
            + " estado=?,mostrado_en=COALESCE(mostrado_en,CURRENT_TIMESTAMP),respondido_en=CASE"
            + " WHEN ?='MOSTRADO' THEN respondido_en ELSE CURRENT_TIMESTAMP END WHERE id=?",
        r.estado(),
        r.estado(),
        id);
  }
}
