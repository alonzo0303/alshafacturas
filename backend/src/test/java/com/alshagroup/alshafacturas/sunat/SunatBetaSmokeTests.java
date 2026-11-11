package com.alshagroup.alshafacturas.sunat;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;

/** One artificial document, opt-in only. Never runs in ordinary CI or against production. */
@EnabledIfEnvironmentVariable(named = "RUN_SUNAT_BETA_SMOKE", matches = "true")
class SunatBetaSmokeTests {
  @TempDir Path directory;

  @Test
  void facturaArtificialEnServicioBetaOficial() throws Exception {
    var cfg = fixture();
    String ruc = cfg.ruc();
    String number = "FT01-00000001", name = ruc + "-01-" + number;
    var sale = new HashMap<String, Object>();
    sale.put("subtotal", new BigDecimal("100.00"));
    sale.put("igv", new BigDecimal("18.00"));
    sale.put("total", new BigDecimal("118.00"));
    sale.put("cliente_documento", ruc);
    sale.put("cliente", "CLIENTE FICTICIO DE PRUEBA BETA");
    var line = new HashMap<String, Object>();
    line.put("cantidad", 2);
    line.put("precio", new BigDecimal("59.00"));
    line.put("total", new BigDecimal("118.00"));
    line.put("nombre", "PRODUCTO FICTICIO DE PRUEBA");
    line.put("sku", "BETA-001");
    byte[] xml =
        SunatXml.invoice(
            cfg, sale, "01", number, LocalDate.now(ZoneId.of("America/Lima")), List.of(line));
    var response =
        new SunatSoapClient()
            .call(
                cfg,
                "sendBill",
                Map.of(
                    "fileName",
                    name + ".zip",
                    "contentFile",
                    Base64.getEncoder().encodeToString(SunatXml.zip(name + ".xml", xml))));
    assertNotNull(response.contenido());
    var result = SunatXml.cdr(response.contenido(), number);
    String output = System.getenv("SUNAT_BETA_EVIDENCE_DIR");
    if (output != null) {
      Path path = Path.of(output);
      Files.createDirectories(path);
      Files.write(path.resolve("factura-beta.xml"), xml);
      Files.write(path.resolve("cdr-beta.zip"), response.contenido());
      Files.writeString(
          path.resolve("resultado-beta.txt"),
          "Ambiente: BETA (sin validez tributaria)\nCódigo: "
              + result.codigo()
              + "\nDescripción: "
              + result.mensaje()
              + "\n");
    }
    assertEquals("0", result.codigo(), result.mensaje());
  }

  private SunatConfiguracion.Datos fixture() throws Exception {
    String ruc = "20100066603"; // Public example RUC from the official programmer's manual.
    Path certificate = directory.resolve("beta-test.p12");
    var process =
        new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "keytool").toString(),
                "-genkeypair",
                "-alias",
                "test",
                "-keyalg",
                "RSA",
                "-keysize",
                "2048",
                "-dname",
                "CN=" + ruc + ",O=Alsha beta test",
                "-validity",
                "1",
                "-storetype",
                "PKCS12",
                "-keystore",
                certificate.toString(),
                "-storepass",
                "OnlyBetaTest2026")
            .redirectErrorStream(true)
            .start();
    process.getInputStream().readAllBytes();
    assertEquals(0, process.waitFor());
    return new SunatConfiguracion.Datos(
        ruc,
        "BETA",
        "MODDATOS",
        "MODDATOS",
        certificate,
        "OnlyBetaTest2026",
        "test",
        "FT01",
        "BT01",
        0,
        0,
        "150101",
        "LIMA",
        "LIMA",
        "LIMA",
        "DOMICILIO FICTICIO DE PRUEBA",
        "EMISOR FICTICIO DE PRUEBA BETA");
  }

  @Test
  void boletaArtificialResumenEnServicioBetaOficial() throws Exception {
    var cfg = fixture();
    LocalDate date = LocalDate.now(ZoneId.of("America/Lima"));
    String summary =
        "RC-"
            + date.format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE)
            + "-"
            + String.format(Locale.ROOT, "%05d", (System.currentTimeMillis() % 90000) + 10000);
    Map<String, Object> sale = new HashMap<>();
    sale.put("subtotal", new BigDecimal("100.00"));
    sale.put("igv", new BigDecimal("18.00"));
    sale.put("total", new BigDecimal("118.00"));
    sale.put("cliente_documento", cfg.ruc());
    byte[] xml = SunatXml.summary(cfg, sale, "BT01-00000001", summary, date);
    String name = cfg.ruc() + "-" + summary;
    var client = new SunatSoapClient();
    var response =
        client.call(
            cfg,
            "sendSummary",
            Map.of(
                "fileName",
                name + ".zip",
                "contentFile",
                Base64.getEncoder().encodeToString(SunatXml.zip(name + ".xml", xml))));
    assertFalse(response.ticket().isBlank());
    var result = client.call(cfg, "getStatus", Map.of("ticket", response.ticket()));
    assertTrue(Set.of("0", "98", "99").contains(result.codigo()));
    String message = "EN_PROCESO";
    if (result.contenido() != null) {
      var cdr = SunatXml.cdr(result.contenido(), summary);
      message = cdr.codigo() + ": " + cdr.mensaje();
      assertEquals("0", cdr.codigo(), cdr.mensaje());
    }
    String output = System.getenv("SUNAT_BETA_EVIDENCE_DIR");
    if (output != null) {
      Path path = Path.of(output);
      Files.createDirectories(path);
      Files.write(path.resolve("resumen-beta.xml"), xml);
      if (result.contenido() != null)
        Files.write(path.resolve("cdr-resumen-beta.zip"), result.contenido());
      Files.writeString(
          path.resolve("resultado-resumen-beta.txt"),
          "Ambiente: BETA (sin validez tributaria)\nResumen: "
              + summary
              + "\nTicket: "
              + response.ticket()
              + "\nResultado: "
              + message
              + "\n");
    }
  }
}
