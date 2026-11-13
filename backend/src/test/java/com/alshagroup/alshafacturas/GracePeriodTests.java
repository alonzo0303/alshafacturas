package com.alshagroup.alshafacturas;

import static org.junit.jupiter.api.Assertions.*;

import com.alshagroup.alshafacturas.gestion.PlanesService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@Transactional
class GracePeriodTests {
  @Autowired JdbcTemplate db;
  @Autowired PlanesService planes;

  @Test
  void reservesFifteenDaysThenKeepsAccountWithoutReservingSlot() {
    Long empresa =
        db.queryForObject(
            "INSERT INTO empresas(razon_social,estado) VALUES ('Gracia transaccional','ACTIVA')"
                + " RETURNING id",
            Long.class);
    Long owner =
        db.queryForObject(
            "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol) VALUES"
                + " (?,'Dueño','owner@grace.test','test','ADMIN') RETURNING id",
            Long.class,
            empresa);
    db.update("UPDATE empresas SET administrador_principal_id=? WHERE id=?", owner, empresa);
    db.update(
        "INSERT INTO"
            + " pagos_suscripcion(empresa_id,plan,importe,desde,hasta,referencia,registrado_por)"
            + " VALUES (?,'INICIO',35,CURRENT_DATE-1,CURRENT_DATE+30,'prueba de gracia',?)",
        empresa,
        owner);
    Long inactive =
        db.queryForObject(
            "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol,activo,desactivado_en)"
                + " VALUES"
                + " (?,'Inactivo','inactive@grace.test','test','VENDEDOR',false,CURRENT_TIMESTAMP-INTERVAL"
                + " '1 day') RETURNING id",
            Long.class,
            empresa);
    db.update(
        "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol) VALUES"
            + " (?,'Activo','active@grace.test','test','VENDEDOR')",
        empresa);
    assertEquals(2, planes.empleados(empresa));
    assertThrows(ResponseStatusException.class, () -> planes.validarCupo(empresa));
    assertDoesNotThrow(() -> planes.validarReactivar(empresa, inactive));
    db.update(
        "UPDATE usuarios SET desactivado_en=CURRENT_TIMESTAMP-INTERVAL '16 days' WHERE id=?",
        inactive);
    assertEquals(1, planes.empleados(empresa));
    assertDoesNotThrow(() -> planes.validarCupo(empresa));
    assertEquals(
        Boolean.FALSE,
        db.queryForObject("SELECT activo FROM usuarios WHERE id=?", Boolean.class, inactive));
    db.update(
        "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol) VALUES"
            + " (?,'Nuevo','new@grace.test','test','VENDEDOR')",
        empresa);
    assertThrows(ResponseStatusException.class, () -> planes.validarReactivar(empresa, inactive));
  }
}
