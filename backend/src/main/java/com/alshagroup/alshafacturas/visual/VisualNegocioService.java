package com.alshagroup.alshafacturas.visual;

import com.alshagroup.alshafacturas.gestion.AuditoriaService;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VisualNegocioService {
  private final JdbcTemplate db;
  private final AuditoriaService audit;

  public VisualNegocioService(JdbcTemplate d, AuditoriaService a) {
    db = d;
    audit = a;
  }

  public record Config(
      @NotNull @Pattern(regexp = "COMERCIO|ATENCION") String modalidad,
      @Size(max = 20) String tipoAtencion,
      @Pattern(regexp = "#[0-9a-fA-F]{6}") String colorPrimario,
      @NotNull @Pattern(regexp = "AMPLIO|COMPACTO") String diseno,
      @NotNull @Size(max = 14) List<@NotNull String> modulosVisibles,
      @NotNull @Size(min = 14, max = 14) List<@NotNull String> ordenModulos,
      @Min(0) long version) {}

  public Map<String, Object> obtener(long e) {
    var rows =
        db.queryForList(
            "SELECT modalidad_visual AS modalidad,tipo_visual AS \"tipoAtencion\",color_visual AS"
                + " \"colorPrimario\",diseno_visual AS diseno,version_visual AS"
                + " version,modulos_visuales,orden_visual FROM empresas WHERE id=?",
            e);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Negocio no encontrado");
    var r = rows.getFirst();
    r.put("modulosVisibles", array(r.remove("modulos_visuales")));
    r.put("ordenModulos", array(r.remove("orden_visual")));
    return r;
  }

  private List<String> array(Object a) {
    if (a == null) return Modulos.TODOS;
    try {
      return List.of((String[]) ((java.sql.Array) a).getArray());
    } catch (java.sql.SQLException ex) {
      throw new IllegalStateException(ex);
    }
  }

  @Transactional
  public Map<String, Object> guardar(UsuarioPrincipal p, long e, Config r) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, e);
    if (r.modulosVisibles().stream().distinct().count() != r.modulosVisibles().size()
        || !Modulos.TODOS.containsAll(r.modulosVisibles())
        || !new HashSet<>(r.ordenModulos()).equals(new HashSet<>(Modulos.TODOS)))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Módulos inválidos o repetidos");
    if ("ATENCION".equals(r.modalidad())
            && (r.tipoAtencion() == null
                || db.queryForObject(
                        "SELECT count(*) FROM tipos_atencion WHERE codigo=? AND activo",
                        Long.class,
                        r.tipoAtencion())
                    != 1)
        || "COMERCIO".equals(r.modalidad()) && r.tipoAtencion() != null)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Revisa el tipo de atención");
    if (db.update(
            "UPDATE empresas SET"
                + " modalidad_visual=?,tipo_visual=?,color_visual=?,diseno_visual=?,modulos_visuales=?,orden_visual=?,version_visual=version_visual+1"
                + " WHERE id=? AND version_visual=?",
            r.modalidad(),
            r.tipoAtencion(),
            r.colorPrimario(),
            r.diseno(),
            r.modulosVisibles().toArray(String[]::new),
            r.ordenModulos().toArray(String[]::new),
            e,
            r.version())
        != 1)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "La configuración cambió. Recarga antes de guardar");
    audit.registrar(p, e, null, "VISUAL_NEGOCIO_ACTUALIZADA", e, "Aplicada a todo el personal");
    return obtener(e);
  }
}
