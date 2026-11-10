package com.alshagroup.alshafacturas.sunat;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class SunatConfiguracion {
  private final String directory;

  public SunatConfiguracion(@Value("${SUNAT_CONFIG_DIR:}") String directory) {
    this.directory = directory;
  }

  public record Datos(
      String ruc,
      String ambiente,
      String usuario,
      String password,
      Path certificado,
      String certificadoPassword,
      String alias,
      String serieFactura,
      String serieBoleta,
      long ultimoFactura,
      long ultimoBoleta,
      String ubigeo,
      String departamento,
      String provincia,
      String distrito,
      String direccion,
      String razonSocial) {
    @Override
    public String toString() {
      return "SunatDatos[" + ruc + "," + ambiente + "]";
    }
  }

  public Datos cargar(String ruc) {
    if (directory.isBlank() || !ruc.matches("[0-9]{11}")) throw falta();
    try {
      var p = new Properties();
      try (var reader =
          Files.newBufferedReader(
              Path.of(directory).resolve(ruc + ".properties"), StandardCharsets.UTF_8)) {
        p.load(reader);
      }
      if (!"true".equals(p.getProperty("habilitado"))) throw falta();
      String ambiente = p.getProperty("ambiente", "BETA");
      if (!Set.of("BETA", "PRODUCCION").contains(ambiente)) throw falta();
      if ("PRODUCCION".equals(ambiente) && !"true".equals(p.getProperty("produccionHabilitada")))
        throw falta();
      String sf = p.getProperty("serieFactura", "F001"), sb = p.getProperty("serieBoleta", "B001");
      if (!sf.matches("F[A-Z0-9]{3}")
          || !sb.matches("B[A-Z0-9]{3}")
          || !required(p, "ubigeo").matches("[0-9]{6}")) throw falta();
      var path = Path.of(directory).resolve(required(p, "certificado")).normalize();
      if (!Files.isRegularFile(path)) throw falta();
      long uf = Long.parseLong(p.getProperty("ultimoFactura", "0")),
          ub = Long.parseLong(p.getProperty("ultimoBoleta", "0"));
      if (uf < 0 || ub < 0 || uf >= 99999999 || ub >= 99999999) throw falta();
      return new Datos(
          ruc,
          ambiente,
          required(p, "usuarioSol"),
          required(p, "claveSol"),
          path,
          required(p, "certificadoPassword"),
          p.getProperty("alias", ""),
          sf,
          sb,
          uf,
          ub,
          required(p, "ubigeo"),
          required(p, "departamento"),
          required(p, "provincia"),
          required(p, "distrito"),
          required(p, "direccion"),
          required(p, "razonSocial"));
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw falta();
    }
  }

  public Map<String, Object> estado(String ruc) {
    try {
      var d = cargar(ruc);
      return Map.of(
          "configurado",
          true,
          "ambiente",
          d.ambiente(),
          "serieFactura",
          d.serieFactura(),
          "serieBoleta",
          d.serieBoleta(),
          "mensaje",
          "Configuración disponible. La aceptación depende del CDR de SUNAT.");
    } catch (ResponseStatusException e) {
      return Map.of(
          "configurado",
          false,
          "ambiente",
          "SIN_CONFIGURAR",
          "mensaje",
          "Faltan credenciales SOL, certificado o datos del emisor en la configuración segura del"
              + " servidor.");
    }
  }

  private String required(Properties p, String key) {
    String v = p.getProperty(key, "");
    if (v.isBlank()) throw falta();
    return v;
  }

  private ResponseStatusException falta() {
    return new ResponseStatusException(
        HttpStatus.PRECONDITION_FAILED,
        "Configura los datos de SUNAT y el certificado digital de esta empresa en el servidor");
  }
}
