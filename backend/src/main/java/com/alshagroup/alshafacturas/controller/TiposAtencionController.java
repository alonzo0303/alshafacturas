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
        "SELECT codigo,nombre FROM tipos_atencion WHERE activo ORDER BY nombre,codigo");
  }

  public record Datos(@NotBlank @Size(max = 100) String nombre) {}

  @PostMapping
  @PreAuthorize("hasRole('SUPERADMIN')")
  public Map<String, Object> crear(@Valid @RequestBody Datos r) {
    String codigo = "T_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    db.update("INSERT INTO tipos_atencion(codigo,nombre) VALUES (?,?)", codigo, r.nombre().trim());
    return Map.of("codigo", codigo, "nombre", r.nombre().trim());
  }
}
