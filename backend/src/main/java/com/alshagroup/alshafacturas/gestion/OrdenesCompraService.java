package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.comercial.*;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import com.alshagroup.alshafacturas.visual.AlcanceDatos;
import jakarta.validation.constraints.*;
import java.math.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrdenesCompraService {
  private final JdbcTemplate db;
  private final ComercialService comercial;
  private final AuditoriaService audit;
  private final tools.jackson.databind.json.JsonMapper json =
      tools.jackson.databind.json.JsonMapper.builder().build();

  public OrdenesCompraService(JdbcTemplate db, ComercialService comercial, AuditoriaService audit) {
    this.db = db;
    this.comercial = comercial;
    this.audit = audit;
  }

  public Map<String, Object> target(UsuarioPrincipal p, String tipo, Long id) {
    String tabla = "compras".equals(tipo) ? "compras" : "ordenes_compra";
    var rows =
        db.queryForList(
            "SELECT * FROM " + tabla + " WHERE empresa_id=? AND local_id=? AND id=?",
            p.getEmpresaId(),
            LocalesService.actual(),
            id);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Compra u orden no encontrada");
    if (!p.getPermisos().contains("COMPRAS_RECIBIR")
        || "compras".equals(tipo)
            && !Objects.equals(rows.getFirst().get("recibido_por_original_id"), p.getId()))
      AlcanceDatos.verificar(p, rows.getFirst(), "usuario_original_id");
    return rows.getFirst();
  }

  public Map<String, Object> compra(UsuarioPrincipal p, Long id) {
    var r = target(p, "compras", id);
    r.put(
        "lineas",
        db.queryForList(
            "SELECT d.*,p.nombre,p.sku FROM compra_detalles d JOIN productos p ON"
                + " p.id=d.producto_id WHERE d.compra_id=? ORDER BY d.id",
            id));
    r.put(
        "empresa",
        db.queryForMap(
            "SELECT razon_social,ruc,direccion FROM empresas WHERE id=?", p.getEmpresaId()));
    r.put(
        "local",
        db.queryForMap("SELECT nombre,direccion FROM locales WHERE id=?", LocalesService.actual()));
    return r;
  }

  public List<Map<String, Object>> ordenes(UsuarioPrincipal p) {
    return db.queryForList(
        "SELECT id,numero,proveedor,referencia,fecha,estado,total,compra_id,usuario_nombre FROM"
            + " ordenes_compra WHERE empresa_id=? AND local_id=? AND (? OR usuario_original_id=?)"
            + " ORDER BY id DESC LIMIT 200",
        new Object[] {
          p.getEmpresaId(),
          LocalesService.actual(),
          AlcanceDatos.equipo(p) || p.getPermisos().contains("COMPRAS_RECIBIR"),
          p.getId()
        });
  }

  public Map<String, Object> orden(UsuarioPrincipal p, Long id) {
    var r = target(p, "ordenes-compra", id);
    var datos = json.readValue(r.get("datos").toString(), Map.class);
    r.remove("recepcion_idempotencia");
    r.put("datos", datos.containsKey("compra") ? datos.get("compra") : datos);
    r.put("articulos", datos.getOrDefault("articulos", List.of()));
    return r;
  }

  @Transactional
  public Map<String, Object> crear(UsuarioPrincipal p, ComercialDtos.CompraRequest r) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var previous =
        db.queryForList(
            "SELECT id FROM ordenes_compra WHERE empresa_id=? AND idempotencia=?",
            Long.class,
            p.getEmpresaId(),
            r.idempotencia());
    String payload = json.writeValueAsString(r);
    if (!previous.isEmpty()) {
      var old = target(p, "ordenes-compra", previous.getFirst());
      AlcanceDatos.verificar(p, old, "usuario_original_id");
      if (!(json.readTree(old.get("datos").toString()).has("compra")
              ? json.readTree(old.get("datos").toString()).get("compra")
              : json.readTree(old.get("datos").toString()))
          .equals(json.readTree(payload)))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "La clave corresponde a otra orden de compra");
      return orden(p, previous.getFirst());
    }
    String documento = Objects.requireNonNullElse(r.tipoDocumento(), "INTERNO");
    boolean tieneRuc = r.proveedorRuc() != null && !r.proveedorRuc().isBlank();
    if ("FACTURA".equals(documento) && !tieneRuc)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "La factura de compra requiere RUC del proveedor");
    if (Boolean.TRUE.equals(r.creditoFiscal())
        && (!Boolean.TRUE.equals(r.gravada())
            || !"FACTURA".equals(documento)
            || !tieneRuc
            || db.queryForObject(
                    "SELECT ruc FROM empresas WHERE id=?", String.class, p.getEmpresaId())
                == null))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Revisa los requisitos del crédito fiscal potencial");
    var articulos = new ArrayList<Map<String, Object>>();
    BigDecimal total = BigDecimal.ZERO;
    var ids = new HashSet<Long>();
    for (var l : r.lineas()) {
      if (db.queryForObject(
              "SELECT count(*) FROM productos WHERE empresa_id=? AND local_id=? AND id=? AND"
                  + " clase='SERVICIO'",
              Long.class,
              p.getEmpresaId(),
              LocalesService.actual(),
              l.productoId())
          > 0)
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Un servicio no puede ingresar como mercadería");
      if (!ids.add(l.productoId()))
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Artículo repetido");
      if (db.queryForObject(
              "SELECT count(*) FROM productos WHERE empresa_id=? AND local_id=? AND id=? AND"
                  + " clase='PRODUCTO'",
              Long.class,
              p.getEmpresaId(),
              LocalesService.actual(),
              l.productoId())
          != 1)
        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND, "Artículo no disponible en este local");
      var articulo = db.queryForMap("SELECT nombre,sku FROM productos WHERE id=?", l.productoId());
      articulo.put("cantidad", l.cantidad());
      articulo.put("costo", l.costo());
      articulo.put("productoId", l.productoId());
      articulos.add(articulo);
      BigDecimal amount =
          l.costo().multiply(BigDecimal.valueOf(l.cantidad())).setScale(2, RoundingMode.HALF_UP);
      if (Boolean.TRUE.equals(r.gravada()) && Boolean.FALSE.equals(r.costoIncluyeIgv()))
        amount =
            amount.add(amount.multiply(new BigDecimal("0.18")).setScale(2, RoundingMode.HALF_UP));
      total = total.add(amount);
    }
    if (total.compareTo(new BigDecimal("999999999999.99")) > 0)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Importe fuera de límite");
    if (db.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM ordenes_compra WHERE empresa_id=? AND local_id=? AND"
            + " proveedor=? AND referencia=? AND estado<>'CANCELADA') OR EXISTS(SELECT 1 FROM"
            + " compras WHERE empresa_id=? AND local_id=? AND proveedor=? AND referencia=?)",
        Boolean.class,
        p.getEmpresaId(),
        LocalesService.actual(),
        r.proveedor().trim(),
        r.referencia().trim(),
        p.getEmpresaId(),
        LocalesService.actual(),
        r.proveedor().trim(),
        r.referencia().trim()))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "La referencia del proveedor ya está registrada en este local");
    long seq =
        db.queryForObject(
            "INSERT INTO correlativos(empresa_id,tipo,ultimo) VALUES (?,'ORDEN_COMPRA',1) ON"
                + " CONFLICT(empresa_id,tipo) DO UPDATE SET ultimo=correlativos.ultimo+1 RETURNING"
                + " ultimo",
            Long.class,
            p.getEmpresaId());
    String numero = "OC-" + String.format(Locale.ROOT, "%08d", seq);
    Long id =
        db.queryForObject(
            "INSERT INTO"
                + " ordenes_compra(empresa_id,local_id,numero,proveedor,referencia,usuario_id,usuario_original_id,usuario_nombre,datos,total,idempotencia)"
                + " VALUES (?,?,?,?,?,?,?,?,?::jsonb,?,?) RETURNING id",
            Long.class,
            p.getEmpresaId(),
            LocalesService.actual(),
            numero,
            r.proveedor().trim(),
            r.referencia().trim(),
            p.getId(),
            p.getId(),
            p.getNombre(),
            json.writeValueAsString(Map.of("compra", r, "articulos", articulos)),
            total,
            r.idempotencia());
    audit.registrar(
        p, p.getEmpresaId(), LocalesService.actual(), "ORDEN_COMPRA_CREADA", id, numero);
    return orden(p, id);
  }

  public record Recepcion(
      @NotBlank @Size(max = 120) String documento,
      @AssertTrue(message = "Confirma la verificación física") boolean conforme) {}

  @Transactional
  public Map<String, Object> recibir(UsuarioPrincipal p, Long id, Recepcion recepcion) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var r = target(p, "ordenes-compra", id);
    if (r.get("compra_id") != null) {
      if (!Objects.equals(r.get("documento_recepcion"), recepcion.documento().strip()))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "La recepción ya tiene otro documento registrado");
      return compra(p, ((Number) r.get("compra_id")).longValue());
    }
    if (!"PENDIENTE".equals(r.get("estado")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "La orden está cancelada");
    var node = json.readTree(r.get("datos").toString());
    var input =
        json.readValue(
            node.has("compra") ? node.get("compra").toString() : node.toString(), Map.class);
    input.put("idempotencia", r.get("recepcion_idempotencia").toString());
    var request = json.readValue(json.writeValueAsString(input), ComercialDtos.CompraRequest.class);
    var result = comercial.comprar(p, request);
    db.update(
        "UPDATE ordenes_compra SET"
            + " estado='RECIBIDA',compra_id=?,documento_recepcion=?,recibido_por_original_id=?,recibido_nombre=?,recibido_en=CURRENT_TIMESTAMP"
            + " WHERE id=?",
        result.get("id"),
        recepcion.documento().strip(),
        p.getId(),
        p.getNombre(),
        id);
    db.update(
        "UPDATE compras SET"
            + " usuario_original_id=?,usuario_nombre=?,fecha=?,documento_recepcion=?,recibido_por_original_id=?,recibido_nombre=?,recibido_en=CURRENT_TIMESTAMP,orden_numero=?"
            + " WHERE id=?",
        r.get("usuario_original_id"),
        r.get("usuario_nombre"),
        r.get("fecha"),
        recepcion.documento().strip(),
        p.getId(),
        p.getNombre(),
        r.get("numero"),
        result.get("id"));
    audit.registrar(
        p,
        p.getEmpresaId(),
        LocalesService.actual(),
        "ORDEN_COMPRA_RECIBIDA",
        id,
        "Compra=" + result.get("id"));
    return compra(p, ((Number) result.get("id")).longValue());
  }
}
