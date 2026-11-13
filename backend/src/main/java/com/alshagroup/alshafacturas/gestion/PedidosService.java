package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.comercial.*;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.math.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PedidosService {
  private final JdbcTemplate db;
  private final ComercialService comercial;
  private final AuditoriaService audit;

  public PedidosService(JdbcTemplate db, ComercialService comercial, AuditoriaService audit) {
    this.db = db;
    this.comercial = comercial;
    this.audit = audit;
  }

  private void permiso(UsuarioPrincipal p, String clase) {
    String required = "MESA".equals(clase) ? "MESAS_GESTIONAR" : "PREPARACION_GESTIONAR";
    if (p.getAuthorities().stream().noneMatch(a -> required.equals(a.getAuthority())))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permiso para este pedido");
  }

  private void preparacion(UsuarioPrincipal p) {
    if (!Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT preparacion_habilitada FROM empresas WHERE id=?",
            Boolean.class,
            p.getEmpresaId())))
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "La preparación de pedidos no está habilitada para este negocio");
  }

  private Map<String, Object> row(UsuarioPrincipal p, Long id) {
    var rows =
        db.queryForList(
            "SELECT * FROM pedidos WHERE empresa_id=? AND local_id=? AND id=? FOR UPDATE",
            p.getEmpresaId(),
            LocalesService.actual(),
            id);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado");
    var r = rows.getFirst();
    permiso(p, r.get("clase").toString());
    return r;
  }

  @Transactional
  public Map<String, Object> servir(UsuarioPrincipal p, Long id, int version) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var r = row(p, id);
    if (!"MESA".equals(r.get("clase")))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Solo corresponde a pedidos de mesa");
    if ("CANCELADO".equals(r.get("estado")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "El pedido fue cancelado");
    if (r.get("servido_en") != null) return detalle(p, id);
    if (((Number) r.get("version")).intValue() != version)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "El pedido cambió; recarga antes de servir");
    if (db.queryForObject("SELECT count(*) FROM pedido_detalles WHERE pedido_id=?", Long.class, id)
        == 0)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Guarda los artículos antes de servir");
    db.update(
        "UPDATE pedidos SET"
            + " servido_en=CURRENT_TIMESTAMP,servido_por_original_id=?,servido_por_nombre=?,version=version+1"
            + " WHERE id=?",
        p.getId(),
        p.getNombre(),
        id);
    audit.registrar(
        p,
        p.getEmpresaId(),
        LocalesService.actual(),
        "PEDIDO_PRIMERA_ENTREGA",
        id,
        "Primera entrega a mesa");
    return detalle(p, id);
  }

  @Transactional
  public Map<String, Object> detalle(UsuarioPrincipal p, Long id) {
    var r = row(p, id);
    r.remove("cobro_idempotencia");
    r.put(
        "lineas",
        db.queryForList("SELECT * FROM pedido_detalles WHERE pedido_id=? ORDER BY id", id));
    r.put(
        "empresa",
        db.queryForMap(
            "SELECT razon_social,ruc,direccion FROM empresas WHERE id=?", p.getEmpresaId()));
    r.put(
        "local",
        db.queryForMap("SELECT nombre,direccion FROM locales WHERE id=?", LocalesService.actual()));
    if (r.get("mesa_id") != null)
      r.put(
          "mesa",
          db.queryForObject("SELECT nombre FROM mesas WHERE id=?", String.class, r.get("mesa_id")));
    return r;
  }

  @Transactional
  public Map<String, Object> crear(UsuarioPrincipal p, PedidosController.Nuevo r) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    permiso(p, r.clase());
    if ("PREPARACION".equals(r.clase())) {
      preparacion(p);
      if (r.mesaId() != null)
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Una preparación no utiliza mesa");
    } else if (r.mesaId() == null
        || db.queryForObject(
                "SELECT count(*) FROM mesas WHERE empresa_id=? AND local_id=? AND id=? AND activo",
                Long.class,
                p.getEmpresaId(),
                LocalesService.actual(),
                r.mesaId())
            != 1)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Selecciona una mesa activa de este local");
    var previous =
        db.queryForList(
            "SELECT id,clase,mesa_id FROM pedidos WHERE empresa_id=? AND idempotencia=?",
            p.getEmpresaId(),
            r.idempotencia());
    if (!previous.isEmpty()) {
      var old = previous.getFirst();
      if (!r.clase().equals(old.get("clase")) || !Objects.equals(r.mesaId(), old.get("mesa_id")))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "La clave corresponde a otro pedido");
      return detalle(p, ((Number) old.get("id")).longValue());
    }
    Long id =
        db.queryForObject(
            "INSERT INTO"
                + " pedidos(empresa_id,local_id,clase,mesa_id,usuario_id,usuario_original_id,usuario_nombre,idempotencia)"
                + " VALUES (?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            p.getEmpresaId(),
            LocalesService.actual(),
            r.clase(),
            r.mesaId(),
            p.getId(),
            p.getId(),
            p.getNombre(),
            r.idempotencia());
    audit.registrar(p, p.getEmpresaId(), LocalesService.actual(), "PEDIDO_CREADO", id, r.clase());
    return detalle(p, id);
  }

  @Transactional
  public Map<String, Object> guardar(UsuarioPrincipal p, Long id, PedidosController.Edicion r) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var order = row(p, id);
    if (!Set.of("ABIERTO", "PREPARADO").contains(order.get("estado")))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "El pedido ya fue cobrado o cancelado");
    if (((Number) order.get("version")).intValue() != r.version())
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "El pedido cambió. Actualízalo antes de editar");
    if ("PREPARACION".equals(order.get("clase"))) preparacion(p);
    var rows = new ArrayList<Map<String, Object>>();
    var ids = new HashSet<Long>();
    BigDecimal total = BigDecimal.ZERO;
    for (var line : r.lineas()) {
      if (!ids.add(line.productoId()))
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Agrupa las cantidades de cada artículo");
      var products =
          db.queryForList(
              "SELECT id,nombre,sku,precio FROM productos WHERE empresa_id=? AND local_id=? AND"
                  + " id=? AND activo AND precio>0",
              p.getEmpresaId(),
              LocalesService.actual(),
              line.productoId());
      if (products.isEmpty())
        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND, "Artículo o servicio no disponible en este local");
      var product = products.getFirst();
      product.put("cantidad", line.cantidad());
      rows.add(product);
      total =
          total.add(
              ((BigDecimal) product.get("precio")).multiply(BigDecimal.valueOf(line.cantidad())));
    }
    if (total.compareTo(new BigDecimal("999999999999.99")) > 0)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El total excede el límite");
    db.update("DELETE FROM pedido_detalles WHERE pedido_id=?", id);
    for (var line : rows)
      db.update(
          "INSERT INTO pedido_detalles(pedido_id,producto_id,nombre,sku,cantidad,precio) VALUES"
              + " (?,?,?,?,?,?)",
          id,
          line.get("id"),
          line.get("nombre"),
          line.get("sku"),
          line.get("cantidad"),
          line.get("precio"));
    db.update(
        "UPDATE pedidos SET observacion=?,estado='ABIERTO',version=version+1 WHERE id=?",
        Objects.requireNonNullElse(r.observacion(), "").trim(),
        id);
    audit.registrar(
        p,
        p.getEmpresaId(),
        LocalesService.actual(),
        "PEDIDO_EDITADO",
        id,
        "Versión=" + (r.version() + 1));
    return detalle(p, id);
  }

  @Transactional
  public Map<String, Object> estado(UsuarioPrincipal p, Long id, PedidosController.Estado r) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var order = row(p, id);
    if (((Number) order.get("version")).intValue() != r.version())
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "El pedido cambió. Actualiza la vista");
    if (!Set.of("ABIERTO", "PREPARADO").contains(order.get("estado")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "El pedido ya está finalizado");
    if ("PREPARADO".equals(r.estado())
        && db.queryForObject(
                "SELECT count(*) FROM pedido_detalles WHERE pedido_id=?", Long.class, id)
            == 0)
      throw new ResponseStatusException(HttpStatus.CONFLICT, "El pedido no tiene artículos");
    db.update("UPDATE pedidos SET estado=?,version=version+1 WHERE id=?", r.estado(), id);
    audit.registrar(p, p.getEmpresaId(), LocalesService.actual(), "PEDIDO_" + r.estado(), id, "");
    return detalle(p, id);
  }

  @Transactional
  public Map<String, Object> cobrar(UsuarioPrincipal p, Long id, PedidosController.Cobro r) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var order = row(p, id);
    if (order.get("venta_id") != null)
      return comercial.venta(p.getEmpresaId(), ((Number) order.get("venta_id")).longValue());
    if (!Set.of("ABIERTO", "PREPARADO").contains(order.get("estado")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "El pedido está cancelado");
    if (((Number) order.get("version")).intValue() != r.version())
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "El pedido cambió. Revísalo antes de cobrar");
    var details =
        db.queryForList(
            "SELECT d.producto_id,d.cantidad,d.precio,p.precio AS precio_actual,p.activo FROM"
                + " pedido_detalles d JOIN productos p ON p.id=d.producto_id WHERE pedido_id=?"
                + " ORDER BY d.id",
            id);
    if (details.isEmpty())
      throw new ResponseStatusException(HttpStatus.CONFLICT, "El pedido no tiene artículos");
    for (var d : details)
      if (!Boolean.TRUE.equals(d.get("activo"))
          || ((BigDecimal) d.get("precio")).compareTo((BigDecimal) d.get("precio_actual")) != 0)
        throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Cambió el precio o disponibilidad de un artículo. Guarda y revisa de nuevo el pedido");
    var lineas =
        details.stream()
            .map(
                d ->
                    new ComercialDtos.LineaVenta(
                        ((Number) d.get("producto_id")).longValue(),
                        ((Number) d.get("cantidad")).intValue()))
            .toList();
    var venta =
        comercial.vender(
            p,
            new ComercialDtos.VentaRequest(
                (UUID) order.get("cobro_idempotencia"),
                r.clienteId(),
                r.tipo(),
                r.metodoPago(),
                lineas));
    db.update(
        "UPDATE pedidos SET estado='COBRADO',venta_id=?,version=version+1 WHERE id=?",
        venta.get("id"),
        id);
    audit.registrar(
        p,
        p.getEmpresaId(),
        LocalesService.actual(),
        "PEDIDO_COBRADO",
        id,
        "Venta=" + venta.get("id"));
    return venta;
  }
}
