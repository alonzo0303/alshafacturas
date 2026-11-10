package com.alshagroup.alshafacturas.comercial;

import static com.alshagroup.alshafacturas.comercial.ComercialDtos.*;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.math.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ComercialService {
  private final JdbcTemplate db;

  public ComercialService(JdbcTemplate db) {
    this.db = db;
  }

  private ResponseStatusException error(String m) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, m);
  }

  private Map<String, Object> one(String sql, Object... args) {
    var rows = db.queryForList(sql, args);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Registro no encontrado");
    return rows.getFirst();
  }

  private void lock(Long empresa) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
  }

  public List<Map<String, Object>> productos(Long empresa) {
    return db.queryForList(
        "SELECT p.*,CASE WHEN afectacion_igv='GRAVADO' THEN round(precio/1.18,2) ELSE precio END AS"
            + " precio_sin_igv FROM productos p WHERE empresa_id=? ORDER BY nombre,id",
        empresa);
  }

  private String normalized(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value.trim();
  }

  @Transactional
  public Map<String, Object> producto(Long empresa, Long id, ProductoRequest r) {
    lock(empresa);
    var e = one("SELECT ruc,afectacion_default FROM empresas WHERE id=?", empresa);
    String afectacion =
        e.get("ruc") == null
            ? "SIN_IGV"
            : normalized(r.afectacionIgv(), e.get("afectacion_default").toString());
    if (e.get("ruc") != null && "SIN_IGV".equals(afectacion))
      throw error(
          "Selecciona el tratamiento tributario del producto: gravado, exonerado o inafecto");
    BigDecimal precio = r.precio();
    if ("GRAVADO".equals(afectacion) && Boolean.FALSE.equals(r.precioIncluyeIgv()))
      precio = precio.multiply(new BigDecimal("1.18")).setScale(2, RoundingMode.HALF_UP);
    if (precio.compareTo(new BigDecimal("999999999.99")) > 0)
      throw error("El precio final excede el máximo permitido");
    String sku =
        normalized(r.sku(), "P-" + UUID.randomUUID().toString().substring(0, 12))
            .toUpperCase(Locale.ROOT);
    if (r.catalogoId() != null)
      one("SELECT id FROM catalogo_comun WHERE id=? AND activo=true", r.catalogoId());
    if (id == null)
      id =
          db.queryForObject(
              "INSERT INTO"
                  + " productos(empresa_id,sku,nombre,precio,minimo,activo,marca,categoria,presentacion,codigo_barras,catalogo_id,afectacion_igv)"
                  + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
              Long.class,
              empresa,
              sku,
              r.nombre().trim(),
              precio,
              r.minimo(),
              r.activo(),
              normalized(r.marca(), "Genérico"),
              normalized(r.categoria(), "General"),
              normalized(r.presentacion(), ""),
              normalized(r.codigoBarras(), null),
              r.catalogoId(),
              afectacion);
    else {
      one("SELECT id FROM productos WHERE empresa_id=? AND id=?", empresa, id);
      db.update(
          "UPDATE productos SET"
              + " sku=?,nombre=?,precio=?,minimo=?,activo=?,marca=?,categoria=?,presentacion=?,codigo_barras=?,catalogo_id=?,afectacion_igv=?"
              + " WHERE empresa_id=? AND id=?",
          sku,
          r.nombre().trim(),
          precio,
          r.minimo(),
          r.activo(),
          normalized(r.marca(), "Genérico"),
          normalized(r.categoria(), "General"),
          normalized(r.presentacion(), ""),
          normalized(r.codigoBarras(), null),
          r.catalogoId(),
          afectacion,
          empresa,
          id);
    }
    return one("SELECT * FROM productos WHERE empresa_id=? AND id=?", empresa, id);
  }

  public List<Map<String, Object>> clientes(Long empresa) {
    return db.queryForList("SELECT * FROM clientes WHERE empresa_id=? ORDER BY nombre,id", empresa);
  }

  @Transactional
  public Map<String, Object> cliente(Long empresa, Long id, ClienteRequest r) {
    if (id == null)
      id =
          db.queryForObject(
              "INSERT INTO clientes(empresa_id,documento,nombre,correo,direccion) VALUES"
                  + " (?,?,?,?,?) RETURNING id",
              Long.class,
              empresa,
              r.documento(),
              r.nombre().trim(),
              r.correo(),
              r.direccion());
    else {
      one("SELECT id FROM clientes WHERE empresa_id=? AND id=?", empresa, id);
      db.update(
          "UPDATE clientes SET documento=?,nombre=?,correo=?,direccion=? WHERE empresa_id=? AND"
              + " id=?",
          r.documento(),
          r.nombre().trim(),
          r.correo(),
          r.direccion(),
          empresa,
          id);
    }
    return one("SELECT * FROM clientes WHERE empresa_id=? AND id=?", empresa, id);
  }

  public List<Map<String, Object>> movimientos(Long empresa) {
    return db.queryForList(
        "SELECT m.*,p.nombre,p.sku FROM movimientos m JOIN productos p ON p.id=m.producto_id WHERE"
            + " m.empresa_id=? ORDER BY m.id DESC LIMIT 500",
        empresa);
  }

  private void mover(UsuarioPrincipal p, Long producto, int cantidad, String tipo, String motivo) {
    var row =
        one(
            "SELECT stock FROM productos WHERE empresa_id=? AND id=? FOR UPDATE",
            p.getEmpresaId(),
            producto);
    long saldo = ((Number) row.get("stock")).longValue() + cantidad;
    if (saldo < 0 || saldo > 1000000000)
      throw error("Stock insuficiente o cantidad fuera de rango");
    db.update(
        "UPDATE productos SET stock=? WHERE empresa_id=? AND id=?",
        saldo,
        p.getEmpresaId(),
        producto);
    db.update(
        "INSERT INTO movimientos(empresa_id,producto_id,usuario_id,tipo,cantidad,saldo,motivo)"
            + " VALUES (?,?,?,?,?,?,?)",
        p.getEmpresaId(),
        producto,
        p.getId(),
        tipo,
        cantidad,
        saldo,
        motivo);
  }

  @Transactional
  public void ajuste(UsuarioPrincipal p, AjusteRequest r) {
    if (r.cantidad() == 0) throw error("El ajuste debe ser distinto de cero");
    lock(p.getEmpresaId());
    mover(p, r.productoId(), r.cantidad(), "AJUSTE", r.motivo().trim());
  }

  public List<Map<String, Object>> ventas(Long empresa) {
    return db.queryForList(
        "SELECT v.*,c.nombre AS cliente FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id"
            + " WHERE v.empresa_id=? ORDER BY v.id DESC LIMIT 500",
        empresa);
  }

  public Map<String, Object> venta(Long empresa, Long id) {
    var v =
        one(
            "SELECT v.*,c.nombre AS cliente,c.documento AS"
                + " cliente_documento,e.razon_social,e.ruc,e.direccion FROM ventas v JOIN empresas"
                + " e ON e.id=v.empresa_id LEFT JOIN clientes c ON c.id=v.cliente_id WHERE"
                + " v.empresa_id=? AND v.id=?",
            empresa,
            id);
    v.put(
        "lineas", db.queryForList("SELECT * FROM venta_detalles WHERE venta_id=? ORDER BY id", id));
    return v;
  }

  @Transactional
  public Map<String, Object> vender(UsuarioPrincipal p, VentaRequest r) {
    Long empresa = p.getEmpresaId();
    lock(empresa);
    var existing =
        db.queryForList(
            "SELECT id FROM ventas WHERE empresa_id=? AND idempotencia=?",
            empresa,
            r.idempotencia());
    if (!existing.isEmpty()) {
      Long previousId = ((Number) existing.getFirst().get("id")).longValue();
      var previous = venta(empresa, previousId);
      var previousLines =
          db.queryForList(
              "SELECT producto_id,cantidad FROM venta_detalles WHERE venta_id=?", previousId);
      boolean same =
          Objects.equals(r.clienteId(), previous.get("cliente_id"))
              && r.tipo().equals(previous.get("tipo"))
              && r.metodoPago().equals(previous.get("metodo_pago"))
              && previousLines.size() == r.lineas().size()
              && r.lineas().stream()
                  .allMatch(
                      line ->
                          previousLines.stream()
                              .anyMatch(
                                  old ->
                                      Objects.equals(old.get("producto_id"), line.productoId())
                                          && ((Number) old.get("cantidad")).intValue()
                                              == line.cantidad()));
      if (!same)
        throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Esta clave de reintento ya corresponde a otra venta. Revisa el historial antes de"
                + " crear una nueva operación");
      return previous;
    }
    if (!"TICKET".equals(r.tipo())
        && db.queryForObject("SELECT ruc FROM empresas WHERE id=?", String.class, empresa) == null)
      throw error(
          "El negocio necesita RUC para solicitar facturas o boletas. Puedes registrar una nota de"
              + " venta interna");
    if (r.clienteId() != null) {
      var c = one("SELECT * FROM clientes WHERE empresa_id=? AND id=?", empresa, r.clienteId());
      if ("FACTURA".equals(r.tipo()) && !c.get("documento").toString().matches("[0-9]{11}"))
        throw error("La factura requiere un cliente con RUC de 11 dígitos");
    } else if ("FACTURA".equals(r.tipo()))
      throw error("Selecciona un cliente con RUC para preparar la factura");
    Set<Long> ids = new HashSet<>();
    List<Map<String, Object>> lineas = new ArrayList<>();
    BigDecimal total = BigDecimal.ZERO;
    for (var l : r.lineas()) {
      if (!ids.add(l.productoId()))
        throw error("Agrupa las cantidades de cada producto en una sola línea");
      var prod =
          one(
              "SELECT * FROM productos WHERE empresa_id=? AND id=? AND activo=true FOR UPDATE",
              empresa,
              l.productoId());
      if (((BigDecimal) prod.get("precio")).signum() <= 0)
        throw error("Define el precio de venta de " + prod.get("nombre") + " antes de vender");
      if (((Number) prod.get("stock")).intValue() < l.cantidad())
        throw error("Stock insuficiente para " + prod.get("nombre"));
      BigDecimal amount =
          ((BigDecimal) prod.get("precio"))
              .multiply(BigDecimal.valueOf(l.cantidad()))
              .setScale(2, RoundingMode.HALF_UP);
      BigDecimal base =
          "GRAVADO".equals(prod.get("afectacion_igv"))
              ? amount.divide(new BigDecimal("1.18"), 2, RoundingMode.HALF_UP)
              : amount;
      prod.put("base_linea", base);
      prod.put("igv_linea", amount.subtract(base));
      prod.put("cantidad", l.cantidad());
      prod.put("importe", amount);
      lineas.add(prod);
      total = total.add(amount);
    }
    checkTotal(total);
    BigDecimal subtotal =
        lineas.stream()
            .map(l -> (BigDecimal) l.get("base_linea"))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    long seq =
        db.queryForObject(
            "INSERT INTO correlativos(empresa_id,tipo,ultimo) VALUES (?,'VENTA',1) ON"
                + " CONFLICT(empresa_id,tipo) DO UPDATE SET ultimo=correlativos.ultimo+1 RETURNING"
                + " ultimo",
            Long.class,
            empresa);
    String numero = "NV01-" + String.format(Locale.ROOT, "%08d", seq);
    Long id =
        db.queryForObject(
            "INSERT INTO"
                + " ventas(empresa_id,usuario_id,cliente_id,numero,tipo,estado_fiscal,metodo_pago,subtotal,igv,total,idempotencia)"
                + " VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            empresa,
            p.getId(),
            r.clienteId(),
            numero,
            r.tipo(),
            "TICKET".equals(r.tipo()) ? "NO_APLICA" : "PENDIENTE_CONFIGURACION",
            r.metodoPago(),
            subtotal,
            total.subtract(subtotal),
            total,
            r.idempotencia());
    for (var l : lineas) {
      Long producto = ((Number) l.get("id")).longValue();
      int cantidad = ((Number) l.get("cantidad")).intValue();
      db.update(
          "INSERT INTO"
              + " venta_detalles(venta_id,producto_id,sku,nombre,cantidad,precio,total,base,igv,afectacion_igv)"
              + " VALUES (?,?,?,?,?,?,?,?,?,?)",
          id,
          producto,
          l.get("sku"),
          l.get("nombre"),
          cantidad,
          l.get("precio"),
          l.get("importe"),
          l.get("base_linea"),
          l.get("igv_linea"),
          l.get("afectacion_igv"));
      mover(p, producto, -cantidad, "VENTA", numero);
    }
    return venta(empresa, id);
  }

  @Transactional
  public Map<String, Object> anular(UsuarioPrincipal p, Long id, String motivo) {
    lock(p.getEmpresaId());
    var v = venta(p.getEmpresaId(), id);
    if ("ANULADA".equals(v.get("estado"))) return v;
    Long fiscales =
        db.queryForObject(
            "SELECT COUNT(*) FROM comprobantes WHERE empresa_id=? AND venta_id=?",
            Long.class,
            p.getEmpresaId(),
            id);
    if (fiscales != null && fiscales > 0)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "Esta venta ya tiene un comprobante fiscal preparado. Requiere revisión tributaria y,"
              + " cuando corresponda, nota de crédito o baja; no se permite anulación interna");

    for (var l :
        db.queryForList("SELECT producto_id,cantidad FROM venta_detalles WHERE venta_id=?", id))
      mover(
          p,
          ((Number) l.get("producto_id")).longValue(),
          ((Number) l.get("cantidad")).intValue(),
          "ANULACION",
          v.get("numero") + ": " + motivo);
    db.update(
        "UPDATE ventas SET estado='ANULADA',motivo_anulacion=? WHERE empresa_id=? AND id=?",
        motivo,
        p.getEmpresaId(),
        id);
    return venta(p.getEmpresaId(), id);
  }

  public List<Map<String, Object>> compras(Long empresa) {
    return db.queryForList(
        "SELECT * FROM compras WHERE empresa_id=? ORDER BY id DESC LIMIT 500", empresa);
  }

  @Transactional
  public Map<String, Object> comprar(UsuarioPrincipal p, CompraRequest r) {
    Long empresa = p.getEmpresaId();
    lock(empresa);
    var existing =
        db.queryForList(
            "SELECT * FROM compras WHERE empresa_id=? AND idempotencia=?",
            empresa,
            r.idempotencia());
    if (!existing.isEmpty()) {
      var previous = existing.getFirst();
      var previousLines =
          db.queryForList(
              "SELECT producto_id,cantidad,costo FROM compra_detalles WHERE compra_id=?",
              previous.get("id"));
      boolean same =
          r.proveedor().trim().equals(previous.get("proveedor"))
              && r.referencia().trim().equals(previous.get("referencia"))
              && Objects.equals(previous.get("proveedor_ruc"), normalized(r.proveedorRuc(), null))
              && previous.get("tipo_documento").equals(normalized(r.tipoDocumento(), "INTERNO"))
              && previous.get("gravada").equals(Boolean.TRUE.equals(r.gravada()))
              && previous
                  .get("costo_incluye_igv")
                  .equals(!Boolean.FALSE.equals(r.costoIncluyeIgv()))
              && previous.get("credito_fiscal").equals(Boolean.TRUE.equals(r.creditoFiscal()))
              && previousLines.size() == r.lineas().size()
              && r.lineas().stream()
                  .allMatch(
                      line ->
                          previousLines.stream()
                              .anyMatch(
                                  old ->
                                      Objects.equals(old.get("producto_id"), line.productoId())
                                          && ((Number) old.get("cantidad")).intValue()
                                              == line.cantidad()
                                          && ((BigDecimal) old.get("costo")).compareTo(line.costo())
                                              == 0));
      if (!same)
        throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Esta clave de reintento ya corresponde a otra compra. Revisa el historial antes de"
                + " crear una nueva operación");
      return previous;
    }
    boolean gravada = Boolean.TRUE.equals(r.gravada());
    boolean incluye = !Boolean.FALSE.equals(r.costoIncluyeIgv());
    String tipo = normalized(r.tipoDocumento(), "INTERNO");
    String proveedorRuc = normalized(r.proveedorRuc(), null);
    if ("FACTURA".equals(tipo) && proveedorRuc == null)
      throw error("La factura de compra requiere RUC del proveedor");
    if (Boolean.TRUE.equals(r.creditoFiscal())
        && (!gravada
            || !"FACTURA".equals(tipo)
            || proveedorRuc == null
            || db.queryForObject("SELECT ruc FROM empresas WHERE id=?", String.class, empresa)
                == null))
      throw error(
          "El crédito fiscal potencial requiere factura, RUC del proveedor y del negocio, y compra"
              + " gravada");
    BigDecimal base = BigDecimal.ZERO, igv = BigDecimal.ZERO, total = BigDecimal.ZERO;
    Set<Long> ids = new HashSet<>();
    for (var l : r.lineas()) {
      if (!ids.add(l.productoId())) throw error("Producto repetido en la compra");
      one("SELECT id FROM productos WHERE empresa_id=? AND id=?", empresa, l.productoId());
      BigDecimal amount =
          l.costo().multiply(BigDecimal.valueOf(l.cantidad())).setScale(2, RoundingMode.HALF_UP);
      BigDecimal net =
          !gravada
              ? amount
              : incluye ? amount.divide(new BigDecimal("1.18"), 2, RoundingMode.HALF_UP) : amount;
      BigDecimal tax =
          !gravada
              ? BigDecimal.ZERO
              : incluye
                  ? amount.subtract(net)
                  : net.multiply(new BigDecimal("0.18")).setScale(2, RoundingMode.HALF_UP);
      base = base.add(net);
      igv = igv.add(tax);
      total = total.add(net).add(tax);
    }
    checkTotal(total);
    Long id =
        db.queryForObject(
            "INSERT INTO"
                + " compras(empresa_id,proveedor,referencia,total,idempotencia,subtotal,igv,proveedor_ruc,tipo_documento,credito_fiscal,gravada,costo_incluye_igv)"
                + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            empresa,
            r.proveedor().trim(),
            r.referencia().trim(),
            total,
            r.idempotencia(),
            base,
            igv,
            proveedorRuc,
            tipo,
            Boolean.TRUE.equals(r.creditoFiscal()),
            gravada,
            incluye);
    for (var l : r.lineas()) {
      BigDecimal costoNeto =
          gravada && incluye
              ? l.costo().divide(new BigDecimal("1.18"), 6, RoundingMode.HALF_UP)
              : l.costo();
      db.update(
          "INSERT INTO compra_detalles(compra_id,producto_id,cantidad,costo,costo_neto) VALUES"
              + " (?,?,?,?,?)",
          id,
          l.productoId(),
          l.cantidad(),
          l.costo(),
          costoNeto);
      db.update(
          "UPDATE productos SET ultimo_costo=? WHERE empresa_id=? AND id=?",
          costoNeto,
          empresa,
          l.productoId());
      mover(p, l.productoId(), l.cantidad(), "COMPRA", r.referencia());
    }
    return one("SELECT * FROM compras WHERE empresa_id=? AND id=?", empresa, id);
  }

  private void checkTotal(BigDecimal total) {
    if (total.compareTo(new BigDecimal("999999999999.99")) > 0)
      throw error("El total excede el máximo permitido");
  }

  public Map<String, Object> resumen(Long empresa) {
    var r =
        one(
            "SELECT COUNT(*) AS productos,COUNT(*) FILTER (WHERE stock<=minimo AND activo) AS"
                + " stock_bajo,COALESCE(SUM(precio*stock),0) AS valor_inventario FROM productos"
                + " WHERE empresa_id=?",
            empresa);
    r.putAll(
        one(
            "SELECT COALESCE(SUM(total) FILTER (WHERE estado='CONFIRMADA'),0) AS"
                + " ventas_total,COUNT(*) FILTER (WHERE estado='CONFIRMADA') AS"
                + " ventas_cantidad,COUNT(*) FILTER (WHERE estado='CONFIRMADA' AND"
                + " estado_fiscal='PENDIENTE_CONFIGURACION') AS pendientes_fiscales FROM ventas"
                + " WHERE empresa_id=?",
            empresa));
    return r;
  }
}
