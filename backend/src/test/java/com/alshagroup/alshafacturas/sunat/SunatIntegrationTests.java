package com.alshagroup.alshafacturas.sunat;

import static com.alshagroup.alshafacturas.comercial.ComercialDtos.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.alshagroup.alshafacturas.comercial.ComercialService;
import com.alshagroup.alshafacturas.entity.Usuario;
import com.alshagroup.alshafacturas.repository.EmpresaRepository;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.KeyStore;
import java.util.*;
import javax.xml.crypto.dsig.XMLSignatureFactory;
import javax.xml.crypto.dsig.dom.DOMValidateContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SunatIntegrationTests {
  static final Path DIRECTORY;

  static {
    try {
      DIRECTORY = Files.createTempDirectory("alsha-sunat-test-");
    } catch (IOException e) {
      throw new ExceptionInInitializerError(e);
    }
  }

  static final String RUC =
      "20" + Long.toUnsignedString(UUID.randomUUID().getLeastSignificantBits()).substring(0, 9);

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry r) {
    r.add("SUNAT_CONFIG_DIR", DIRECTORY::toString);
  }

  @Autowired com.alshagroup.alshafacturas.gestion.LocalesService locales;
  @Autowired JdbcTemplate db;
  @Autowired EmpresaRepository empresas;
  @Autowired ComercialService comercial;
  @Autowired SunatService sunat;
  @Autowired SunatConfiguracion configuration;
  @MockitoBean SunatSoapClient soap;
  UsuarioPrincipal principal;
  Long cliente;

  @BeforeAll
  void setup() throws Exception {
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
                "CN=" + RUC + ",O=Alsha test",
                "-validity",
                "1",
                "-storetype",
                "PKCS12",
                "-keystore",
                DIRECTORY.resolve("test.p12").toString(),
                "-storepass",
                "TestCertificate2026")
            .redirectErrorStream(true)
            .start();
    process.getInputStream().readAllBytes();
    assertEquals(0, process.waitFor());
    Files.writeString(
        DIRECTORY.resolve(RUC + ".properties"),
        "habilitado=true\n"
            + "ambiente=BETA\n"
            + "usuarioSol=MODDATOS\n"
            + "claveSol=MODDATOS\n"
            + "certificado=test.p12\n"
            + "certificadoPassword=TestCertificate2026\n"
            + "ubigeo=150101\n"
            + "departamento=LIMA\n"
            + "provincia=LIMA\n"
            + "distrito=LIMA\n"
            + "direccion=Dirección de prueba\n"
            + "razonSocial=Emisor de pruebas\n");
    Long empresa =
        db.queryForObject(
            "INSERT INTO empresas(ruc,razon_social,estado) VALUES (?,'Emisor de pruebas','ACTIVA')"
                + " RETURNING id",
            Long.class,
            RUC);
    Long user =
        db.queryForObject(
            "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol,activo) VALUES"
                + " (?,'Administrador','test@sunat.local','test-only','ADMIN',true) RETURNING id",
            Long.class,
            empresa);
    var u = new Usuario();
    u.setId(user);
    u.setEmpresa(empresas.findById(empresa).orElseThrow());
    u.setNombre("Administrador");
    u.setCorreo("test@sunat.local");
    u.setPasswordHash("test-only");
    u.setRol("ADMIN");
    u.setActivo(true);
    principal = new UsuarioPrincipal(u);
    locales.seleccionar(principal, null);
    contextoLocal();
    cliente =
        ((Number)
                comercial
                    .cliente(
                        empresa, null, new ClienteRequest(RUC, "Cliente de prueba", null, null))
                    .get("id"))
            .longValue();
  }

  @org.junit.jupiter.api.BeforeEach
  void contextoLocal() {
    org.springframework.security.core.context.SecurityContextHolder.getContext()
        .setAuthentication(
            new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities()));
  }

  @org.junit.jupiter.api.AfterEach
  void limpiarContexto() {
    org.springframework.security.core.context.SecurityContextHolder.clearContext();
  }

  Map<String, Object> venta(String tipo) {
    var producto =
        comercial.producto(
            principal.getEmpresaId(),
            null,
            new ProductoRequest(
                UUID.randomUUID().toString(),
                "Aceite & filtro <original>",
                new BigDecimal("11.80"),
                1,
                true));
    Long id = ((Number) producto.get("id")).longValue();
    comercial.ajuste(principal, new AjusteRequest(id, 4, "Prueba de integración"));
    return comercial.vender(
        principal,
        new VentaRequest(
            UUID.randomUUID(), cliente, tipo, "EFECTIVO", List.of(new LineaVenta(id, 2))));
  }

  byte[] cdr(String reference, String code) throws Exception {
    String xml =
        "<ApplicationResponse"
            + " xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2\""
            + " xmlns:cac=\""
            + SunatXml.CAC
            + "\" xmlns:cbc=\""
            + SunatXml.CBC
            + "\"><cac:DocumentResponse><cac:Response><cbc:ReferenceID>"
            + reference
            + "</cbc:ReferenceID><cbc:ResponseCode>"
            + code
            + "</cbc:ResponseCode><cbc:Description>Resultado de"
            + " prueba</cbc:Description></cac:Response><cac:DocumentReference><cbc:ID>"
            + reference
            + "</cbc:ID></cac:DocumentReference></cac:DocumentResponse></ApplicationResponse>";
    return SunatXml.zip("R-test.xml", xml.getBytes(StandardCharsets.UTF_8));
  }

  void accepted() throws Exception {
    when(soap.call(any(), eq("sendBill"), anyMap()))
        .thenAnswer(
            inv -> {
              Map<String, String> params = inv.getArgument(2);
              String name = params.get("fileName");
              String number = name.substring((RUC + "-01-").length(), name.length() - 4);
              return new SunatSoapClient.Respuesta("", "", cdr(number, "0"));
            });
  }

  @Test
  void mixedTaxLinesKeepExemptAndUnaffectedAmounts() throws Exception {
    var lines = new ArrayList<Map<String, Object>>();
    for (String affect : List.of("GRAVADO", "EXONERADO", "INAFECTO")) {
      var line = new HashMap<String, Object>();
      line.put("nombre", affect);
      line.put("sku", affect);
      line.put("cantidad", 1);
      line.put("precio", new BigDecimal("118"));
      line.put("total", new BigDecimal("118"));
      line.put("base", new BigDecimal(affect.equals("GRAVADO") ? "100" : "118"));
      line.put("afectacion_igv", affect);
      lines.add(line);
    }
    var sale = new HashMap<String, Object>();
    sale.put("subtotal", new BigDecimal("336"));
    sale.put("igv", new BigDecimal("18"));
    sale.put("total", new BigDecimal("354"));
    sale.put("cliente_documento", "20123456789");
    var signed =
        SunatXml.invoice(
            configuration.cargar(RUC),
            sale,
            "01",
            "F001-99999999",
            java.time.LocalDate.now(),
            lines);
    var doc = SunatXml.parse(signed);
    var codes = doc.getElementsByTagNameNS(SunatXml.CBC, "TaxExemptionReasonCode");
    var found = new HashSet<String>();
    for (int i = 0; i < codes.getLength(); i++) found.add(codes.item(i).getTextContent());
    assertTrue(found.containsAll(Set.of("10", "20", "30")));
    var amounts = doc.getElementsByTagNameNS(SunatXml.CBC, "LineExtensionAmount");
    assertEquals("336.00", amounts.item(0).getTextContent());
    assertEquals("100.00", amounts.item(1).getTextContent());
    assertEquals("118.00", amounts.item(2).getTextContent());
    assertEquals("118.00", amounts.item(3).getTextContent());
  }

  @Test
  void facturaFirmadaAceptadaYReintentoNoDuplica() throws Exception {
    accepted();
    var sale = venta("FACTURA");
    Long venta = ((Number) sale.get("id")).longValue();
    var c = sunat.emitir(principal, venta);
    Long id = ((Number) c.get("id")).longValue();
    assertEquals("ACEPTADO", c.get("estado"));
    assertEquals("BETA", c.get("ambiente"));
    assertEquals(c.get("id"), sunat.emitir(principal, venta).get("id"));
    verify(soap, times(1)).call(any(), eq("sendBill"), anyMap());
    assertEquals(
        "BETA_ACEPTADO",
        db.queryForObject("SELECT estado_fiscal FROM ventas WHERE id=?", String.class, venta));
    byte[] signed = sunat.archivo(principal, id, "xml").contenido();
    var document = SunatXml.parse(signed);
    var ks = KeyStore.getInstance("PKCS12");
    try (var in = Files.newInputStream(DIRECTORY.resolve("test.p12"))) {
      ks.load(in, "TestCertificate2026".toCharArray());
    }
    var signature =
        document
            .getElementsByTagNameNS(javax.xml.crypto.dsig.XMLSignature.XMLNS, "Signature")
            .item(0);
    assertTrue(
        XMLSignatureFactory.getInstance("DOM")
            .unmarshalXMLSignature(
                new DOMValidateContext(ks.getCertificate("test").getPublicKey(), signature))
            .validate(new DOMValidateContext(ks.getCertificate("test").getPublicKey(), signature)));
    assertTrue(
        new String(signed, StandardCharsets.UTF_8)
            .contains("Aceite &amp; filtro &lt;original&gt;"));
    assertNotNull(sunat.archivo(principal, id, "cdr").contenido());
    assertThrows(
        ResponseStatusException.class, () -> comercial.anular(principal, venta, "No permitido"));
  }

  @Test
  void boletaResumenTicketYConsulta() throws Exception {
    when(soap.call(any(), eq("sendSummary"), anyMap()))
        .thenReturn(new SunatSoapClient.Respuesta("123456789", "", null));
    var sale = venta("BOLETA");
    var c = sunat.emitir(principal, ((Number) sale.get("id")).longValue());
    Long id = ((Number) c.get("id")).longValue();
    assertEquals("EN_PROCESO", c.get("estado"));
    assertEquals("123456789", c.get("ticket"));
    when(soap.call(any(), eq("getStatus"), anyMap()))
        .thenReturn(new SunatSoapClient.Respuesta("", "98", null));
    assertEquals("EN_PROCESO", sunat.consultar(principal, id).get("estado"));
    when(soap.call(any(), eq("getStatus"), anyMap()))
        .thenReturn(
            new SunatSoapClient.Respuesta("", "0", cdr(c.get("resumen_id").toString(), "0")));
    assertEquals("ACEPTADO", sunat.consultar(principal, id).get("estado"));
    assertNotNull(sunat.archivo(principal, id, "resumen").contenido());
  }

  @Test
  void perdidaDeRespuestaConservaNumeroYXml() throws Exception {
    when(soap.call(any(), eq("sendBill"), anyMap()))
        .thenThrow(new IOException("Simulación sin red"));
    var sale = venta("FACTURA");
    Long venta = ((Number) sale.get("id")).longValue();
    var c = sunat.emitir(principal, venta);
    Long id = ((Number) c.get("id")).longValue();
    assertEquals("REVISAR", c.get("estado"));
    byte[] xml = sunat.archivo(principal, id, "xml").contenido();
    assertEquals(id, sunat.emitir(principal, venta).get("id"));
    assertThrows(ResponseStatusException.class, () -> sunat.reintentar(principal, id));
    db.update(
        "UPDATE comprobantes SET actualizado=CURRENT_TIMESTAMP-INTERVAL '2 minutes' WHERE id=?",
        id);
    reset(soap);
    accepted();
    var retried = sunat.reintentar(principal, id);
    assertEquals("ACEPTADO", retried.get("estado"));
    assertEquals(c.get("numero"), retried.get("numero"));
    assertArrayEquals(xml, sunat.archivo(principal, id, "xml").contenido());
    assertEquals(
        1L,
        db.queryForObject("SELECT COUNT(*) FROM comprobantes WHERE venta_id=?", Long.class, venta));
  }

  @Test
  void rechazoYMismatchedCdrNuncaSeMarcanAceptados() throws Exception {
    when(soap.call(any(), eq("sendBill"), anyMap()))
        .thenAnswer(
            inv -> {
              Map<String, String> p = inv.getArgument(2);
              String name = p.get("fileName");
              return new SunatSoapClient.Respuesta(
                  "", "", cdr(name.substring((RUC + "-01-").length(), name.length() - 4), "2335"));
            });
    var sale = venta("FACTURA");
    assertEquals(
        "RECHAZADO", sunat.emitir(principal, ((Number) sale.get("id")).longValue()).get("estado"));
    when(soap.call(any(), eq("sendBill"), anyMap()))
        .thenReturn(new SunatSoapClient.Respuesta("", "", cdr("F999-00000001", "0")));
    var other = venta("FACTURA");
    assertEquals(
        "REVISAR", sunat.emitir(principal, ((Number) other.get("id")).longValue()).get("estado"));
  }

  @Test
  void configuracionConCarpetaHabilitadaRechazaRucAusente() {
    assertThrows(ResponseStatusException.class, () -> configuration.cargar(null));
    assertEquals(false, configuration.estado(null).get("configurado"));
  }

  @Test
  void xmlExternoBloqueadoYOrdenSoapCorrecto() throws Exception {
    assertThrows(
        Exception.class,
        () ->
            SunatXml.parse(
                "<!DOCTYPE x [<!ENTITY e SYSTEM 'file:///etc/passwd'>]><x>&e;</x>"
                    .getBytes(StandardCharsets.UTF_8)));
    String envelope =
        SunatSoapClient.envelope(
            configuration.cargar(RUC),
            "sendBill",
            Map.of("contentFile", "abc", "fileName", "x.zip"));
    assertTrue(envelope.indexOf("<fileName>") < envelope.indexOf("<contentFile>"));
    assertNotNull(SunatXml.parse(envelope.getBytes(StandardCharsets.UTF_8)));
  }

  @AfterAll
  void cleanSecrets() throws Exception {
    try (var paths = Files.walk(DIRECTORY)) {
      for (Path p : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(p);
    }
  }

  @org.junit.jupiter.api.Test
  void fiscalDocumentsStayInsideSelectedLocal() throws Exception {
    accepted();
    var sale = venta("FACTURA");
    Long ventaId = ((Number) sale.get("id")).longValue();
    var prepared = sunat.emitir(principal, ventaId);
    Long doc = ((Number) prepared.get("id")).longValue();
    Long original = principal.getLocalId();
    String nombre = principal.getLocalNombre();
    Long otro =
        db.queryForObject(
            "INSERT INTO locales(empresa_id,nombre) VALUES (?,?) RETURNING id",
            Long.class,
            principal.getEmpresaId(),
            "Otro local " + UUID.randomUUID());
    principal.seleccionarLocal(otro, "Otro local");
    org.mockito.Mockito.clearInvocations(soap);
    try {
      assertTrue(sunat.listar(principal).isEmpty());
      assertThrows(ResponseStatusException.class, () -> sunat.archivo(principal, doc, "xml"));
      assertThrows(ResponseStatusException.class, () -> sunat.consultar(principal, doc));
      assertThrows(ResponseStatusException.class, () -> sunat.reintentar(principal, doc));
      assertThrows(ResponseStatusException.class, () -> sunat.emitir(principal, ventaId));
      org.mockito.Mockito.verifyNoInteractions(soap);
    } finally {
      principal.seleccionarLocal(original, nombre);
    }
  }
}
