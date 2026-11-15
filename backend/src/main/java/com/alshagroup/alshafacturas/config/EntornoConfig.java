package com.alshagroup.alshafacturas.config;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/** Verifica el destino real antes de que Flyway pueda modificar su esquema. */
@Configuration
public class EntornoConfig {
  private final String nombre;
  private final boolean carga;
  private volatile boolean validado;

  public EntornoConfig(
      Environment env,
      @Value("${app.entorno:DESARROLLO}") String nombre,
      @Value("${app.carga-habilitada:false}") boolean carga) {
    this.nombre = nombre;
    this.carga = carga;
    if (!"DESARROLLO".equals(nombre)
        && !env.getProperty("spring.flyway.enabled", Boolean.class, true))
      throw new IllegalStateException(
          "Los entornos separados requieren verificación y migraciones habilitadas");
    boolean pruebas = Arrays.asList(env.getActiveProfiles()).contains("pruebas");
    boolean produccion = Arrays.asList(env.getActiveProfiles()).contains("produccion");
    if (pruebas && produccion
        || pruebas && !"PRUEBAS".equals(nombre)
        || produccion && !"PRODUCCION".equals(nombre)
        || "PRUEBAS".equals(nombre) && !pruebas
        || "PRODUCCION".equals(nombre) && !produccion
        || !java.util.Set.of("PRUEBAS", "PRODUCCION", "DESARROLLO").contains(nombre))
      throw new IllegalStateException("Perfil y entorno incompatibles");
    if (carga && !pruebas)
      throw new IllegalStateException("La carga solo se habilita en el perfil pruebas");
  }

  public String nombre() {
    return nombre;
  }

  public boolean cargaHabilitada() {
    return validado && carga && "PRUEBAS".equals(nombre);
  }

  @Bean
  FlywayMigrationStrategy migracionVerificada() {
    return flyway -> {
      try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
        validarConexion(connection);
      } catch (SQLException ex) {
        throw new IllegalStateException("No se pudo verificar la base del entorno", ex);
      }
      flyway.migrate();
    };
  }

  public void validarConexion(Connection connection) throws SQLException {
    if ("DESARROLLO".equals(nombre)) return;
    String suffix = "PRUEBAS".equals(nombre) ? "pruebas" : "produccion";
    try (var statement =
            connection.prepareStatement(
                "SELECT current_database(),current_user,rolsuper OR rolcreatedb OR rolcreaterole OR"
                    + " rolbypassrls FROM pg_roles WHERE rolname=current_user");
        var result = statement.executeQuery()) {
      if (!result.next()
          || !("alshafacturas_" + suffix).equals(result.getString(1))
          || !("alsha_" + suffix).equals(result.getString(2))
          || result.getBoolean(3))
        throw new IllegalStateException(
            "La base o el usuario no corresponden al entorno, o el usuario tiene privilegios"
                + " administrativos. No se aplicaron migraciones");
      validado = true;
    }
  }
}
