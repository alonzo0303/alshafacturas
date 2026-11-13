package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuditoriaService {
  private final JdbcTemplate db;

  public AuditoriaService(JdbcTemplate db) {
    this.db = db;
  }

  public void registrar(
      UsuarioPrincipal actor,
      Long empresa,
      Long local,
      String evento,
      Object objetivo,
      String detalle) {
    db.update(
        "INSERT INTO"
            + " eventos_auditoria(empresa_id,local_id,actor_id,actor_nombre,evento,objetivo,detalle)"
            + " VALUES (?,?,?,?,?,?,?)",
        empresa,
        local,
        actor.getId(),
        actor.getNombre(),
        evento,
        String.valueOf(objetivo),
        detalle);
  }
}
