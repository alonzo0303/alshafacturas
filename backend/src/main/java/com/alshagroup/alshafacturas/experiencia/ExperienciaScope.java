package com.alshagroup.alshafacturas.experiencia;

import com.alshagroup.alshafacturas.gestion.LocalesService;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ExperienciaScope {
  private final JdbcTemplate db;

  public ExperienciaScope(JdbcTemplate db) {
    this.db = db;
  }

  public boolean root(UsuarioPrincipal p) {
    return "SUPERADMIN".equals(p.getRol());
  }

  public boolean equipo(UsuarioPrincipal p) {
    return root(p) || "ADMIN".equals(p.getRol());
  }

  public long empresa(UsuarioPrincipal p, Long e) {
    if (!root(p) && e != null && !e.equals(p.getEmpresaId()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Empresa ajena");
    long id = root(p) && e != null ? e : p.getEmpresaId();
    if (db.queryForObject("SELECT count(*) FROM empresas WHERE id=?", Long.class, id) != 1)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Negocio no encontrado");
    return id;
  }

  public long local(UsuarioPrincipal p, long e, Long l) {
    long id = root(p) ? (l == null ? 0 : l) : LocalesService.actual();
    if (!root(p) && l != null && id != l)
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Local ajeno");
    validarLocal(e, id);
    return id;
  }

  public void validarLocal(long e, long l) {
    if (db.queryForObject(
            "SELECT count(*) FROM locales WHERE empresa_id=? AND id=?", Long.class, e, l)
        != 1)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona un local del negocio");
  }
}
