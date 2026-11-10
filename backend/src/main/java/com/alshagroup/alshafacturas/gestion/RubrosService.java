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
        "SELECT EXISTS(SELECT 1 FROM catalogo_comun c JOIN empresa_rubros_catalogo r ON"
            + " r.rubro=c.rubro WHERE r.empresa_id=? AND c.id=? AND c.activo)",
        Boolean.class,
        empresa,
        catalogo);
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
