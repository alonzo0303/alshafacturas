package com.alshagroup.alshafacturas.sunat;

import com.alshagroup.alshafacturas.comercial.ComercialService;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SunatService {
  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  private final SunatConfiguracion config;
  private final SunatSoapClient soap;
  private final ComercialService ventas;

  public SunatService(
      JdbcTemplate db,
      TransactionTemplate tx,
      SunatConfiguracion config,
      SunatSoapClient soap,
      ComercialService ventas) {
    this.db = db;
    this.tx = tx;
    this.config = config;
    this.soap = soap;
    this.ventas = ventas;
  }

  private ResponseStatusException error(String text) {
    return new ResponseStatusException(HttpStatus.CONFLICT, text);
  }

  private String ruc(UsuarioPrincipal p) {
    return db.queryForObject("SELECT ruc FROM empresas WHERE id=?", String.class, p.getEmpresaId());
  }

  public Map<String, Object> configuracion(UsuarioPrincipal p) {
    return config.estado(ruc(p));
  }

  public List<Map<String, Object>> listar(UsuarioPrincipal p) {
    return db.queryForList(
        "SELECT"
            + " c.id,c.venta_id,c.ambiente,c.tipo,c.numero,c.estado,c.ticket,c.codigo,c.mensaje,c.creado,c.actualizado,v.numero"
            + " AS venta_numero FROM comprobantes c JOIN ventas v ON v.id=c.venta_id WHERE"
            + " v.local_id="
            + com.alshagroup.alshafacturas.gestion.LocalesService.actual()
            + " AND c.empresa_id=? ORDER BY c.id DESC LIMIT 500",
        p.getEmpresaId());
  }

  private Map<String, Object> row(Long empresa, Long id) {
    var rows =
        db.queryForList(
            "SELECT * FROM comprobantes WHERE empresa_id=? AND id=?"
                + com.alshagroup.alshafacturas.gestion.LocalesService.filtroComprobante(),
            empresa,
            id);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Comprobante no encontrado");
    return rows.getFirst();
  }

  private Map<String, Object> publico(Long empresa, Long id) {
    var r = row(empresa, id);
    for (String k : List.of("xml_firmado", "resumen_firmado", "cdr")) r.remove(k);
    return r;
  }

  private long siguiente(Long empresa, String key, long last) {
    return db.queryForObject(
        "INSERT INTO correlativos(empresa_id,tipo,ultimo) VALUES (?,?,?) ON"
            + " CONFLICT(empresa_id,tipo) DO UPDATE SET ultimo=correlativos.ultimo+1 RETURNING"
            + " ultimo",
        Long.class,
        empresa,
        key,
        last + 1);
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> emitir(UsuarioPrincipal p, Long ventaId) {
    var cfg = config.cargar(ruc(p));
    Long empresa = p.getEmpresaId();
    var prepared =
        tx.execute(
            status -> {
              db.queryForObject(
                  "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
              var previous =
                  db.queryForList(
                      "SELECT id FROM comprobantes WHERE empresa_id=? AND venta_id=? AND"
                          + " ambiente=?",
                      empresa,
                      ventaId,
                      cfg.ambiente());
              if (!previous.isEmpty())
                return Map.<String, Object>of("id", previous.getFirst().get("id"), "nuevo", false);
              var v = ventas.venta(empresa, ventaId);
              if (!"CONFIRMADA".equals(v.get("estado")) || "TICKET".equals(v.get("tipo")))
                throw error("Selecciona una venta confirmada con solicitud de factura o boleta");
              String tipo = "FACTURA".equals(v.get("tipo")) ? "01" : "03";
              if ("01".equals(tipo)
                  && !Objects.toString(v.get("cliente_documento"), "").matches("[0-9]{11}"))
                throw error("La factura requiere cliente con RUC");
              if ("03".equals(tipo)
                  && new BigDecimal(v.get("total").toString()).compareTo(new BigDecimal("700")) >= 0
                  && v.get("cliente_documento") == null)
                throw error("Identifica al cliente para esta boleta");
              String serie = "01".equals(tipo) ? cfg.serieFactura() : cfg.serieBoleta();
              long n =
                  siguiente(
                      empresa,
                      ("BETA".equals(cfg.ambiente()) ? "B_" : "P_") + serie,
                      "01".equals(tipo) ? cfg.ultimoFactura() : cfg.ultimoBoleta());
              if (n > 99999999) throw error("Correlativo agotado; configura una nueva serie");
              String numero = serie + "-" + String.format(Locale.ROOT, "%08d", n),
                  filename = cfg.ruc() + "-" + tipo + "-" + numero;
              LocalDate fecha = LocalDate.now(ZoneId.of("America/Lima"));
              String resumen = null;
              byte[] resumenXml = null;
              try {
                byte[] xml =
                    SunatXml.invoice(
                        cfg, v, tipo, numero, fecha, (List<Map<String, Object>>) v.get("lineas"));
                if ("03".equals(tipo)) {
                  String day = fecha.format(DateTimeFormatter.BASIC_ISO_DATE);
                  long rc =
                      siguiente(empresa, ("BETA".equals(cfg.ambiente()) ? "RB" : "RP") + day, 0);
                  if (rc > 99999) throw error("Límite diario de resúmenes alcanzado");
                  resumen = "RC-" + day + "-" + String.format(Locale.ROOT, "%05d", rc);
                  resumenXml = SunatXml.summary(cfg, v, numero, resumen, fecha);
                }
                Long id =
                    db.queryForObject(
                        "INSERT INTO"
                            + " comprobantes(empresa_id,venta_id,ambiente,tipo,numero,nombre_archivo,resumen_id,xml_firmado,resumen_firmado,estado,mensaje)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,'ENVIANDO','Preparado para envío a"
                            + " SUNAT') RETURNING id",
                        Long.class,
                        empresa,
                        ventaId,
                        cfg.ambiente(),
                        tipo,
                        numero,
                        filename,
                        resumen,
                        xml,
                        resumenXml);
                db.update(
                    "UPDATE ventas SET estado_fiscal=? WHERE empresa_id=? AND id=?",
                    cfg.ambiente() + "_ENVIANDO",
                    empresa,
                    ventaId);
                return Map.<String, Object>of("id", id, "nuevo", true);
              } catch (ResponseStatusException e) {
                throw e;
              } catch (Exception e) {
                throw new ResponseStatusException(
                    HttpStatus.PRECONDITION_FAILED,
                    "Revisa el certificado RSA, su vigencia, contraseña y RUC; no se ha enviado el"
                        + " documento");
              }
            });
    Long id = ((Number) prepared.get("id")).longValue();
    if (Boolean.TRUE.equals(prepared.get("nuevo"))) enviar(empresa, id, cfg);
    return publico(empresa, id);
  }

  private void enviar(Long empresa, Long id, SunatConfiguracion.Datos cfg) {
    var c = row(empresa, id);
    boolean summary = "03".equals(c.get("tipo"));
    try {
      String name =
          summary ? cfg.ruc() + "-" + c.get("resumen_id") : c.get("nombre_archivo").toString();
      byte[] xml = (byte[]) c.get(summary ? "resumen_firmado" : "xml_firmado");
      var result =
          soap.call(
              cfg,
              summary ? "sendSummary" : "sendBill",
              Map.of(
                  "fileName",
                  name + ".zip",
                  "contentFile",
                  Base64.getEncoder().encodeToString(SunatXml.zip(name + ".xml", xml))));
      if (summary) {
        if (result.ticket() == null || !result.ticket().matches("[A-Za-z0-9-]{1,100}"))
          throw new IllegalStateException("Ticket inválido");
        guardar(
            empresa,
            id,
            "EN_PROCESO",
            null,
            "Resumen enviado; consulta el ticket para obtener el CDR",
            result.ticket(),
            null);
      } else aplicarCdr(empresa, id, c, result.contenido());
    } catch (Exception e) {
      guardar(
          empresa,
          id,
          "REVISAR",
          null,
          "No se obtuvo confirmación. Revisa SUNAT antes de reintentar; se conserva el mismo número"
              + " y XML",
          null,
          null);
    }
  }

  public Map<String, Object> consultar(UsuarioPrincipal p, Long id) {
    var cfg = config.cargar(ruc(p));
    var c = row(p.getEmpresaId(), id);
    if (!cfg.ambiente().equals(c.get("ambiente")))
      throw error("Activa el mismo ambiente del comprobante para consultarlo");
    if (!"03".equals(c.get("tipo")) || c.get("ticket") == null)
      throw error(
          "Este comprobante no tiene ticket de resumen. Revisa la constancia directamente en SUNAT"
              + " si perdió la respuesta");
    if (Set.of("ACEPTADO", "RECHAZADO").contains(c.get("estado")))
      return publico(p.getEmpresaId(), id);
    try {
      var result = soap.call(cfg, "getStatus", Map.of("ticket", c.get("ticket").toString()));
      if ("98".equals(result.codigo())) return publico(p.getEmpresaId(), id);
      if (!Set.of("0", "99").contains(result.codigo()) || result.contenido() == null)
        throw new IllegalStateException("Estado no confirmado");
      aplicarCdr(p.getEmpresaId(), id, c, result.contenido());
    } catch (Exception e) {
      guardar(
          p.getEmpresaId(),
          id,
          "EN_PROCESO",
          null,
          "No se pudo consultar el CDR; el ticket se conserva para volver a consultar",
          null,
          null);
    }
    return publico(p.getEmpresaId(), id);
  }

  public Map<String, Object> reintentar(UsuarioPrincipal p, Long id) {
    var cfg = config.cargar(ruc(p));
    boolean send =
        Boolean.TRUE.equals(
            tx.execute(
                status -> {
                  db.queryForObject(
                      "SELECT id FROM empresas WHERE id=? FOR UPDATE",
                      Long.class,
                      p.getEmpresaId());
                  var c = row(p.getEmpresaId(), id);
                  if (!cfg.ambiente().equals(c.get("ambiente")))
                    throw error("El ambiente configurado no coincide");
                  if (!Set.of("REVISAR", "ENVIANDO").contains(c.get("estado")))
                    throw error("Este comprobante ya tiene resultado o ticket; consulta su estado");
                  var updated = ((java.sql.Timestamp) c.get("actualizado")).toInstant();
                  if (updated.isAfter(Instant.now().minusSeconds(90)))
                    throw error(
                        "Espera 90 segundos antes de revisar y reintentar un envío sin respuesta");
                  db.update(
                      "UPDATE comprobantes SET estado='ENVIANDO',actualizado=CURRENT_TIMESTAMP"
                          + " WHERE empresa_id=? AND id=?",
                      p.getEmpresaId(),
                      id);
                  return true;
                }));
    if (send) enviar(p.getEmpresaId(), id, cfg);
    return publico(p.getEmpresaId(), id);
  }

  private void aplicarCdr(Long empresa, Long id, Map<String, Object> c, byte[] bytes)
      throws Exception {
    if (bytes == null) throw new IllegalStateException("Sin CDR");
    var result =
        SunatXml.cdr(
            bytes,
            "03".equals(c.get("tipo"))
                ? c.get("resumen_id").toString()
                : c.get("numero").toString());
    guardar(
        empresa,
        id,
        "0".equals(result.codigo()) ? "ACEPTADO" : "RECHAZADO",
        result.codigo(),
        result.mensaje(),
        null,
        bytes);
  }

  private void guardar(
      Long empresa,
      Long id,
      String estado,
      String codigo,
      String mensaje,
      String ticket,
      byte[] cdr) {
    tx.executeWithoutResult(
        status -> {
          db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
          if (Set.of("ACEPTADO", "RECHAZADO").contains(row(empresa, id).get("estado"))) return;
          db.update(
              "UPDATE comprobantes SET"
                  + " estado=?,codigo=?,mensaje=?,ticket=COALESCE(?,ticket),cdr=COALESCE(?,cdr),actualizado=CURRENT_TIMESTAMP"
                  + " WHERE empresa_id=? AND id=?",
              estado,
              codigo,
              mensaje,
              ticket,
              cdr,
              empresa,
              id);
          var c = row(empresa, id);
          db.update(
              "UPDATE ventas SET estado_fiscal=(SELECT ambiente || '_' || estado FROM comprobantes"
                  + " WHERE empresa_id=? AND venta_id=? ORDER BY CASE WHEN ambiente='PRODUCCION'"
                  + " THEN 0 ELSE 1 END,id DESC LIMIT 1) WHERE empresa_id=? AND id=?",
              empresa,
              c.get("venta_id"),
              empresa,
              c.get("venta_id"));
        });
  }

  public record Archivo(String nombre, byte[] contenido, String tipo) {}

  public Archivo archivo(UsuarioPrincipal p, Long id, String kind) {
    var c = row(p.getEmpresaId(), id);
    String key =
        "xml".equals(kind)
            ? "xml_firmado"
            : "cdr".equals(kind) ? "cdr" : "resumen".equals(kind) ? "resumen_firmado" : "";
    if (key.isEmpty() || c.get(key) == null)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Archivo aún no disponible");
    String name =
        "resumen".equals(kind)
            ? ruc(p) + "-" + c.get("resumen_id")
            : c.get("nombre_archivo").toString();
    return new Archivo(
        ("cdr".equals(kind) ? "R-" : "") + name + ("cdr".equals(kind) ? ".zip" : ".xml"),
        (byte[]) c.get(key),
        "cdr".equals(kind) ? "application/zip" : "application/xml");
  }
}
