package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.nio.charset.StandardCharsets;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class StockExportController {
  private final JdbcTemplate db;

  public StockExportController(JdbcTemplate db) {
    this.db = db;
  }

  private String cell(Object value) {
    String s = String.valueOf(value == null ? "" : value);
    if (s.stripLeading().matches("(?s)^[=+@\\-].*") || s.matches("(?s)^[\\t\\r\\n].*")) s = "'" + s;
    return "\"" + s.replace("\"", "\"\"") + "\"";
  }

  @GetMapping("/api/inventario/stock.csv")
  @PreAuthorize("hasAuthority('INVENTARIO_VER')")
  public ResponseEntity<byte[]> export(@AuthenticationPrincipal UsuarioPrincipal p) {
    var rows =
        db.queryForList(
            "SELECT sku,nombre,marca,categoria,stock,minimo,precio,activo FROM productos WHERE"
                + " empresa_id=? AND local_id=? AND clase='PRODUCTO' ORDER BY nombre,id",
            p.getEmpresaId(),
            LocalesService.actual());
    StringBuilder csv =
        new StringBuilder(
            "\uFEFFCódigo;Artículo;Marca;Rubro;Stock;Mínimo;Precio PEN;Estado;Nivel\r\n");
    for (var r : rows) {
      var values =
          new Object[] {
            r.get("sku"),
            r.get("nombre"),
            r.get("marca"),
            r.get("categoria"),
            r.get("stock"),
            r.get("minimo"),
            r.get("precio"),
            Boolean.TRUE.equals(r.get("activo")) ? "Activo" : "Inactivo",
            ((Number) r.get("stock")).intValue() <= ((Number) r.get("minimo")).intValue()
                ? "Stock bajo"
                : "Óptimo"
          };
      for (int i = 0; i < values.length; i++) {
        if (i > 0) csv.append(';');
        csv.append(cell(values[i]));
      }
      csv.append("\r\n");
    }
    return ResponseEntity.ok()
        .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"stock-local-" + LocalesService.actual() + ".csv\"")
        .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
        .body(csv.toString().getBytes(StandardCharsets.UTF_8));
  }
}
