package com.alshagroup.alshafacturas.gestion;

import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RolesService {
  private final JdbcTemplate db;

  public RolesService(JdbcTemplate db) {
    this.db = db;
  }

  public static final Set<String> PERMISOS =
      Set.of(
          "RESUMEN_VER",
          "PRODUCTOS_VER",
          "PRODUCTOS_EDITAR",
          "INVENTARIO_VER",
          "INVENTARIO_EDITAR",
          "COMPRAS_GESTIONAR",
          "VENTAS_GESTIONAR",
          "VENTAS_ANULAR",
          "CLIENTES_GESTIONAR",
          "FACTURACION_VER",
          "FACTURACION_EMITIR",
          "IMPUESTOS_VER");

  public static List<String> predeterminados(String rol) {
    return switch (rol) {
      case "ADMIN" -> PERMISOS.stream().sorted().toList();
      case "VENDEDOR" ->
          List.of("PRODUCTOS_VER", "INVENTARIO_VER", "VENTAS_GESTIONAR", "CLIENTES_GESTIONAR");
      case "ALMACENERO" ->
          List.of("PRODUCTOS_VER", "PRODUCTOS_EDITAR", "INVENTARIO_VER", "INVENTARIO_EDITAR");
      case "COMPRAS" ->
          List.of("PRODUCTOS_VER", "PRODUCTOS_EDITAR", "INVENTARIO_VER", "COMPRAS_GESTIONAR");
      default -> List.of();
    };
  }

  public List<String> permisos(Long empresa, String rol) {
    if (Set.of("ADMIN", "VENDEDOR", "ALMACENERO", "COMPRAS", "SUPERADMIN").contains(rol))
      return predeterminados(rol);
    return db.queryForList(
        "SELECT p.permiso FROM permisos_rol p JOIN roles_negocio r ON r.id=p.rol_id WHERE"
            + " r.empresa_id=? AND r.codigo=? ORDER BY p.permiso",
        String.class,
        empresa,
        rol);
  }

  public boolean existe(Long empresa, String rol) {
    return Set.of("ADMIN", "VENDEDOR", "ALMACENERO", "COMPRAS").contains(rol)
        || db.queryForObject(
                "SELECT count(*) FROM roles_negocio WHERE empresa_id=? AND codigo=?",
                Long.class,
                empresa,
                rol)
            > 0;
  }

  public Map<String, Object> listado(Long empresa) {
    var roles = new ArrayList<Map<String, Object>>();
    for (String rol : List.of("ADMIN", "VENDEDOR", "ALMACENERO", "COMPRAS"))
      roles.add(
          Map.of(
              "codigo",
              rol,
              "nombre",
              rol.equals("ADMIN")
                  ? "Administrador"
                  : rol.equals("VENDEDOR")
                      ? "Vendedor"
                      : rol.equals("COMPRAS") ? "Compras" : "Almacenero",
              "permisos",
              predeterminados(rol),
              "personalizado",
              false));
    for (var r :
        db.queryForList(
            "SELECT codigo,nombre FROM roles_negocio WHERE empresa_id=? ORDER BY nombre",
            empresa)) {
      r.put("permisos", permisos(empresa, r.get("codigo").toString()));
      r.put("personalizado", true);
      roles.add(r);
    }
    return Map.of("roles", roles, "permisosDisponibles", PERMISOS.stream().sorted().toList());
  }

  public record RolRequest(
      @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,29}") String codigo,
      @NotBlank @Size(max = 100) String nombre,
      @NotEmpty Set<String> permisos) {}

  @Transactional
  public void guardar(Long empresa, RolRequest r) {
    if (Set.of("ADMIN", "SUPERADMIN", "VENDEDOR", "COMPRAS", "ALMACENERO").contains(r.codigo())
        || !PERMISOS.containsAll(r.permisos()))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Código reservado o permisos no válidos");
    var permisos = new HashSet<>(r.permisos());
    if (permisos.contains("INVENTARIO_EDITAR")) permisos.add("INVENTARIO_VER");
    if (permisos.contains("RESUMEN_VER")
        || permisos.contains("PRODUCTOS_EDITAR")
        || permisos.contains("COMPRAS_GESTIONAR")
        || permisos.contains("VENTAS_GESTIONAR")
        || permisos.contains("INVENTARIO_VER")) permisos.add("PRODUCTOS_VER");
    if (permisos.contains("VENTAS_ANULAR")) permisos.add("VENTAS_GESTIONAR");
    if (permisos.contains("FACTURACION_EMITIR")) permisos.add("FACTURACION_VER");
    if (permisos.contains("VENTAS_GESTIONAR")) permisos.add("PRODUCTOS_VER");
    Long id =
        db.queryForObject(
            "INSERT INTO roles_negocio(empresa_id,codigo,nombre) VALUES (?,?,?) ON"
                + " CONFLICT(empresa_id,codigo) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id",
            Long.class,
            empresa,
            r.codigo(),
            r.nombre().trim());
    db.update("DELETE FROM permisos_rol WHERE rol_id=?", id);
    for (String permiso : permisos)
      db.update("INSERT INTO permisos_rol(rol_id,permiso) VALUES (?,?)", id, permiso);
  }
}
