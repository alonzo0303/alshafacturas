package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ImagenController {
  private final JdbcTemplate db;
  private final RubrosService rubros;

  public ImagenController(JdbcTemplate db, RubrosService rubros) {
    this.db = db;
    this.rubros = rubros;
  }

  private void existe(String tipo, Long id, UsuarioPrincipal p, boolean escribir) {
    boolean catalogo = tipo.equals("catalogo-comun");
    var rows =
        db.queryForList(
            catalogo
                ? "SELECT id FROM catalogo_comun WHERE id=?"
                : "SELECT id FROM productos WHERE id=? AND empresa_id=?",
            catalogo ? new Object[] {id} : new Object[] {id, p.getEmpresaId()});
    if (rows.isEmpty()
        || catalogo && !"SUPERADMIN".equals(p.getRol()) && !rubros.permitido(p.getEmpresaId(), id))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Imagen o producto no disponible");
  }

  private String tabla(String tipo) {
    return tipo.equals("productos") ? "fotos_productos" : "fotos_catalogo";
  }

  private String clave(String tipo) {
    return tipo.equals("productos") ? "producto_id" : "catalogo_id";
  }

  private byte[] validar(byte[] bytes) {
    if (bytes.length == 0 || bytes.length > 2 * 1024 * 1024)
      throw new ResponseStatusException(
          HttpStatus.PAYLOAD_TOO_LARGE, "La imagen debe pesar entre 1 byte y 2 MB");
    try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
      var readers = ImageIO.getImageReaders(stream);
      if (!readers.hasNext()) throw new IOException();
      var reader = readers.next();
      try {
        reader.setInput(stream);
        String format = reader.getFormatName();
        if (!Set.of("JPEG", "JPG", "PNG").contains(format.toUpperCase(Locale.ROOT)))
          throw new IOException();
        int w = reader.getWidth(0), h = reader.getHeight(0);
        if (w < 1 || h < 1 || w > 2048 || h > 2048) throw new IOException();
        var image = reader.read(0);
        var clean = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        var g = clean.createGraphics();
        try {
          g.setColor(Color.WHITE);
          g.fillRect(0, 0, w, h);
          g.drawImage(image, 0, 0, null);
        } finally {
          g.dispose();
        }
        var output = new ByteArrayOutputStream();
        ImageIO.write(clean, "jpg", output);
        return output.toByteArray();
      } finally {
        reader.dispose();
      }
    } catch (IOException | RuntimeException e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Usa una imagen JPEG o PNG válida de hasta 2048 × 2048 píxeles");
    }
  }

  @GetMapping("/{tipo:productos|catalogo-comun}/{id}/imagen")
  @PreAuthorize("hasRole('SUPERADMIN') or hasAuthority('PRODUCTOS_VER')")
  public ResponseEntity<byte[]> imagen(
      @PathVariable String tipo,
      @PathVariable Long id,
      @AuthenticationPrincipal UsuarioPrincipal p) {
    existe(tipo, id, p, false);
    var rows =
        db.queryForList(
            "SELECT contenido FROM " + tabla(tipo) + " WHERE " + clave(tipo) + "=?", id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Sin imagen");
    return ResponseEntity.ok()
        .contentType(MediaType.IMAGE_JPEG)
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .body((byte[]) rows.getFirst().get("contenido"));
  }

  @PutMapping(
      value = "/{tipo:productos|catalogo-comun}/{id}/imagen",
      consumes = {"image/jpeg", "image/png"})
  @PreAuthorize(
      "(#tipo == 'catalogo-comun' and hasRole('SUPERADMIN')) or (#tipo == 'productos' and"
          + " hasAuthority('PRODUCTOS_EDITAR'))")
  public Map<String, Object> guardar(
      @PathVariable String tipo,
      @PathVariable Long id,
      @AuthenticationPrincipal UsuarioPrincipal p,
      jakarta.servlet.http.HttpServletRequest request)
      throws IOException {
    byte[] bytes = request.getInputStream().readNBytes(2 * 1024 * 1024 + 1);
    existe(tipo, id, p, true);
    var clean = validar(bytes);
    var version = UUID.randomUUID();
    db.update(
        "INSERT INTO "
            + tabla(tipo)
            + "("
            + clave(tipo)
            + ",contenido,version) VALUES (?,?,?) ON CONFLICT("
            + clave(tipo)
            + ") DO UPDATE SET contenido=EXCLUDED.contenido,version=EXCLUDED.version",
        id,
        clean,
        version);
    return Map.of("imagen_version", version);
  }

  @DeleteMapping("/{tipo:productos|catalogo-comun}/{id}/imagen")
  @PreAuthorize(
      "(#tipo == 'catalogo-comun' and hasRole('SUPERADMIN')) or (#tipo == 'productos' and"
          + " hasAuthority('PRODUCTOS_EDITAR'))")
  public void quitar(
      @PathVariable String tipo,
      @PathVariable Long id,
      @AuthenticationPrincipal UsuarioPrincipal p) {
    existe(tipo, id, p, true);
    db.update("DELETE FROM " + tabla(tipo) + " WHERE " + clave(tipo) + "=?", id);
  }
}
