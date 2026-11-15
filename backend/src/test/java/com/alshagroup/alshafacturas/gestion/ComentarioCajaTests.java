package com.alshagroup.alshafacturas.gestion;

import static org.junit.jupiter.api.Assertions.*;

import com.alshagroup.alshafacturas.repository.UsuarioRepository;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ComentarioCajaTests {
  @Autowired JdbcTemplate db;
  @Autowired UsuarioRepository users;
  @Autowired CajaService cajas;

  @Test
  void legacyShortageCanBeExplainedWithoutChangingAmounts() {
    Long empresa =
        db.queryForObject(
            "INSERT INTO empresas(razon_social,estado) VALUES ('Comentario histórico','ACTIVA')"
                + " RETURNING id",
            Long.class);
    Long user =
        db.queryForObject(
            "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol) VALUES"
                + " (?,'Responsable histórico','legacy@cash.test','test','VENDEDOR') RETURNING id",
            Long.class,
            empresa);
    Long local =
        db.queryForObject(
            "INSERT INTO locales(empresa_id,nombre) VALUES (?,'Local de pruebas') RETURNING id",
            Long.class,
            empresa);
    Long caja =
        db.queryForObject(
            "INSERT INTO"
                + " cajas(empresa_id,local_id,usuario_id,usuario_original_id,usuario_nombre,fondo,estado,cerrada,cerrado_por,cerrado_nombre,efectivo_esperado,efectivo_contado,diferencia,total_ventas,cantidad_ventas)"
                + " VALUES (?,?,?,?,'Responsable"
                + " histórico',30,'CERRADA',CURRENT_TIMESTAMP,?,'Responsable"
                + " histórico',30,25,-5,0,0) RETURNING id",
            Long.class,
            empresa,
            local,
            user,
            user,
            user);
    var before =
        db.queryForMap(
            "SELECT"
                + " fondo,estado,cerrada,efectivo_esperado,efectivo_contado,diferencia,total_ventas,cantidad_ventas"
                + " FROM cajas WHERE id=?",
            caja);
    var actor = new UsuarioPrincipal(users.findById(user).orElseThrow());
    var result = cajas.comentar(actor, empresa, local, caja, "Faltan S/5 en el conteo de monedas");
    assertEquals("Faltan S/5 en el conteo de monedas", result.get("comentario_cierre"));
    assertEquals(user, result.get("comentado_por_original_id"));
    assertNotNull(result.get("comentado_en"));
    assertEquals(
        before,
        db.queryForMap(
            "SELECT"
                + " fondo,estado,cerrada,efectivo_esperado,efectivo_contado,diferencia,total_ventas,cantidad_ventas"
                + " FROM cajas WHERE id=?",
            caja));
  }
}
