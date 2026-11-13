package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LocalesService {
  private final JdbcTemplate db;

  public LocalesService(JdbcTemplate db) {
    this.db = db;
  }

  public static long actual() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof UsuarioPrincipal p && p.getLocalId() != null)
      return p.getLocalId();
    throw new ResponseStatusException(
        HttpStatus.CONFLICT, "Selecciona un local e inicia sesión nuevamente");
  }

  public static String filtroComprobante() {
    return " AND venta_id IN (SELECT id FROM ventas WHERE local_id=" + actual() + ")";
  }

  public List<Map<String, Object>> todos(Long empresa) {
    db.update(
        "INSERT INTO locales(empresa_id,nombre,direccion) SELECT id,'Local"
            + " principal',COALESCE(direccion,'') FROM empresas e WHERE id=? AND NOT EXISTS(SELECT"
            + " 1 FROM locales l WHERE l.empresa_id=e.id) ON CONFLICT DO NOTHING",
        empresa);
    return db.queryForList(
        "SELECT id,nombre,direccion,rubro_negocio FROM locales WHERE empresa_id=? ORDER BY id",
        empresa);
  }

  public List<Map<String, Object>> permitidos(UsuarioPrincipal p) {
    var rows = todos(p.getEmpresaId());
    if ("ADMIN".equals(p.getRol())) return rows;
    var ids =
        db.queryForList(
            "SELECT local_id FROM usuario_locales WHERE usuario_id=?", Long.class, p.getId());
    if (ids.isEmpty()) return rows.isEmpty() ? List.of() : List.of(rows.getFirst());
    return rows.stream().filter(l -> ids.contains(((Number) l.get("id")).longValue())).toList();
  }

  public void seleccionar(UsuarioPrincipal p, Long solicitado) {
    if ("SUPERADMIN".equals(p.getRol())) return;
    var rows = permitidos(p);
    var local =
        rows.stream()
            .filter(
                l -> solicitado == null || solicitado.equals(((Number) l.get("id")).longValue()))
            .findFirst()
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.FORBIDDEN, "No tienes acceso a este local"));
    p.seleccionarLocal(((Number) local.get("id")).longValue(), local.get("nombre").toString());
  }
}
