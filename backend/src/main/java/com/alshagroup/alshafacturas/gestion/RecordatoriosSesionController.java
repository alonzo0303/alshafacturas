package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sesion/recordatorios")
public class RecordatoriosSesionController {
  private final JdbcTemplate db;
  private final PlanesService planes;

  public RecordatoriosSesionController(JdbcTemplate db, PlanesService planes) {
    this.db = db;
    this.planes = planes;
  }

  @GetMapping
  public Map<String, Object> estado(@AuthenticationPrincipal UsuarioPrincipal p) {
    var result = new LinkedHashMap<>(planes.recordatorio(p.getEmpresaId()));
    result.put(
        "cajas",
        db.queryForList(
            "SELECT c.id,c.local_id,l.nombre AS local_nombre,c.fondo,c.abierta FROM cajas c JOIN"
                + " locales l ON l.id=c.local_id AND l.empresa_id=c.empresa_id WHERE c.empresa_id=?"
                + " AND c.usuario_original_id=? AND c.estado='ABIERTA' ORDER BY c.id",
            p.getEmpresaId(),
            p.getId()));
    return result;
  }
}
