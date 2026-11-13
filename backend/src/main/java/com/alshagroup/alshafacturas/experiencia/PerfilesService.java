package com.alshagroup.alshafacturas.experiencia;

import static com.alshagroup.alshafacturas.experiencia.ExperienciaDtos.*;

import com.alshagroup.alshafacturas.gestion.AuditoriaService;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PerfilesService {
  private final tools.jackson.databind.json.JsonMapper json =
      tools.jackson.databind.json.JsonMapper.builder().build();
  private final JdbcTemplate db;
  private final AuditoriaService audit;

  public PerfilesService(JdbcTemplate db, AuditoriaService audit) {
    this.db = db;
    this.audit = audit;
  }

  public tools.jackson.databind.json.JsonMapper mapper() {
    return json;
  }

  public String serial(Object value) {
    return json.writeValueAsString(value);
  }

  public Definicion definicion(Map<String, Object> row) {
    return json.readValue(row.get("definicion").toString(), Definicion.class);
  }

  public Map<String, Object> plantilla(long id, long empresa) {
    var rows =
        db.queryForList(
            "SELECT * FROM rendimiento_plantillas WHERE id=? AND (empresa_propietaria_id IS NULL OR"
                + " empresa_propietaria_id=?)",
            id,
            empresa);
    if (rows.isEmpty())
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Plantilla no disponible para el negocio");
    return rows.getFirst();
  }

  public Map<String, Object> salida(Map<String, Object> row) {
    var result = new LinkedHashMap<>(row);
    result.put("definicion", definicion(row));
    result.remove("solicitud");
    result.remove("idempotencia");
    return result;
  }

  public List<Map<String, Object>> listar(Long empresa) {
    return db
        .queryForList(
            "SELECT * FROM rendimiento_plantillas WHERE empresa_propietaria_id IS NULL OR"
                + " empresa_propietaria_id=? ORDER BY nombre,version DESC",
            empresa)
        .stream()
        .map(this::salida)
        .toList();
  }

  public Map<String, Object> configuracion(long empresa, long local) {
    var rows =
        db.queryForList(
            "SELECT * FROM rendimiento_asignaciones WHERE empresa_id=? AND (local_id=? OR local_id"
                + " IS NULL) ORDER BY local_id NULLS LAST LIMIT 1",
            empresa,
            local);
    long id =
        rows.isEmpty()
            ? db.queryForObject(
                "SELECT id FROM rendimiento_plantillas WHERE codigo='GENERAL' AND tipo='BASE' AND"
                    + " version=1 AND empresa_propietaria_id IS NULL",
                Long.class)
            : ((Number) rows.getFirst().get("plantilla_id")).longValue();
    return Map.of(
        "empresaId",
        empresa,
        "localId",
        local,
        "modo",
        rows.isEmpty() ? "GENERAL" : rows.getFirst().get("modo"),
        "heredado",
        rows.isEmpty() || rows.getFirst().get("local_id") == null,
        "plantilla",
        salida(plantilla(id, empresa)));
  }

  @Transactional
  public Map<String, Object> publicar(UsuarioPrincipal p, Plantilla r) {
    String request = serial(r);
    var duplicate =
        db.queryForList(
            "SELECT * FROM rendimiento_plantillas WHERE idempotencia=?", r.idempotencia());
    if (!duplicate.isEmpty()) {
      if (!json.readTree(duplicate.getFirst().get("solicitud").toString())
          .equals(json.readTree(request)))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "La clave corresponde a otra publicación");
      return salida(duplicate.getFirst());
    }
    validar(r.definicion());
    UUID familia = UUID.randomUUID();
    int version = 1;
    String codigo = r.codigo();
    Long owner = r.empresaPropietariaId();
    if (owner != null
        && db.queryForObject("SELECT count(*) FROM empresas WHERE id=?", Long.class, owner) != 1)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Negocio no encontrado");
    if (r.baseId() != null) {
      var old =
          db.queryForList("SELECT * FROM rendimiento_plantillas WHERE id=? FOR UPDATE", r.baseId());
      if (old.isEmpty())
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Versión no encontrada");
      var b = old.getFirst();
      if (!Objects.equals(owner, b.get("empresa_propietaria_id"))
          || !codigo.equals(b.get("codigo")))
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "La nueva versión conserva propietario y código");
      familia = (UUID) b.get("familia");
      version =
          db.queryForObject(
              "SELECT max(version)+1 FROM rendimiento_plantillas WHERE familia=?",
              Integer.class,
              familia);
      var prev = definicion(b);
      for (var flow : r.definicion().flujos())
        for (var oldFlow : prev.flujos())
          if (flow.codigo().equals(oldFlow.codigo()) && flow.clase() != oldFlow.clase())
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Usa un código nuevo al cambiar la clase de un flujo");
    }
    Long id =
        db.queryForObject(
            "INSERT INTO"
                + " rendimiento_plantillas(familia,version,empresa_propietaria_id,codigo,nombre,rubro,tipo,definicion,solicitud,idempotencia)"
                + " VALUES (?,?,?,?,?,?,'PERSONALIZADA',?::jsonb,?::jsonb,?) RETURNING id",
            Long.class,
            familia,
            version,
            owner,
            codigo,
            r.nombre().trim(),
            r.rubro().trim(),
            serial(r.definicion()),
            request,
            r.idempotencia());
    audit.registrar(
        p, p.getEmpresaId(), null, "PLANTILLA_RENDIMIENTO_PUBLICADA", id, "Versión " + version);
    return salida(plantilla(id, owner == null ? p.getEmpresaId() : owner));
  }

  public void validar(Definicion d) {
    if (d.metricas().stream().map(Metrica::clave).distinct().count() != d.metricas().size()
        || d.flujos().stream().map(Flujo::codigo).distinct().count() != d.flujos().size())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los códigos deben ser únicos");
    var codes = new HashSet<String>();
    for (var f : d.flujos()) {
      codes.add(f.codigo());
      if (f.etapas().stream().map(Etapa::codigo).distinct().count() != f.etapas().size()
          || f.etapas().stream().anyMatch(e -> "CANCELADA".equals(e.codigo())))
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Etapas duplicadas o reservadas");
    }
    for (var m : d.metricas())
      if (m.flujoCodigo() != null && !codes.contains(m.flujoCodigo()))
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "La métrica debe referirse a un flujo de la plantilla");
  }

  @Transactional
  public void asignar(UsuarioPrincipal p, long empresa, Long local, Config r) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
    Long id =
        "GENERAL".equals(r.modo())
            ? db.queryForObject(
                "SELECT id FROM rendimiento_plantillas WHERE codigo='GENERAL' AND version=1 AND"
                    + " tipo='BASE' AND empresa_propietaria_id IS NULL",
                Long.class)
            : r.plantillaId();
    if (id == null)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Selecciona una versión de plantilla");
    var selected = plantilla(id, empresa);
    if ("ESPECIFICO".equals(r.modo()) && !"BASE".equals(selected.get("tipo"))
        || "PERSONALIZADO".equals(r.modo()) && !"PERSONALIZADA".equals(selected.get("tipo")))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El modo y la plantilla no coinciden");
    db.update(
        "INSERT INTO rendimiento_asignaciones(empresa_id,local_id,modo,plantilla_id) VALUES"
            + " (?,?,?,?) ON CONFLICT(empresa_id,local_id) DO UPDATE SET"
            + " modo=EXCLUDED.modo,plantilla_id=EXCLUDED.plantilla_id",
        empresa,
        local,
        r.modo(),
        id);
    audit.registrar(p, empresa, local, "PERFIL_RENDIMIENTO_ASIGNADO", id, r.modo());
  }

  @Transactional
  public void heredar(UsuarioPrincipal p, long empresa, long local) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
    db.update(
        "DELETE FROM rendimiento_asignaciones WHERE empresa_id=? AND local_id=?", empresa, local);
    audit.registrar(p, empresa, local, "PERFIL_HEREDADO", local, "Usar configuración del negocio");
  }
}
