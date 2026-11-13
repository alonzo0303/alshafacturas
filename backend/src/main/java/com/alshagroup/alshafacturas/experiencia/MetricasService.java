package com.alshagroup.alshafacturas.experiencia;

import static com.alshagroup.alshafacturas.experiencia.ExperienciaDtos.*;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.math.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class MetricasService {
  private final JdbcTemplate db;
  private final PerfilesService perfiles;
  private final ExperienciaScope scope;
  private final Clock clock;

  public MetricasService(JdbcTemplate d, PerfilesService p, ExperienciaScope s, Clock c) {
    db = d;
    perfiles = p;
    scope = s;
    clock = c;
  }

  private BigDecimal n(Object v) {
    return v == null ? BigDecimal.ZERO : new BigDecimal(v.toString());
  }

  private BigDecimal sum(List<Map<String, Object>> rows, String field, Long user) {
    return rows.stream()
        .filter(r -> user == null || user.equals(((Number) r.get("colaborador_id")).longValue()))
        .map(r -> n(r.get(field)))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  private BigDecimal ratio(BigDecimal a, BigDecimal b) {
    return b.signum() == 0 ? null : a.divide(b, 2, RoundingMode.HALF_UP);
  }

  private BigDecimal stockPromedio(long e, long l, Timestamp start, Timestamp requestedEnd) {
    Instant end =
        clock.instant().isBefore(requestedEnd.toInstant())
            ? clock.instant()
            : requestedEnd.toInstant();
    if (!end.isAfter(start.toInstant())) return null;
    var value =
        db.queryForObject(
            "WITH puntos AS (SELECT p.id AS producto_id,COALESCE((SELECT saldo FROM movimientos m"
                + " WHERE m.empresa_id=p.empresa_id AND m.local_id=p.local_id AND"
                + " m.producto_id=p.id AND m.fecha<? ORDER BY fecha DESC,id DESC LIMIT"
                + " 1),0)::numeric AS saldo,?::timestamptz AS fecha,0::bigint AS orden FROM"
                + " productos p WHERE p.empresa_id=? AND p.local_id=? AND p.clase='PRODUCTO' UNION"
                + " ALL SELECT m.producto_id,m.saldo,m.fecha,m.id FROM movimientos m JOIN productos"
                + " p ON p.id=m.producto_id WHERE m.empresa_id=? AND m.local_id=? AND"
                + " p.clase='PRODUCTO' AND m.fecha>=? AND m.fecha<?),segmentos AS (SELECT"
                + " saldo,fecha,lead(fecha,1,?::timestamptz) OVER(PARTITION BY producto_id ORDER BY"
                + " fecha,orden) AS fin FROM puntos) SELECT COALESCE(sum(saldo*EXTRACT(EPOCH FROM"
                + " fin-fecha)),0) FROM segmentos",
            BigDecimal.class,
            start,
            start,
            e,
            l,
            e,
            l,
            start,
            Timestamp.from(end),
            Timestamp.from(end));
    return value.divide(
        BigDecimal.valueOf(Duration.between(start.toInstant(), end).toNanos())
            .divide(BigDecimal.valueOf(1000000000)),
        8,
        RoundingMode.HALF_UP);
  }

  public Map<String, Object> reporte(
      UsuarioPrincipal p,
      long e,
      long l,
      Timestamp start,
      Timestamp end,
      List<Map<String, Object>> ventas,
      List<Map<String, Object>> cajas) {
    boolean all = scope.equipo(p);
    var config = perfiles.configuracion(e, l);
    var template = (Map<String, Object>) config.get("plantilla");
    var definition = (Definicion) template.get("definicion");
    var actividades =
        db.queryForList(
            "SELECT a.ejecutor_original_id AS colaborador_id,a.ejecutor_nombre AS"
                + " colaborador,t.familia,a.flujo_codigo,a.flujo_definicion->>'clase' AS"
                + " clase,count(*) FILTER(WHERE a.creada>=? AND a.creada<?) AS creadas,count(*)"
                + " FILTER(WHERE a.finalizada AND a.completada>=? AND a.completada<?) AS"
                + " completadas,COALESCE(sum(EXTRACT(EPOCH FROM a.completada-a.iniciada))"
                + " FILTER(WHERE a.finalizada AND a.iniciada IS NOT NULL AND"
                + " a.completada>=a.iniciada AND a.completada>=? AND a.completada<?),0) AS"
                + " segundos,count(*) FILTER(WHERE a.finalizada AND a.iniciada IS NOT NULL AND"
                + " a.completada>=a.iniciada AND a.completada>=? AND a.completada<?) AS medidas"
                + " FROM actividades a JOIN rendimiento_plantillas t ON t.id=a.plantilla_id WHERE"
                + " a.empresa_id=? AND a.local_id=? AND (? OR a.ejecutor_original_id=?) AND"
                + " ((a.creada>=? AND a.creada<?) OR (a.completada>=? AND a.completada<?)) GROUP BY"
                + " a.ejecutor_original_id,a.ejecutor_nombre,t.familia,a.flujo_codigo,a.flujo_definicion->>'clase'",
            start,
            end,
            start,
            end,
            start,
            end,
            start,
            end,
            e,
            l,
            all,
            p.getId(),
            start,
            end,
            start,
            end);
    var pedidos =
        db.queryForList(
            "SELECT usuario_original_id AS colaborador_id,usuario_nombre AS colaborador,count(*)"
                + " FILTER(WHERE fecha>=? AND fecha<?) AS pedidos,COALESCE(sum(EXTRACT(EPOCH FROM"
                + " servido_en-fecha)) FILTER(WHERE servido_en>=? AND servido_en<? AND"
                + " servido_en>=fecha),0) AS segundos,count(*) FILTER(WHERE servido_en>=? AND"
                + " servido_en<? AND servido_en>=fecha) AS medidas FROM pedidos WHERE empresa_id=?"
                + " AND local_id=? AND clase='MESA' AND estado<>'CANCELADO' AND (? OR"
                + " usuario_original_id=?) AND ((fecha>=? AND fecha<?) OR (servido_en>=? AND"
                + " servido_en<?)) GROUP BY usuario_original_id,usuario_nombre",
            start,
            end,
            start,
            end,
            start,
            end,
            e,
            l,
            all,
            p.getId(),
            start,
            end,
            start,
            end);
    var people = new LinkedHashMap<Long, String>();
    for (var group : List.of(ventas, cajas, actividades, pedidos))
      for (var r : group)
        if (r.get("colaborador_id") instanceof Number id)
          people.putIfAbsent(
              id.longValue(), Objects.toString(r.get("colaborador"), "Usuario #" + id));
    if (all)
      for (var user :
          db.queryForList(
              "SELECT id,nombre FROM usuarios u WHERE empresa_id=? AND activo AND rol<>'SUPERADMIN'"
                  + " AND (rol='ADMIN' OR EXISTS(SELECT 1 FROM usuario_locales ul WHERE"
                  + " ul.usuario_id=u.id AND ul.local_id=?) OR (NOT EXISTS(SELECT 1 FROM"
                  + " usuario_locales ul WHERE ul.usuario_id=u.id) AND ?=(SELECT min(id) FROM"
                  + " locales WHERE empresa_id=u.empresa_id)))",
              e,
              l,
              l))
        people.putIfAbsent(((Number) user.get("id")).longValue(), user.get("nombre").toString());
    if (!all) people.put(p.getId(), p.getNombre());
    BigDecimal stock =
        all
                && definition.metricas().stream()
                    .anyMatch(m -> m.operacion() == Operacion.INVENTARIO_ROTACION_UNIDADES)
            ? stockPromedio(e, l, start, end)
            : null;
    BigDecimal vendidas =
        stock == null
            ? null
            : db.queryForObject(
                "SELECT COALESCE(sum(d.cantidad),0) FROM ventas v JOIN venta_detalles d ON"
                    + " d.venta_id=v.id WHERE v.empresa_id=? AND v.local_id=? AND"
                    + " v.estado='CONFIRMADA' AND v.fecha>=? AND v.fecha<? AND d.clase='PRODUCTO'",
                BigDecimal.class,
                e,
                l,
                start,
                end);
    var generales = new ArrayList<Map<String, Object>>();
    var colaboradores = new ArrayList<Map<String, Object>>();
    for (var m : definition.metricas())
      generales.add(
          calcular(
              m,
              null,
              all,
              template.get("familia"),
              stock,
              vendidas,
              ventas,
              cajas,
              actividades,
              pedidos));
    people.forEach(
        (id, name) -> {
          var values = new ArrayList<Map<String, Object>>();
          for (var m : definition.metricas())
            values.add(
                calcular(
                    m,
                    id,
                    all,
                    template.get("familia"),
                    stock,
                    vendidas,
                    ventas,
                    cajas,
                    actividades,
                    pedidos));
          colaboradores.add(Map.of("id", id, "nombre", name, "metricas", values));
        });
    return Map.of(
        "configuracion",
        config,
        "metricas",
        generales,
        "colaboradores",
        colaboradores,
        "atribucion",
        "Ventas: quien cobra. Actividades: responsable asignado. Pedidos: quien los toma. Cierres:"
            + " quien cierra caja.");
  }

  private Map<String, Object> calcular(
      Metrica m,
      Long user,
      boolean all,
      Object familia,
      BigDecimal stock,
      BigDecimal vendidas,
      List<Map<String, Object>> ventas,
      List<Map<String, Object>> cajas,
      List<Map<String, Object>> actividades,
      List<Map<String, Object>> pedidos) {
    var tasks =
        actividades.stream()
            .filter(
                r ->
                    m.flujoCodigo() == null
                        || (m.flujoCodigo().equals(r.get("flujo_codigo"))
                            && familia.equals(r.get("familia"))))
            .filter(r -> m.clase() == null || m.clase().name().equals(r.get("clase")))
            .toList();
    String unidad = "ENTERO", detalle = "";
    BigDecimal value = null;
    switch (m.operacion()) {
      case VENTAS_CONTAR -> value = sum(ventas, "ventas", user);
      case VENTAS_TOTAL -> {
        value = sum(ventas, "total", user);
        unidad = "MONEDA";
      }
      case VENTAS_UNIDADES -> value = sum(ventas, "unidades", user);
      case VENTAS_COMIDAS -> value = sum(ventas, "comidas", user);
      case VENTAS_TICKET_PROMEDIO -> {
        value = ratio(sum(ventas, "total", user), sum(ventas, "ventas", user));
        unidad = "MONEDA";
      }
      case VENTAS_UNIDADES_TICKET -> {
        value = ratio(sum(ventas, "unidades", user), sum(ventas, "ventas", user));
        unidad = "RATIO";
      }
      case CAJAS_CIERRES -> value = sum(cajas, "cortes", user);
      case CAJAS_DIFERENCIA -> {
        value = sum(cajas, "diferencia", user);
        unidad = "MONEDA";
      }
      case ACTIVIDADES_CREADAS -> value = sum(tasks, "creadas", user);
      case ACTIVIDADES_COMPLETADAS -> value = sum(tasks, "completadas", user);
      case ACTIVIDADES_TIEMPO_PROMEDIO -> {
        value =
            ratio(
                sum(tasks, "segundos", user),
                sum(tasks, "medidas", user).multiply(BigDecimal.valueOf(60)));
        unidad = "MINUTOS";
      }
      case PEDIDOS_TOMADOS -> value = sum(pedidos, "pedidos", user);
      case PEDIDOS_TIEMPO_PRIMER_SERVICIO -> {
        value =
            ratio(
                sum(pedidos, "segundos", user),
                sum(pedidos, "medidas", user).multiply(BigDecimal.valueOf(60)));
        unidad = "MINUTOS";
      }
      case INVENTARIO_ROTACION_UNIDADES -> {
        unidad = "RATIO";
        if (all && user == null && stock != null) value = ratio(vendidas, stock);
        detalle =
            !all
                ? "Indicador restringido al administrador del local"
                : user != null
                    ? "Indicador del local; no se atribuye a una persona"
                    : "Unidades vendidas / stock promedio ponderado observado. No es rotación"
                          + " contable valorizada.";
      }
    }
    var result = new LinkedHashMap<String, Object>();
    result.put("clave", m.clave());
    result.put("titulo", m.titulo());
    result.put("operacion", m.operacion());
    result.put(
        "valor",
        value == null
            ? null
            : value.setScale(unidad.equals("ENTERO") ? 0 : 2, RoundingMode.HALF_UP));
    result.put("unidad", unidad);
    result.put("disponible", value != null);
    result.put(
        "detalle",
        value == null && detalle.isEmpty()
            ? "Sin medición disponible: faltan operaciones o tiempos reales para este período."
            : detalle);
    result.put("meta", m.meta());
    result.put(
        "alcance",
        m.operacion() == Operacion.INVENTARIO_ROTACION_UNIDADES ? "LOCAL" : "COLABORADOR");
    return result;
  }
}
