package com.alshagroup.alshafacturas.visual;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class AlcanceDatos {
  private AlcanceDatos() {}

  public static boolean equipo(UsuarioPrincipal p) {
    return Set.of("ADMIN", "SUPERADMIN").contains(p.getRol());
  }

  public static Object[] args(UsuarioPrincipal p, Object... prev) {
    Object[] out = Arrays.copyOf(prev, prev.length + 2);
    out[prev.length] = equipo(p);
    out[prev.length + 1] = p.getId();
    return out;
  }

  public static void verificar(UsuarioPrincipal p, Map<String, Object> row, String campo) {
    if (!equipo(p) && (!(row.get(campo) instanceof Number n) || n.longValue() != p.getId()))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Registro no encontrado");
  }

  public static void pedido(UsuarioPrincipal p, Map<String, Object> row) {
    if (equipo(p)) return;
    boolean autor =
        row.get("usuario_original_id") instanceof Number n && n.longValue() == p.getId();
    boolean asignado =
        row.get("responsable_original_id") instanceof Number r && r.longValue() == p.getId();
    if (!autor && !asignado)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado");
  }
}
