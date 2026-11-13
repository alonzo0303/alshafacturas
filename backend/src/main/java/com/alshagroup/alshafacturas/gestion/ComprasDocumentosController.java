package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.comercial.*;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.io.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasAuthority('COMPRAS_GESTIONAR')")
public class ComprasDocumentosController {
  private final JdbcTemplate db;
  private final ComercialService comercial;
  private final AuditoriaService audit;
  private final tools.jackson.databind.json.JsonMapper json =
      tools.jackson.databind.json.JsonMapper.builder().build();

  public ComprasDocumentosController(
      JdbcTemplate db, ComercialService comercial, AuditoriaService audit) {
    this.db = db;
    this.comercial = comercial;
    this.audit = audit;
  }

  private Map<String, Object> target(UsuarioPrincipal p, String tipo, Long id) {
    String tabla = "compras".equals(tipo) ? "compras" : "ordenes_compra";
    var rows =
        db.queryForList(
            "SELECT * FROM " + tabla + " WHERE empresa_id=? AND local_id=? AND id=?",
            p.getEmpresaId(),
            LocalesService.actual(),
            id);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Compra u orden no encontrada");
    return rows.getFirst();
  }

  @GetMapping("/compras/{id}")
  public Map<String, Object> compra(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
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

  @GetMapping("/ordenes-compra")
  public List<Map<String, Object>> ordenes(@AuthenticationPrincipal UsuarioPrincipal p) {
    return db.queryForList(
        "SELECT id,numero,proveedor,referencia,fecha,estado,total,compra_id,usuario_nombre FROM"
            + " ordenes_compra WHERE empresa_id=? AND local_id=? ORDER BY id DESC LIMIT 200",
        p.getEmpresaId(),
        LocalesService.actual());
  }

  @GetMapping("/ordenes-compra/{id}")
  public Map<String, Object> orden(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    var r = target(p, "ordenes-compra", id);
    var datos = json.readValue(r.get("datos").toString(), Map.class);
    r.remove("recepcion_idempotencia");
    r.put("datos", datos.containsKey("compra") ? datos.get("compra") : datos);
    r.put("articulos", datos.getOrDefault("articulos", List.of()));
    return r;
  }

  @PostMapping("/ordenes-compra")
  @Transactional
  public Map<String, Object> crear(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @Valid @RequestBody ComercialDtos.CompraRequest r) {
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

  @PostMapping("/ordenes-compra/{id}/recibir")
  @Transactional
  public Map<String, Object> recibir(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var r = target(p, "ordenes-compra", id);
    if (r.get("compra_id") != null) return compra(p, ((Number) r.get("compra_id")).longValue());
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
        "UPDATE ordenes_compra SET estado='RECIBIDA',compra_id=? WHERE id=?", result.get("id"), id);
    audit.registrar(
        p,
        p.getEmpresaId(),
        LocalesService.actual(),
        "ORDEN_COMPRA_RECIBIDA",
        id,
        "Compra=" + result.get("id"));
    return result;
  }

  @PostMapping("/ordenes-compra/{id}/cancelar")
  @Transactional
  public void cancelar(@AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    var r = target(p, "ordenes-compra", id);
    if (!"PENDIENTE".equals(r.get("estado")))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "La orden ya no está pendiente");
    db.update("UPDATE ordenes_compra SET estado='CANCELADA' WHERE id=?", id);
    audit.registrar(p, p.getEmpresaId(), LocalesService.actual(), "ORDEN_COMPRA_CANCELADA", id, "");
  }

  @GetMapping("/{tipo:compras|ordenes-compra}/{id}/documentos")
  public List<Map<String, Object>> documentos(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable String tipo,
      @PathVariable Long id) {
    target(p, tipo, id);
    String where =
        "compras".equals(tipo)
            ? "(compra_id=? OR orden_id IN (SELECT id FROM ordenes_compra WHERE compra_id=?))"
            : "orden_id=?";
    Object[] args =
        "compras".equals(tipo)
            ? new Object[] {p.getEmpresaId(), LocalesService.actual(), id, id}
            : new Object[] {p.getEmpresaId(), LocalesService.actual(), id};
    return db.queryForList(
        "SELECT id,nombre,tipo,clase,octet_length(contenido) AS bytes,fecha,sha256 FROM"
            + " documentos_compra WHERE empresa_id=? AND local_id=? AND "
            + where
            + " ORDER BY id",
        args);
  }

  private byte[] imagen(byte[] bytes) {
    try (var in = javax.imageio.ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
      var readers = javax.imageio.ImageIO.getImageReaders(in);
      if (!readers.hasNext()) throw new IOException();
      var reader = readers.next();
      try {
        reader.setInput(in);
        int w = reader.getWidth(0), h = reader.getHeight(0);
        if (w < 1 || h < 1 || w > 4096 || h > 4096) throw new IOException();
        var original = reader.read(0);
        var clean =
            new java.awt.image.BufferedImage(w, h, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var g = clean.createGraphics();
        try {
          g.setColor(java.awt.Color.WHITE);
          g.fillRect(0, 0, w, h);
          g.drawImage(original, 0, 0, null);
        } finally {
          g.dispose();
        }
        var out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(clean, "jpg", out);
        return out.toByteArray();
      } finally {
        reader.dispose();
      }
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "La imagen no es válida o excede 4096 × 4096 píxeles");
    }
  }

  @PutMapping(
      value = "/{tipo:compras|ordenes-compra}/{id}/documentos",
      consumes = {"application/pdf", "image/jpeg", "image/png"})
  @Transactional
  public Map<String, Object> subir(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable String tipo,
      @PathVariable Long id,
      @RequestParam @Size(max = 150) String nombre,
      @RequestParam @Pattern(regexp = "FACTURA|ORDEN_COMPRA|OTRO") String clase,
      HttpServletRequest req)
      throws Exception {
    byte[] raw = req.getInputStream().readNBytes(10485761);
    if (raw.length < 1 || raw.length > 10485760)
      throw new ResponseStatusException(
          HttpStatus.PAYLOAD_TOO_LARGE, "El documento debe pesar hasta 10 MB");
    boolean pdf = "application/pdf".equals(req.getContentType());
    byte[] clean;
    if (pdf) {
      String head = new String(raw, 0, Math.min(raw.length, 8), StandardCharsets.US_ASCII);
      String end =
          new String(
              raw,
              Math.max(0, raw.length - 4096),
              Math.min(raw.length, 4096),
              StandardCharsets.ISO_8859_1);
      if (!head.startsWith("%PDF-") || !end.contains("%%EOF"))
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El archivo no tiene estructura PDF válida");
      clean = raw;
    } else clean = imagen(raw);
    if (clean.length > 10485760)
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Documento demasiado grande");
    String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(clean));
    String file = nombre.replaceAll("[^\\p{L}\\p{N}._ -]", "_").trim();
    if (file.isEmpty()) file = "documento";
    if (file.length() > 140) file = file.substring(0, 140);
    file = file.replaceAll("\\.(?i:pdf|png|jpe?g)$", "") + (pdf ? ".pdf" : ".jpg");
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    target(p, tipo, id);
    String key = "compras".equals(tipo) ? "compra_id" : "orden_id";
    var duplicate =
        db.queryForList(
            "SELECT id,nombre FROM documentos_compra WHERE empresa_id=? AND local_id=? AND "
                + key
                + "=? AND sha256=?",
            p.getEmpresaId(),
            LocalesService.actual(),
            id,
            hash);
    if (!duplicate.isEmpty()) return duplicate.getFirst();
    if (db.queryForObject(
            "SELECT count(*) FROM documentos_compra WHERE " + key + "=?", Long.class, id)
        >= 10)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Se permiten hasta diez documentos por registro");
    Long document =
        db.queryForObject(
            "INSERT INTO documentos_compra(empresa_id,local_id,"
                + key
                + ",clase,nombre,tipo,contenido,sha256,usuario_original_id) VALUES"
                + " (?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            p.getEmpresaId(),
            LocalesService.actual(),
            id,
            clase,
            file,
            pdf ? "application/pdf" : "image/jpeg",
            clean,
            hash,
            p.getId());
    audit.registrar(
        p,
        p.getEmpresaId(),
        LocalesService.actual(),
        "DOCUMENTO_COMPRA_ADJUNTO",
        document,
        "Registro=" + tipo + "/" + id + ", SHA-256=" + hash);
    return Map.of("id", document, "nombre", file);
  }

  @GetMapping("/documentos-compra/{id}")
  public ResponseEntity<byte[]> descargar(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    var rows =
        db.queryForList(
            "SELECT * FROM documentos_compra WHERE empresa_id=? AND local_id=? AND id=?",
            p.getEmpresaId(),
            LocalesService.actual(),
            id);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Documento no encontrado");
    var r = rows.getFirst();
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(r.get("tipo").toString()))
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment()
                .filename(r.get("nombre").toString(), StandardCharsets.UTF_8)
                .build()
                .toString())
        .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "default-src 'none'; sandbox")
        .body((byte[]) r.get("contenido"));
  }
}
