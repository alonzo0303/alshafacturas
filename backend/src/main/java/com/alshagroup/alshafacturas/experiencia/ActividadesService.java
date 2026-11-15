package com.alshagroup.alshafacturas.experiencia;

import static com.alshagroup.alshafacturas.experiencia.ExperienciaDtos.*;

import com.alshagroup.alshafacturas.gestion.*;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ActividadesService {
  private final JdbcTemplate db;
  private final PerfilesService perfiles;
  private final ExperienciaScope scope;
  private final AuditoriaService audit;

  public ActividadesService(
      JdbcTemplate db, PerfilesService perfiles, ExperienciaScope scope, AuditoriaService audit) {
    this.db = db;
    this.perfiles = perfiles;
    this.scope = scope;
    this.audit = audit;
  }

  public Map<String, Object> salida(Map<String, Object> r) {
    var result = new LinkedHashMap<>(r);
    result.put(
        "flujo_definicion",
        perfiles.mapper().readValue(r.get("flujo_definicion").toString(), Flujo.class));
    result.remove("solicitud");
    result.remove("idempotencia");
    return result;
  }

  private Map<String, Object> fila(UsuarioPrincipal p, long e, long l, long id) {
    var rows =
        db.queryForList(
            "SELECT * FROM actividades WHERE empresa_id=? AND local_id=? AND id=? FOR UPDATE",
            e,
            l,
            id);
    if (rows.isEmpty()
        || !scope.equipo(p)
            && !Objects.equals(rows.getFirst().get("ejecutor_original_id"), p.getId()))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Actividad no encontrada");
    return rows.getFirst();
  }

  public List<Map<String, Object>> lista(UsuarioPrincipal p, long e, long l) {
    return db
        .queryForList(
            "SELECT * FROM actividades WHERE empresa_id=? AND local_id=? AND (? OR"
                + " ejecutor_original_id=?) ORDER BY id DESC LIMIT 200",
            e,
            l,
            scope.equipo(p),
            p.getId())
        .stream()
        .map(this::salida)
        .toList();
  }

  public List<Map<String, Object>> responsables(long e, long l) {
    return db.queryForList(
        "SELECT u.id,u.nombre FROM usuarios u WHERE u.empresa_id=? AND u.activo AND"
            + " u.rol<>'SUPERADMIN' AND (u.rol='ADMIN' OR EXISTS(SELECT 1 FROM usuario_locales ul"
            + " WHERE ul.usuario_id=u.id AND ul.local_id=?) OR (NOT EXISTS(SELECT 1 FROM"
            + " usuario_locales ul WHERE ul.usuario_id=u.id) AND ?=(SELECT min(id) FROM locales"
            + " WHERE empresa_id=u.empresa_id))) ORDER BY u.nombre,u.id",
        e,
        l,
        l);
  }

  private Map<String, Object> responsable(UsuarioPrincipal p, long e, long l, Long id) {
    long target = id == null ? p.getId() : id;
    if (!scope.equipo(p) && target != p.getId())
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Solo puedes registrar trabajo propio");
    return responsables(e, l).stream()
        .filter(u -> ((Number) u.get("id")).longValue() == target)
        .findFirst()
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "El responsable debe estar activo y tener acceso al local"));
  }

  private void evento(
      UsuarioPrincipal p,
      long e,
      long l,
      long id,
      int version,
      String tipo,
      String estado,
      String detalle) {
    db.update(
        "INSERT INTO"
            + " actividad_eventos(empresa_id,local_id,actividad_id,version,tipo,estado,actor_original_id,actor_nombre,detalle)"
            + " VALUES (?,?,?,?,?,?,?,?,?)",
        e,
        l,
        id,
        version,
        tipo,
        estado,
        p.getId(),
        p.getNombre(),
        detalle == null ? "" : detalle);
  }

  @Transactional
  public Map<String, Object> crear(UsuarioPrincipal p, long e, long l, NuevaActividad r) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, e);
    var target = responsable(p, e, l, r.ejecutorId());
    String request = perfiles.serial(r);
    var duplicate =
        db.queryForList(
            "SELECT * FROM actividades WHERE empresa_id=? AND local_id=? AND idempotencia=?",
            e,
            l,
            r.idempotencia());
    if (!duplicate.isEmpty()) {
      var row = fila(p, e, l, ((Number) duplicate.getFirst().get("id")).longValue());
      if (!perfiles
          .mapper()
          .readTree(row.get("solicitud").toString())
          .equals(perfiles.mapper().readTree(request)))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "La clave corresponde a otra actividad");
      return salida(row);
    }
    var config = perfiles.configuracion(e, l);
    var template = (Map<String, Object>) config.get("plantilla");
    var definition = (Definicion) template.get("definicion");
    var flujo =
        definition.flujos().stream()
            .filter(f -> f.codigo().equals(r.flujoCodigo()))
            .findFirst()
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Flujo no habilitado en el perfil del local"));
    if (r.servicioId() != null
        && db.queryForObject(
                "SELECT count(*) FROM productos WHERE empresa_id=? AND local_id=? AND id=? AND"
                    + " clase='SERVICIO' AND activo",
                Long.class,
                e,
                l,
                r.servicioId())
            != 1)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Servicio no disponible en el local");
    String state = flujo.etapas().getFirst().codigo();
    Long id =
        db.queryForObject(
            "INSERT INTO"
                + " actividades(empresa_id,local_id,plantilla_id,flujo_codigo,flujo_definicion,titulo,detalle,servicio_id,ejecutor_id,ejecutor_original_id,ejecutor_nombre,creador_original_id,creador_nombre,estado,idempotencia,solicitud)"
                + " VALUES (?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?,?,?,?::jsonb) RETURNING id",
            Long.class,
            e,
            l,
            template.get("id"),
            flujo.codigo(),
            perfiles.serial(flujo),
            r.titulo().trim(),
            r.detalle() == null ? "" : r.detalle().trim(),
            r.servicioId(),
            target.get("id"),
            target.get("id"),
            target.get("nombre"),
            p.getId(),
            p.getNombre(),
            state,
            r.idempotencia(),
            request);
    evento(p, e, l, id, 0, "CREADA", state, "");
    return salida(fila(p, e, l, id));
  }

  @Transactional
  public Map<String, Object> detalle(UsuarioPrincipal p, long e, long l, long id) {
    var result = salida(fila(p, e, l, id));
    result.put(
        "eventos",
        db.queryForList(
            "SELECT version,tipo,estado,actor_original_id,actor_nombre,ocurrido_en,detalle FROM"
                + " actividad_eventos WHERE actividad_id=? ORDER BY version",
            id));
    return result;
  }

  @Transactional
  public Map<String, Object> avanzar(UsuarioPrincipal p, long e, long l, long id, Paso r) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, e);
    var row = fila(p, e, l, id);
    int version = ((Number) row.get("version")).intValue();
    if (r.estado().equals(row.get("estado")) && version == r.version() + 1) return salida(row);
    if (version != r.version())
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "La actividad cambió. Recarga antes de continuar");
    if (Boolean.TRUE.equals(row.get("finalizada")) || Boolean.TRUE.equals(row.get("cancelada")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "La actividad ya está cerrada");
    var flow = perfiles.mapper().readValue(row.get("flujo_definicion").toString(), Flujo.class);
    var stages = flow.etapas().stream().map(Etapa::codigo).toList();
    boolean cancel = "CANCELADA".equals(r.estado());
    int current = stages.indexOf(row.get("estado").toString());
    if (cancel && (r.motivo() == null || r.motivo().isBlank()))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el motivo de cancelación");
    if (!cancel
        && (current < 0
            || current >= stages.size() - 1
            || !stages.get(current + 1).equals(r.estado())))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avanza una etapa a la vez");
    boolean end = !cancel && r.estado().equals(stages.getLast());
    db.update(
        "UPDATE actividades SET estado=?,version=version+1,iniciada=CASE WHEN ? AND iniciada IS"
            + " NULL THEN CURRENT_TIMESTAMP ELSE iniciada END,finalizada=?,completada=CASE WHEN ?"
            + " THEN CURRENT_TIMESTAMP ELSE NULL END,cancelada=?,cancelada_en=CASE WHEN ? THEN"
            + " CURRENT_TIMESTAMP ELSE NULL END WHERE id=?",
        r.estado(),
        !cancel,
        end,
        end,
        cancel,
        cancel,
        id);
    evento(
        p,
        e,
        l,
        id,
        version + 1,
        cancel ? "CANCELADA" : end ? "COMPLETADA" : "ETAPA_CAMBIADA",
        r.estado(),
        r.motivo());
    audit.registrar(
        p,
        e,
        l,
        "ACTIVIDAD_" + (cancel ? "CANCELADA" : end ? "COMPLETADA" : "AVANZADA"),
        id,
        r.estado());
    return salida(fila(p, e, l, id));
  }

  @Transactional
  public Map<String, Object> asignar(UsuarioPrincipal p, long e, long l, long id, Reasignar r) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, e);
    var row = fila(p, e, l, id);
    if (Boolean.TRUE.equals(row.get("finalizada"))
        || Boolean.TRUE.equals(row.get("cancelada"))
        || ((Number) row.get("version")).intValue() != r.version())
      throw new ResponseStatusException(HttpStatus.CONFLICT, "La actividad está cerrada o cambió");
    var target = responsable(p, e, l, r.ejecutorId());
    db.update(
        "UPDATE actividades SET"
            + " ejecutor_id=?,ejecutor_original_id=?,ejecutor_nombre=?,version=version+1 WHERE"
            + " id=?",
        target.get("id"),
        target.get("id"),
        target.get("nombre"),
        id);
    evento(
        p,
        e,
        l,
        id,
        r.version() + 1,
        "REASIGNADA",
        row.get("estado").toString(),
        "Responsable: " + target.get("nombre"));
    return salida(fila(p, e, l, id));
  }
}
