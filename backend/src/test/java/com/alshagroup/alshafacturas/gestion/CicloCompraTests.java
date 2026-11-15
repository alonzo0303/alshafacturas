package com.alshagroup.alshafacturas.gestion;

import static org.junit.jupiter.api.Assertions.*;

import com.alshagroup.alshafacturas.repository.UsuarioRepository;
import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class CicloCompraTests {
  @Autowired JdbcTemplate db;
  @Autowired UsuarioRepository users;
  @Autowired ComprasCicloController ciclo;
  @Autowired OrdenesCompraService ordenes;

  @Test
  void legacyPurchaseStaysVisibleWithoutInventingAnOrder() {
    Long e =
        db.queryForObject(
            "INSERT INTO empresas(razon_social,estado) VALUES ('Compra histórica','ACTIVA')"
                + " RETURNING id",
            Long.class);
    Long u =
        db.queryForObject(
            "INSERT INTO usuarios(empresa_id,nombre,correo,password_hash,rol) VALUES"
                + " (?,'Admin','ciclo@cash.test','test','ADMIN') RETURNING id",
            Long.class,
            e);
    Long l =
        db.queryForObject(
            "INSERT INTO locales(empresa_id,nombre) VALUES (?,'Local') RETURNING id",
            Long.class,
            e);
    Long c =
        db.queryForObject(
            "INSERT INTO"
                + " compras(empresa_id,local_id,proveedor,referencia,total,idempotencia,usuario_original_id,usuario_nombre)"
                + " VALUES (?,?,'Proveedor histórico','ANTERIOR',10,gen_random_uuid(),?,'Admin')"
                + " RETURNING id",
            Long.class,
            e,
            l,
            u);
    var p = new UsuarioPrincipal(users.findById(u).orElseThrow());
    p.seleccionarLocal(l, "Local");
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken(p, null, p.getAuthorities()));
    try {
      var rows = ciclo.ciclo(p);
      assertEquals(1, rows.size());
      assertEquals("HISTORICA", rows.getFirst().get("origen"));
      assertNull(rows.getFirst().get("numero"));
      assertEquals(c, rows.getFirst().get("compra_id"));
      assertEquals(
          0L,
          db.queryForObject(
              "SELECT count(*) FROM ordenes_compra WHERE empresa_id=?", Long.class, e));
      Long producto =
          db.queryForObject(
              "INSERT INTO productos(empresa_id,local_id,sku,nombre,precio,codigo_barras) VALUES"
                  + " (?,?,'HIST','Producto actual',20,'000101') RETURNING id",
              Long.class,
              e,
              l);
      String payload =
          "{\"lineas\":[{\"productoId\":" + producto + ",\"cantidad\":2,\"costo\":4.25}]}";
      Long oc =
          db.queryForObject(
              "INSERT INTO"
                  + " ordenes_compra(empresa_id,local_id,numero,proveedor,referencia,usuario_id,usuario_original_id,usuario_nombre,datos,total,idempotencia)"
                  + " VALUES"
                  + " (?,?,'OC-ANTERIOR','Proveedor','REF',?,?,'Admin',?::jsonb,8.50,gen_random_uuid())"
                  + " RETURNING id",
              Long.class,
              e,
              l,
              u,
              u,
              payload);
      String antes =
          db.queryForObject("SELECT datos::text FROM ordenes_compra WHERE id=?", String.class, oc);
      var detalle = ordenes.orden(p, oc);
      var items = (List<Map<String, Object>>) detalle.get("articulos");
      assertEquals("000101", items.getFirst().get("codigo_barras"));
      assertEquals("Producto actual", items.getFirst().get("nombre"));
      assertEquals("4.25", items.getFirst().get("costo").toString());
      assertEquals(
          antes,
          db.queryForObject("SELECT datos::text FROM ordenes_compra WHERE id=?", String.class, oc));
    } finally {
      SecurityContextHolder.clearContext();
    }
  }
}
