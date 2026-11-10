package com.alshagroup.alshafacturas.sunat;

import java.io.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.cert.X509Certificate;
import java.time.*;
import java.util.*;
import java.util.zip.*;
import javax.naming.ldap.LdapName;
import javax.xml.XMLConstants;
import javax.xml.crypto.dsig.*;
import javax.xml.crypto.dsig.dom.DOMSignContext;
import javax.xml.crypto.dsig.spec.*;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.*;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.*;

public final class SunatXml {
  static final String CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
  static final String CAC =
      "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
  static final String EXT =
      "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";

  private SunatXml() {}

  public static Document parse(byte[] xml) throws Exception {
    if (xml.length > 4_000_000) throw new IOException("XML demasiado grande");
    var f = DocumentBuilderFactory.newInstance();
    f.setNamespaceAware(true);
    f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    f.setFeature("http://xml.org/sax/features/external-general-entities", false);
    f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
    f.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
    f.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
    return f.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
  }

  static Element add(Node parent, String name, String value) {
    var d = parent instanceof Document doc ? doc : parent.getOwnerDocument();
    String ns = name.startsWith("cbc:") ? CBC : name.startsWith("cac:") ? CAC : EXT;
    var e = d.createElementNS(ns, name);
    if (value != null) e.setTextContent(value);
    parent.appendChild(e);
    return e;
  }

  static Element money(Node p, String name, BigDecimal v) {
    var e = add(p, name, v.setScale(2, RoundingMode.HALF_UP).toPlainString());
    e.setAttribute("currencyID", "PEN");
    return e;
  }

  static BigDecimal amount(Map<String, Object> v, String key) {
    return new BigDecimal(v.get(key).toString());
  }

  static String text(Map<String, Object> v, String key, String fallback) {
    return Objects.toString(v.get(key), fallback);
  }

  static Document root(String name, String ns) throws Exception {
    var d =
        parse(
            ("<"
                    + name
                    + " xmlns=\""
                    + ns
                    + "\" xmlns:cac=\""
                    + CAC
                    + "\" xmlns:cbc=\""
                    + CBC
                    + "\" xmlns:ext=\""
                    + EXT
                    + "\"/>")
                .getBytes(StandardCharsets.UTF_8));
    add(
        add(add(d.getDocumentElement(), "ext:UBLExtensions", null), "ext:UBLExtension", null),
        "ext:ExtensionContent",
        null);
    return d;
  }

  static void signatureInfo(Element parent, SunatConfiguracion.Datos cfg) {
    var sig = add(parent, "cac:Signature", null);
    add(sig, "cbc:ID", "IDSignAlsha");
    var party = add(sig, "cac:SignatoryParty", null);
    add(add(party, "cac:PartyIdentification", null), "cbc:ID", cfg.ruc());
    add(add(party, "cac:PartyName", null), "cbc:Name", cfg.razonSocial());
    add(
        add(add(sig, "cac:DigitalSignatureAttachment", null), "cac:ExternalReference", null),
        "cbc:URI",
        "#SignatureAlsha");
  }

  static void identification(Node parent, String id, String scheme) {
    var e = add(add(parent, "cac:PartyIdentification", null), "cbc:ID", id);
    e.setAttribute("schemeID", scheme);
  }

  static void supplier(Node parent, SunatConfiguracion.Datos cfg) {
    var party = add(add(parent, "cac:AccountingSupplierParty", null), "cac:Party", null);
    identification(party, cfg.ruc(), "6");
    var legal = add(party, "cac:PartyLegalEntity", null);
    add(legal, "cbc:RegistrationName", cfg.razonSocial());
    var address = add(legal, "cac:RegistrationAddress", null);
    add(address, "cbc:ID", cfg.ubigeo());
    add(address, "cbc:AddressTypeCode", "0000");
    add(address, "cbc:CityName", cfg.provincia());
    add(address, "cbc:CountrySubentity", cfg.departamento());
    add(address, "cbc:District", cfg.distrito());
    add(add(address, "cac:AddressLine", null), "cbc:Line", cfg.direccion());
    add(add(address, "cac:Country", null), "cbc:IdentificationCode", "PE");
  }

  static void tax(Node parent, BigDecimal base, BigDecimal igv, boolean line) {
    var t = add(parent, "cac:TaxTotal", null);
    money(t, "cbc:TaxAmount", igv);
    var sub = add(t, "cac:TaxSubtotal", null);
    money(sub, "cbc:TaxableAmount", base);
    money(sub, "cbc:TaxAmount", igv);
    var cat = add(sub, "cac:TaxCategory", null);
    add(cat, "cbc:Percent", "18.00");
    if (line) add(cat, "cbc:TaxExemptionReasonCode", "10");
    var scheme = add(cat, "cac:TaxScheme", null);
    add(scheme, "cbc:ID", "1000");
    add(scheme, "cbc:Name", "IGV");
    add(scheme, "cbc:TaxTypeCode", "VAT");
  }

  public static byte[] invoice(
      SunatConfiguracion.Datos cfg,
      Map<String, Object> venta,
      String tipo,
      String numero,
      LocalDate fecha,
      List<Map<String, Object>> lineas)
      throws Exception {
    var d = root("Invoice", "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2");
    var e = d.getDocumentElement();
    add(e, "cbc:UBLVersionID", "2.1");
    add(e, "cbc:CustomizationID", "2.0");
    add(e, "cbc:ID", numero);
    add(e, "cbc:IssueDate", fecha.toString());
    var type = add(e, "cbc:InvoiceTypeCode", tipo);
    type.setAttribute("listID", "0101");
    add(e, "cbc:DocumentCurrencyCode", "PEN");
    add(e, "cbc:LineCountNumeric", String.valueOf(lineas.size()));
    signatureInfo(e, cfg);
    supplier(e, cfg);
    var customer = add(add(e, "cac:AccountingCustomerParty", null), "cac:Party", null);
    String document = text(venta, "cliente_documento", "-");
    identification(
        customer, document, document.length() == 11 ? "6" : document.length() == 8 ? "1" : "0");
    add(
        add(customer, "cac:PartyLegalEntity", null),
        "cbc:RegistrationName",
        text(venta, "cliente", "VENTA AL PUBLICO"));
    var payment = add(e, "cac:PaymentTerms", null);
    add(payment, "cbc:ID", "FormaPago");
    add(payment, "cbc:PaymentMeansID", "Contado");
    tax(e, amount(venta, "subtotal"), amount(venta, "igv"), false);
    var totals = add(e, "cac:LegalMonetaryTotal", null);
    money(totals, "cbc:LineExtensionAmount", amount(venta, "subtotal"));
    money(totals, "cbc:TaxInclusiveAmount", amount(venta, "total"));
    money(totals, "cbc:PayableAmount", amount(venta, "total"));
    int index = 0;
    for (var l : lineas) {
      BigDecimal total = amount(l, "total"),
          base = total.divide(new BigDecimal("1.18"), 2, RoundingMode.HALF_UP),
          unit = amount(l, "precio");
      var line = add(e, "cac:InvoiceLine", null);
      add(line, "cbc:ID", String.valueOf(++index));
      var qty = add(line, "cbc:InvoicedQuantity", l.get("cantidad").toString());
      qty.setAttribute("unitCode", "NIU");
      money(line, "cbc:LineExtensionAmount", base);
      var pricing =
          add(add(line, "cac:PricingReference", null), "cac:AlternativeConditionPrice", null);
      money(pricing, "cbc:PriceAmount", unit);
      add(pricing, "cbc:PriceTypeCode", "01");
      tax(line, base, total.subtract(base), true);
      var item = add(line, "cac:Item", null);
      add(item, "cbc:Description", l.get("nombre").toString());
      add(add(item, "cac:SellersItemIdentification", null), "cbc:ID", l.get("sku").toString());
      var price =
          add(
              add(line, "cac:Price", null),
              "cbc:PriceAmount",
              unit.divide(new BigDecimal("1.18"), 10, RoundingMode.HALF_UP)
                  .stripTrailingZeros()
                  .toPlainString());
      price.setAttribute("currencyID", "PEN");
    }
    return sign(d, cfg);
  }

  public static byte[] summary(
      SunatConfiguracion.Datos cfg,
      Map<String, Object> venta,
      String numero,
      String resumen,
      LocalDate fecha)
      throws Exception {
    var d =
        root(
            "SummaryDocuments",
            "urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1");
    var e = d.getDocumentElement();
    e.setAttributeNS(
        XMLConstants.XMLNS_ATTRIBUTE_NS_URI,
        "xmlns:sac",
        "urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1");
    add(e, "cbc:UBLVersionID", "2.0");
    add(e, "cbc:CustomizationID", "1.1");
    add(e, "cbc:ID", resumen);
    add(e, "cbc:ReferenceDate", fecha.toString());
    add(e, "cbc:IssueDate", fecha.toString());
    signatureInfo(e, cfg);
    var supplier = add(e, "cac:AccountingSupplierParty", null);
    add(supplier, "cbc:CustomerAssignedAccountID", cfg.ruc());
    add(supplier, "cbc:AdditionalAccountID", "6");
    add(
        add(add(supplier, "cac:Party", null), "cac:PartyLegalEntity", null),
        "cbc:RegistrationName",
        cfg.razonSocial());
    var line =
        d.createElementNS(
            "urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1",
            "sac:SummaryDocumentsLine");
    e.appendChild(line);
    add(line, "cbc:LineID", "1");
    add(line, "cbc:DocumentTypeCode", "03");
    add(line, "cbc:ID", numero);
    if (venta.get("cliente_documento") != null) {
      var c = add(line, "cac:AccountingCustomerParty", null);
      String doc = venta.get("cliente_documento").toString();
      add(c, "cbc:CustomerAssignedAccountID", doc);
      add(c, "cbc:AdditionalAccountID", doc.length() == 11 ? "6" : "1");
    }
    var status = d.createElementNS(CAC, "cac:Status");
    line.appendChild(status);
    add(status, "cbc:ConditionCode", "1");
    var total = d.createElementNS(line.getNamespaceURI(), "sac:TotalAmount");
    total.setAttribute("currencyID", "PEN");
    total.setTextContent(amount(venta, "total").toPlainString());
    line.appendChild(total);
    var payment = d.createElementNS(line.getNamespaceURI(), "sac:BillingPayment");
    line.appendChild(payment);
    money(payment, "cbc:PaidAmount", amount(venta, "subtotal"));
    add(payment, "cbc:InstructionID", "01");
    tax(line, amount(venta, "subtotal"), amount(venta, "igv"), false);
    return sign(d, cfg);
  }

  static byte[] sign(Document d, SunatConfiguracion.Datos cfg) throws Exception {
    KeyStore store = KeyStore.getInstance("PKCS12");
    char[] password = cfg.certificadoPassword().toCharArray();
    try (var in = java.nio.file.Files.newInputStream(cfg.certificado())) {
      store.load(in, password);
    }
    String alias = cfg.alias();
    if (alias.isBlank()) {
      var keys = store.aliases();
      while (keys.hasMoreElements()) {
        var a = keys.nextElement();
        if (store.isKeyEntry(a)) {
          alias = a;
          break;
        }
      }
    }
    var key = (PrivateKey) store.getKey(alias, password);
    Arrays.fill(password, '\0');
    var cert = (X509Certificate) store.getCertificate(alias);
    if (cert == null || key == null || !"RSA".equals(key.getAlgorithm()))
      throw new GeneralSecurityException("Certificado RSA no disponible");
    cert.checkValidity();
    boolean matches =
        new LdapName(cert.getSubjectX500Principal().getName())
            .getRdns().stream()
                .anyMatch(
                    r -> {
                      Object value = r.getValue();
                      return (value instanceof byte[] bytes
                              ? new String(bytes, StandardCharsets.UTF_8)
                              : value.toString())
                          .contains(cfg.ruc());
                    });
    if (!matches)
      throw new GeneralSecurityException("El certificado no identifica el RUC del emisor");
    var factory = XMLSignatureFactory.getInstance("DOM");
    var reference =
        factory.newReference(
            "",
            factory.newDigestMethod(DigestMethod.SHA256, null),
            List.of(
                factory.newTransform(Transform.ENVELOPED, (TransformParameterSpec) null),
                factory.newTransform(
                    CanonicalizationMethod.INCLUSIVE, (TransformParameterSpec) null)),
            null,
            null);
    var info =
        factory.newSignedInfo(
            factory.newCanonicalizationMethod(
                CanonicalizationMethod.INCLUSIVE, (C14NMethodParameterSpec) null),
            factory.newSignatureMethod(SignatureMethod.RSA_SHA256, null),
            List.of(reference));
    var keyInfo =
        factory
            .getKeyInfoFactory()
            .newKeyInfo(List.of(factory.getKeyInfoFactory().newX509Data(List.of(cert))));
    var context =
        new DOMSignContext(key, d.getElementsByTagNameNS(EXT, "ExtensionContent").item(0));
    context.setDefaultNamespacePrefix("ds");
    factory.newXMLSignature(info, keyInfo, null, "SignatureAlsha", null).sign(context);
    var transformer = TransformerFactory.newInstance();
    transformer.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
    transformer.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
    var t = transformer.newTransformer();
    t.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
    t.setOutputProperty(OutputKeys.INDENT, "no");
    var out = new ByteArrayOutputStream();
    t.transform(new DOMSource(d), new StreamResult(out));
    return out.toByteArray();
  }

  public static byte[] zip(String name, byte[] xml) throws IOException {
    var out = new ByteArrayOutputStream();
    try (var zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
      zip.putNextEntry(new ZipEntry(name));
      zip.write(xml);
      zip.closeEntry();
    }
    return out.toByteArray();
  }

  public record Cdr(String codigo, String mensaje) {}

  public static Cdr cdr(byte[] zip, String expected) throws Exception {
    if (zip.length > 2_000_000) throw new IOException("CDR demasiado grande");
    try (var in = new ZipInputStream(new ByteArrayInputStream(zip), StandardCharsets.UTF_8)) {
      for (int i = 0; i < 10; i++) {
        var entry = in.getNextEntry();
        if (entry == null) break;
        if (!entry.isDirectory() && entry.getName().toLowerCase(Locale.ROOT).endsWith(".xml")) {
          byte[] bytes = in.readNBytes(2_000_001);
          if (bytes.length > 2_000_000) throw new IOException("CDR demasiado grande");
          var d = parse(bytes);
          var refs = d.getElementsByTagNameNS(CAC, "DocumentReference");
          boolean match = false;
          for (int j = 0; j < refs.getLength(); j++) {
            var ids = ((Element) refs.item(j)).getElementsByTagNameNS(CBC, "ID");
            for (int k = 0; k < ids.getLength(); k++)
              if (expected.equals(ids.item(k).getTextContent().trim())) match = true;
          }
          if (!match) throw new IOException("CDR no corresponde al documento enviado");
          String code = value(d, "ResponseCode"), message = value(d, "Description");
          if (code.isBlank()) throw new IOException("CDR sin respuesta");
          return new Cdr(code, message.substring(0, Math.min(message.length(), 500)));
        }
      }
    }
    throw new IOException("No se encontró un CDR válido");
  }

  static String value(Document d, String local) {
    var nodes = d.getElementsByTagNameNS("*", local);
    return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent().trim();
  }
}
