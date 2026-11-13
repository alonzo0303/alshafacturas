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
  private final com.alshagroup.alshafacturas.gestion.CajaService cajas;
  private final com.alshagroup.alshafacturas.gestion.AuditoriaService audit;

  private static long local() {
    return com.alshagroup.alshafacturas.gestion.LocalesService.actual();
  }

  public ComercialService(
      JdbcTemplate db,
      com.alshagroup.alshafacturas.gestion.CajaService cajas,
      com.alshagroup.alshafacturas.gestion.AuditoriaService audit) {
    this.db = db;
    this.cajas = cajas;
    this.audit = audit;
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
        "SELECT p.*,(SELECT version FROM fotos_productos f WHERE f.producto_id=p.id) AS"
            + " imagen_version,CASE WHEN afectacion_igv='GRAVADO' THEN round(precio/1.18,2) ELSE"
            + " precio END AS precio_sin_igv FROM productos p WHERE clase='PRODUCTO' AND local_id="
            + local()
            + " AND empresa_id=? ORDER BY"
            + " nombre,id",
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
    boolean nuevo = id == null;
    Map<String, Object> plantilla = null;
    if (r.catalogoId() != null
        && (nuevo
            || !Objects.equals(
                one(
                        "SELECT catalogo_id FROM productos WHERE local_id="
                            + local()
                            + " AND empresa_id=? AND id=?",
                        empresa,
                        id)
                    .get("catalogo_id"),
                r.catalogoId()))) {
      plantilla =
          one(
              "SELECT c.id,c.marca FROM catalogo_comun c JOIN empresa_rubros_catalogo a ON"
                  + " a.rubro=c.rubro WHERE a.empresa_id=? AND c.id=? AND c.activo=true",
              empresa,
              r.catalogoId());
    }
    String marca =
        normalized(
            r.marca(), nuevo && plantilla != null ? plantilla.get("marca").toString() : "Genérico");
    if (id == null)
      id =
          db.queryForObject(
              "INSERT INTO"
                  + " productos(local_id,empresa_id,sku,nombre,precio,minimo,activo,marca,categoria,presentacion,codigo_barras,catalogo_id,afectacion_igv)"
                  + " VALUES ("
                  + local()
                  + ",?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
              Long.class,
              empresa,
              sku,
              r.nombre().trim(),
              precio,
              r.minimo(),
              r.activo(),
              marca,
              normalized(r.categoria(), "General"),
              normalized(r.presentacion(), ""),
              normalized(r.codigoBarras(), null),
              r.catalogoId(),
              afectacion);
    else {
      one(
          "SELECT id FROM productos WHERE local_id=" + local() + " AND empresa_id=? AND id=?",
          empresa,
          id);
      db.update(
          "UPDATE productos SET"
              + " sku=?,nombre=?,precio=?,minimo=?,activo=?,marca=?,categoria=?,presentacion=?,codigo_barras=?,catalogo_id=?,afectacion_igv=?"
              + " WHERE local_id="
              + local()
              + " AND empresa_id=? AND id=?",
          sku,
          r.nombre().trim(),
          precio,
          r.minimo(),
          r.activo(),
          marca,
          normalized(r.categoria(), "General"),
          normalized(r.presentacion(), ""),
          normalized(r.codigoBarras(), null),
          r.catalogoId(),
          afectacion,
          empresa,
          id);
    }
    if (nuevo && r.catalogoId() != null)
      db.update(
          "INSERT INTO fotos_productos(producto_id,contenido,version) SELECT ?,contenido,? FROM"
              + " fotos_catalogo WHERE catalogo_id=?",
          id,
          UUID.randomUUID(),
          r.catalogoId());
    return one(
        "SELECT p.*,(SELECT version FROM fotos_productos f WHERE f.producto_id=p.id) AS"
            + " imagen_version FROM productos p WHERE local_id="
            + local()
            + " AND empresa_id=? AND id=?",
        empresa,
        id);
  }

  public List<Map<String, Object>> clientes(Long empresa) {
    return db.queryForList(
        "SELECT * FROM clientes WHERE local_id=" + local() + " AND empresa_id=? ORDER BY nombre,id",
        empresa);
  }

  @Transactional
  public Map<String, Object> cliente(Long empresa, Long id, ClienteRequest r) {
    if (id == null)
      id =
          db.queryForObject(
              "INSERT INTO clientes(local_id,empresa_id,documento,nombre,correo,direccion) VALUES"
                  + " ("
                  + local()
                  + ",?,?,?,?,?) RETURNING id",
              Long.class,
              empresa,
              r.documento(),
              r.nombre().trim(),
              r.correo(),
              r.direccion());
    else {
      one(
          "SELECT id FROM clientes WHERE local_id=" + local() + " AND empresa_id=? AND id=?",
          empresa,
          id);
      db.update(
          "UPDATE clientes SET documento=?,nombre=?,correo=?,direccion=? WHERE local_id="
              + local()
              + " AND empresa_id=? AND"
              + " id=?",
          r.documento(),
          r.nombre().trim(),
          r.correo(),
          r.direccion(),
          empresa,
          id);
    }
    return one(
        "SELECT * FROM clientes WHERE local_id=" + local() + " AND empresa_id=? AND id=?",
        empresa,
        id);
  }

  public List<Map<String, Object>> movimientos(Long empresa) {
    return db.queryForList(
        "SELECT m.*,p.nombre,p.sku FROM movimientos m JOIN productos p ON p.id=m.producto_id WHERE"
            + " m.local_id="
            + local()
            + " AND m.empresa_id=? ORDER BY m.id DESC LIMIT 500",
        empresa);
  }

  private void mover(UsuarioPrincipal p, Long producto, int cantidad, String tipo, String motivo) {
    var row =
        one(
            "SELECT stock,clase FROM productos WHERE local_id="
                + local()
                + " AND empresa_id=? AND id=? FOR UPDATE",
            p.getEmpresaId(),
            producto);
    if ("SERVICIO".equals(row.get("clase"))) {
      if (!Set.of("VENTA", "ANULACION").contains(tipo))
        throw error("Los servicios no tienen existencias");
      return;
    }
    long saldo = ((Number) row.get("stock")).longValue() + cantidad;
    if (saldo < 0 || saldo > 1000000000)
      throw error("Stock insuficiente o cantidad fuera de rango");
    db.update(
        "UPDATE productos SET stock=? WHERE local_id=" + local() + " AND empresa_id=? AND id=?",
        saldo,
        p.getEmpresaId(),
        producto);
    db.update(
        "INSERT INTO"
            + " movimientos(local_id,empresa_id,producto_id,usuario_id,tipo,cantidad,saldo,motivo,usuario_original_id,usuario_nombre)"
            + " VALUES ("
            + local()
            + ",?,?,?,?,?,?,?,?,?)",
        p.getEmpresaId(),
        producto,
        p.getId(),
        tipo,
        cantidad,
        saldo,
        motivo,
        p.getId(),
        p.getNombre());
  }

  @Transactional
  public void ajuste(UsuarioPrincipal p, AjusteRequest r) {
    if (r.cantidad() == 0) throw error("El ajuste debe ser distinto de cero");
    lock(p.getEmpresaId());
    mover(p, r.productoId(), r.cantidad(), "AJUSTE", r.motivo().trim());
  }

  public List<Map<String, Object>> ventas(Long empresa) {
    return db.queryForList(
        "SELECT v.*,c.nombre AS cliente,EXISTS(SELECT 1 FROM venta_detalles d JOIN productos pr ON"
            + " pr.id=d.producto_id WHERE d.venta_id=v.id AND d.clase='PRODUCTO' AND"
            + " pr.stock<=pr.minimo AND pr.activo) AS stock_alerta,EXISTS(SELECT 1 FROM"
            + " venta_detalles d WHERE d.venta_id=v.id AND d.clase='PRODUCTO') AS tiene_productos"
            + " FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id WHERE v.local_id="
            + local()
            + " AND v.empresa_id=? ORDER BY v.id DESC LIMIT 500",
        empresa);
  }

  public Map<String, Object> venta(Long empresa, Long id) {
    var v =
        one(
            "SELECT v.*,c.nombre AS cliente,c.documento AS"
                + " cliente_documento,e.razon_social,e.ruc,e.direccion,l.nombre AS"
                + " local_nombre,l.direccion AS local_direccion FROM ventas v JOIN locales l ON"
                + " l.id=v.local_id JOIN empresas e ON e.id=v.empresa_id LEFT JOIN clientes c ON"
                + " c.id=v.cliente_id WHERE v.local_id="
                + local()
                + " AND v.empresa_id=? AND v.id=?",
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
            "SELECT id FROM ventas WHERE local_id="
                + local()
                + " AND empresa_id=? AND idempotencia=?",
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
    Long caja = cajas.paraVenta(p);
    if (!"TICKET".equals(r.tipo())
        && db.queryForObject("SELECT ruc FROM empresas WHERE id=?", String.class, empresa) == null)
      throw error(
          "El negocio necesita RUC para solicitar facturas o boletas. Puedes registrar una nota de"
              + " venta interna");
    if (r.clienteId() != null) {
      var c =
          one(
              "SELECT * FROM clientes WHERE local_id=" + local() + " AND empresa_id=? AND id=?",
              empresa,
              r.clienteId());
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
              "SELECT * FROM productos WHERE local_id="
                  + local()
                  + " AND empresa_id=? AND id=? AND activo=true FOR UPDATE",
              empresa,
              l.productoId());
      if (!"TICKET".equals(r.tipo()) && "SIN_IGV".equals(prod.get("afectacion_igv")))
        throw error(
            "Configura el tratamiento tributario de "
                + prod.get("nombre")
                + " antes de emitir un documento fiscal");
      if (((BigDecimal) prod.get("precio")).signum() <= 0)
        throw error("Define el precio de venta de " + prod.get("nombre") + " antes de vender");
      if (!"SERVICIO".equals(prod.get("clase"))
          && ((Number) prod.get("stock")).intValue() < l.cantidad())
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
                + " ventas(local_id,empresa_id,usuario_id,cliente_id,numero,tipo,estado_fiscal,metodo_pago,subtotal,igv,total,idempotencia,usuario_original_id,usuario_nombre,caja_id)"
                + " VALUES ("
                + local()
                + ",?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
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
            r.idempotencia(),
            p.getId(),
            p.getNombre(),
            caja);
    for (var l : lineas) {
      Long producto = ((Number) l.get("id")).longValue();
      int cantidad = ((Number) l.get("cantidad")).intValue();
      db.update(
          "INSERT INTO"
              + " venta_detalles(venta_id,producto_id,sku,nombre,cantidad,precio,total,base,igv,afectacion_igv,clase,es_comida)"
              + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          producto,
          l.get("sku"),
          l.get("nombre"),
          cantidad,
          l.get("precio"),
          l.get("importe"),
          l.get("base_linea"),
          l.get("igv_linea"),
          l.get("afectacion_igv"),
          l.get("clase"),
          l.get("es_comida"));
      mover(p, producto, -cantidad, "VENTA", numero);
    }
    audit.registrar(p, empresa, local(), "VENTA_CONFIRMADA", id, numero + ", total=" + total);
    return venta(empresa, id);
  }

  @Transactional
  public Map<String, Object> anular(UsuarioPrincipal p, Long id, String motivo) {
    lock(p.getEmpresaId());
    var v = venta(p.getEmpresaId(), id);
    if ("ANULADA".equals(v.get("estado"))) return v;
    cajas.validarAnulacion(v.get("caja_id"));
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
        "UPDATE ventas SET estado='ANULADA',motivo_anulacion=? WHERE local_id="
            + local()
            + " AND empresa_id=? AND id=?",
        motivo,
        p.getEmpresaId(),
        id);
    audit.registrar(p, p.getEmpresaId(), local(), "VENTA_ANULADA", id, motivo);
    return venta(p.getEmpresaId(), id);
  }

  public List<Map<String, Object>> compras(Long empresa) {
    return db.queryForList(
        "SELECT * FROM compras WHERE local_id="
            + local()
            + " AND empresa_id=? ORDER BY id DESC LIMIT 500",
        empresa);
  }

  @Transactional
  public Map<String, Object> comprar(UsuarioPrincipal p, CompraRequest r) {
    Long empresa = p.getEmpresaId();
    lock(empresa);
    var existing =
        db.queryForList(
            "SELECT * FROM compras WHERE local_id="
                + local()
                + " AND empresa_id=? AND idempotencia=?",
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
      one(
          "SELECT id FROM productos WHERE local_id=" + local() + " AND empresa_id=? AND id=?",
          empresa,
          l.productoId());
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
                + " compras(local_id,empresa_id,proveedor,referencia,total,idempotencia,subtotal,igv,proveedor_ruc,tipo_documento,credito_fiscal,gravada,costo_incluye_igv,usuario_original_id,usuario_nombre)"
                + " VALUES ("
                + local()
                + ",?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
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
            incluye,
            p.getId(),
            p.getNombre());
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
          "UPDATE productos SET ultimo_costo=? WHERE local_id="
              + local()
              + " AND empresa_id=? AND id=?",
          costoNeto,
          empresa,
          l.productoId());
      mover(p, l.productoId(), l.cantidad(), "COMPRA", r.referencia());
    }
    audit.registrar(p, empresa, local(), "COMPRA_REGISTRADA", id, r.referencia());
    return one(
        "SELECT * FROM compras WHERE local_id=" + local() + " AND empresa_id=? AND id=?",
        empresa,
        id);
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
                + " WHERE clase='PRODUCTO' AND local_id="
                + local()
                + " AND empresa_id=?",
            empresa);
    r.putAll(
        one(
            "SELECT COALESCE(SUM(total) FILTER (WHERE estado='CONFIRMADA'),0) AS"
                + " ventas_total,COUNT(*) FILTER (WHERE estado='CONFIRMADA') AS"
                + " ventas_cantidad,COUNT(*) FILTER (WHERE estado='CONFIRMADA' AND"
                + " estado_fiscal='PENDIENTE_CONFIGURACION') AS pendientes_fiscales FROM ventas"
                + " WHERE local_id="
                + local()
                + " AND empresa_id=?",
            empresa));
    return r;
  }
}
