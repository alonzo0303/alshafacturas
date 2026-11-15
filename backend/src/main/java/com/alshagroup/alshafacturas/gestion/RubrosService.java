package com.alshagroup.alshafacturas.gestion;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RubrosService {
  private final JdbcTemplate db;

  public RubrosService(JdbcTemplate db) {
    this.db = db;
  }

  public boolean permitido(Long empresa, Long catalogo) {
    return db.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM catalogo_comun c JOIN empresas e ON e.id=? JOIN locales l ON"
            + " l.empresa_id=e.id AND l.id=? JOIN empresa_rubros_catalogo r ON r.empresa_id=e.id"
            + " AND r.rubro=c.rubro WHERE c.id=? AND c.activo AND"
            + " (COALESCE(l.rubro_negocio,e.rubro_negocio) IS NULL OR"
            + " c.rubro=COALESCE(l.rubro_negocio,e.rubro_negocio)))",
        Boolean.class,
        empresa,
        LocalesService.actual(),
        catalogo);
  }

  public String validar(String rubro) {
    if (rubro == null || rubro.isBlank()) return null;
    String value = rubro.trim();
    if (!db.queryForList("SELECT nombre FROM rubros_catalogo WHERE nombre=?", String.class, value)
        .contains(value))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona un rubro existente");
    return value;
  }

  public void asociar(Long empresa, String rubro) {
    if (rubro != null)
      db.update(
          "INSERT INTO empresa_rubros_catalogo(empresa_id,rubro) VALUES (?,?) ON CONFLICT DO"
              + " NOTHING",
          empresa,
          rubro);
  }

  public Map<String, Object> estado(Long empresa) {
    return Map.of(
        "disponibles",
        db.queryForList("SELECT nombre FROM rubros_catalogo ORDER BY nombre", String.class),
        "habilitados",
        db.queryForList(
            "SELECT rubro FROM empresa_rubros_catalogo WHERE empresa_id=? ORDER BY rubro",
            String.class,
            empresa));
  }

  public record Acceso(@NotNull @Size(max = 100) List<@NotBlank @Size(max = 100) String> rubros) {}

  @Transactional
  public Map<String, Object> guardar(Long empresa, Acceso r) {
    if (db.queryForList("SELECT id FROM empresas WHERE id=? FOR UPDATE", empresa).isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Negocio no encontrado");
    var disponibles = db.queryForList("SELECT nombre FROM rubros_catalogo", String.class);
    if (!disponibles.containsAll(r.rubros()))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Selecciona rubros existentes del catálogo");
    db.update("DELETE FROM empresa_rubros_catalogo WHERE empresa_id=?", empresa);
    for (String rubro : new HashSet<>(r.rubros()))
      db.update(
          "INSERT INTO empresa_rubros_catalogo(empresa_id,rubro) VALUES (?,?)", empresa, rubro);
    return estado(empresa);
  }

  @RestController
  @RequestMapping("/api/empresas/{id}/rubros-catalogo")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public static class Controller {
    private final RubrosService service;

    public Controller(RubrosService service) {
      this.service = service;
    }

    @GetMapping
    public Map<String, Object> estado(@PathVariable Long id) {
      return service.estado(id);
    }

    @PutMapping
    public Map<String, Object> guardar(@PathVariable Long id, @Valid @RequestBody Acceso r) {
      return service.guardar(id, r);
    }
  }
}
