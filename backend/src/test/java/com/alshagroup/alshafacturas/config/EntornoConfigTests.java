package com.alshagroup.alshafacturas.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.sql.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class EntornoConfigTests {
  MockEnvironment profile(String name) {
    var env = new MockEnvironment();
    env.setActiveProfiles(name);
    return env;
  }

  Connection connection(String db, String user, boolean elevated) throws Exception {
    var connection = mock(Connection.class);
    var statement = mock(PreparedStatement.class);
    var result = mock(ResultSet.class);
    when(connection.prepareStatement(anyString())).thenReturn(statement);
    when(statement.executeQuery()).thenReturn(result);
    when(result.next()).thenReturn(true);
    when(result.getString(1)).thenReturn(db);
    when(result.getString(2)).thenReturn(user);
    when(result.getBoolean(3)).thenReturn(elevated);
    return connection;
  }

  @Test
  void profilesCannotLieOrEnableLoadInProduction() {
    assertThrows(
        IllegalStateException.class,
        () -> new EntornoConfig(profile("produccion"), "PRUEBAS", true));
    assertThrows(
        IllegalStateException.class,
        () -> new EntornoConfig(profile("produccion"), "PRODUCCION", true));
    var env = profile("pruebas");
    env.setActiveProfiles("pruebas", "produccion");
    assertThrows(IllegalStateException.class, () -> new EntornoConfig(env, "PRUEBAS", false));
    var disabled = profile("pruebas").withProperty("spring.flyway.enabled", "false");
    assertThrows(IllegalStateException.class, () -> new EntornoConfig(disabled, "PRUEBAS", false));
  }

  @Test
  void validatesActualDatabaseAndRoleBeforeEnablingLoad() throws Exception {
    var config = new EntornoConfig(profile("pruebas"), "PRUEBAS", true);
    assertFalse(config.cargaHabilitada());
    assertThrows(
        IllegalStateException.class,
        () ->
            config.validarConexion(
                connection("alshafacturas_produccion", "alsha_produccion", false)));
    assertThrows(
        IllegalStateException.class,
        () -> config.validarConexion(connection("alshafacturas_pruebas", "alsha_pruebas", true)));
    config.validarConexion(connection("alshafacturas_pruebas", "alsha_pruebas", false));
    assertTrue(config.cargaHabilitada());
    var production = new EntornoConfig(profile("produccion"), "PRODUCCION", false);
    production.validarConexion(connection("alshafacturas_produccion", "alsha_produccion", false));
    assertFalse(production.cargaHabilitada());
  }

  @Test
  void wrongDestinationNeverReachesMigrations() throws Exception {
    var config = new EntornoConfig(profile("pruebas"), "PRUEBAS", true);
    var flyway = mock(org.flywaydb.core.Flyway.class);
    var settings = mock(org.flywaydb.core.api.configuration.Configuration.class);
    var ds = mock(javax.sql.DataSource.class);
    when(flyway.getConfiguration()).thenReturn(settings);
    when(settings.getDataSource()).thenReturn(ds);
    var wrong = connection("alshafacturas_produccion", "alsha_produccion", false);
    when(ds.getConnection()).thenReturn(wrong);
    assertThrows(IllegalStateException.class, () -> config.migracionVerificada().migrate(flyway));
    verify(flyway, never()).migrate();
  }
}
