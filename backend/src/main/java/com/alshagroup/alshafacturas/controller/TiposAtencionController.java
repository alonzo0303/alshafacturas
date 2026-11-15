package com.alshagroup.alshafacturas.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tipos-atencion")
public class TiposAtencionController {
  private final JdbcTemplate db;

  public TiposAtencionController(JdbcTemplate db) {
    this.db = db;
  }

  @GetMapping
  public List<Map<String, Object>> listar() {
    return db.queryForList(
        "SELECT codigo,nombre,emoji,tema FROM tipos_atencion WHERE activo ORDER BY nombre,codigo");
  }

  public record Datos(
      @NotBlank @Size(max = 100) String nombre,
      @Size(max = 16) String emoji,
      @Pattern(regexp = "COMERCIO|BARBERIA|SPA|RESTAURANTE|OTRO") String tema) {}

  @PostMapping
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> crear(@Valid @RequestBody Datos r) {
    String codigo = "T_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    db.update(
        "INSERT INTO tipos_atencion(codigo,nombre,emoji,tema) VALUES (?,?,?,?)",
        codigo,
        r.nombre().trim(),
        r.emoji() == null || r.emoji().isBlank() ? "🛎️" : r.emoji().trim(),
        Objects.requireNonNullElse(r.tema(), "OTRO"));
    return Map.of("codigo", codigo, "nombre", r.nombre().trim());
  }

  @PutMapping("/{codigo}")
  @PreAuthorize("hasRole('SUPERADMIN')")
  public void editar(@PathVariable String codigo, @Valid @RequestBody Datos r) {
    if (db.update(
            "UPDATE tipos_atencion SET nombre=?,emoji=?,tema=? WHERE codigo=?",
            r.nombre().trim(),
            r.emoji() == null || r.emoji().isBlank() ? "🛎️" : r.emoji().trim(),
            Objects.requireNonNullElse(r.tema(), "OTRO"),
            codigo)
        == 0)
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.NOT_FOUND, "Tipo de atención no encontrado");
  }
}
