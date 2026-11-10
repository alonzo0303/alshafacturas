package com.alshagroup.alshafacturas.sunat;

import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class SunatSoapClient {
  public record Respuesta(String ticket, String codigo, byte[] contenido) {}

  static String escape(String v) {
    return v.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;");
  }

  static String envelope(
      SunatConfiguracion.Datos cfg, String operation, Map<String, String> params) {
    if (!Set.of("sendBill", "sendSummary", "getStatus").contains(operation))
      throw new IllegalArgumentException("Operación no admitida");
    StringBuilder body = new StringBuilder();
    ("getStatus".equals(operation) ? List.of("ticket") : List.of("fileName", "contentFile"))
        .forEach(
            k ->
                body.append('<')
                    .append(k)
                    .append('>')
                    .append(escape(params.get(k)))
                    .append("</")
                    .append(k)
                    .append('>'));
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><soapenv:Envelope"
               + " xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\""
               + " xmlns:ser=\"http://service.sunat.gob.pe\""
               + " xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\"><soapenv:Header><wsse:Security><wsse:UsernameToken><wsse:Username>"
        + escape(cfg.ruc() + cfg.usuario())
        + "</wsse:Username><wsse:Password"
        + " Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText\">"
        + escape(cfg.password())
        + "</wsse:Password></wsse:UsernameToken></wsse:Security></soapenv:Header><soapenv:Body><ser:"
        + operation
        + ">"
        + body
        + "</ser:"
        + operation
        + "></soapenv:Body></soapenv:Envelope>";
  }

  public Respuesta call(SunatConfiguracion.Datos cfg, String operation, Map<String, String> params)
      throws Exception {
    var uri =
        URI.create(
            "BETA".equals(cfg.ambiente())
                ? "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService"
                : "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService");
    var builder =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NEVER);
    String proxy = System.getenv("HTTPS_PROXY");
    if (proxy != null && !proxy.isBlank()) {
      var p = URI.create(proxy);
      builder.proxy(
          ProxySelector.of(
              new InetSocketAddress(p.getHost(), p.getPort() == -1 ? 80 : p.getPort())));
    }
    var request =
        HttpRequest.newBuilder(uri)
            .timeout(Duration.ofSeconds(45))
            .header("Content-Type", "text/xml; charset=UTF-8")
            .header("SOAPAction", "urn:" + operation)
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    envelope(cfg, operation, params), StandardCharsets.UTF_8))
            .build();
    try (var client = builder.build()) {
      var response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
      byte[] bytes;
      try (var in = response.body()) {
        bytes = in.readNBytes(4_000_001);
      }
      if (bytes.length > 4_000_000) throw new IOException("Respuesta demasiado grande");
      var xml = SunatXml.parse(bytes);
      if (xml.getElementsByTagNameNS("*", "Fault").getLength() > 0)
        throw new IOException(
            "SUNAT SOAP Fault: "
                + SunatXml.value(xml, "faultcode")
                + " "
                + SunatXml.value(xml, "faultstring")
                    .replace(cfg.password(), "[oculto]")
                    .replace(cfg.ruc() + cfg.usuario(), "[usuario]")
                    .replaceAll("[\\r\\n]", " "));
      if (response.statusCode() != 200) throw new IOException("SUNAT no confirmó la operación");
      String content = SunatXml.value(xml, "applicationResponse");
      if (content.isBlank()) content = SunatXml.value(xml, "content");
      return new Respuesta(
          SunatXml.value(xml, "ticket"),
          SunatXml.value(xml, "statusCode"),
          content.isBlank() ? null : Base64.getMimeDecoder().decode(content));
    }
  }
}
