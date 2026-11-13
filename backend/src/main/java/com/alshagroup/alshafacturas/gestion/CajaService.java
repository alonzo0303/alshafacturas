package com.alshagroup.alshafacturas.gestion;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CajaService {
  private final JdbcTemplate db;
  private final AuditoriaService audit;

  public CajaService(JdbcTemplate db, AuditoriaService audit) {
    this.db = db;
    this.audit = audit;
  }

  public Long paraVenta(UsuarioPrincipal p) {
    var rows =
        db.queryForList(
            "SELECT id FROM cajas WHERE empresa_id=? AND local_id=? AND usuario_original_id=? AND"
                + " estado='ABIERTA'",
            Long.class,
            p.getEmpresaId(),
            LocalesService.actual(),
            p.getId());
    if (!rows.isEmpty()) return rows.getFirst();
    if (Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT caja_obligatoria FROM empresas WHERE id=?", Boolean.class, p.getEmpresaId())))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Abre tu caja antes de registrar ventas");
    return null;
  }

  public void validarAnulacion(Object caja) {
    if (caja != null
        && "CERRADA"
            .equals(db.queryForObject("SELECT estado FROM cajas WHERE id=?", String.class, caja)))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "La caja ya está cerrada. No se permite modificar su corte con una anulación interna");
  }

  public Map<String, Object> detalle(Long empresa, Long local, Long id) {
    var rows =
        db.queryForList(
            "SELECT * FROM cajas WHERE empresa_id=? AND local_id=? AND id=?", empresa, local, id);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Caja no encontrada");
    var result = rows.getFirst();
    result.put(
        "medios",
        db.queryForList(
            "SELECT metodo_pago,count(*) AS ventas,COALESCE(sum(total),0) AS total FROM ventas"
                + " WHERE empresa_id=? AND local_id=? AND caja_id=? AND estado='CONFIRMADA' GROUP"
                + " BY metodo_pago ORDER BY metodo_pago",
            empresa,
            local,
            id));
    return result;
  }

  @Transactional
  public Map<String, Object> abrir(UsuarioPrincipal p, BigDecimal fondo) {
    db.queryForObject(
        "SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, p.getEmpresaId());
    long local = LocalesService.actual();
    Long id =
        db.queryForObject(
            "INSERT INTO"
                + " cajas(empresa_id,local_id,usuario_id,usuario_original_id,usuario_nombre,fondo)"
                + " VALUES (?,?,?,?,?,?) RETURNING id",
            Long.class,
            p.getEmpresaId(),
            local,
            p.getId(),
            p.getId(),
            p.getNombre(),
            fondo);
    audit.registrar(p, p.getEmpresaId(), local, "CAJA_ABIERTA", id, "Fondo=" + fondo);
    return detalle(p.getEmpresaId(), local, id);
  }

  @Transactional
  public Map<String, Object> cerrar(
      UsuarioPrincipal p, Long empresa, Long local, Long id, BigDecimal contado) {
    db.queryForObject("SELECT id FROM empresas WHERE id=? FOR UPDATE", Long.class, empresa);
    var rows =
        db.queryForList(
            "SELECT * FROM cajas WHERE empresa_id=? AND local_id=? AND id=? FOR UPDATE",
            empresa,
            local,
            id);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Caja no encontrada");
    var caja = rows.getFirst();
    if (!Set.of("ADMIN", "SUPERADMIN").contains(p.getRol())
        && !Objects.equals(p.getId(), caja.get("usuario_original_id")))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo puedes cerrar tu caja");
    if ("CERRADA".equals(caja.get("estado"))) return detalle(empresa, local, id);
    var totals =
        db.queryForMap(
            "SELECT count(*) AS cantidad,COALESCE(sum(total),0) AS total,COALESCE(sum(total)"
                + " FILTER(WHERE metodo_pago='EFECTIVO'),0) AS efectivo FROM ventas WHERE"
                + " empresa_id=? AND local_id=? AND caja_id=? AND estado='CONFIRMADA'",
            empresa,
            local,
            id);
    BigDecimal esperado = ((BigDecimal) caja.get("fondo")).add((BigDecimal) totals.get("efectivo"));
    db.update(
        "UPDATE cajas SET"
            + " estado='CERRADA',cerrada=CURRENT_TIMESTAMP,cerrado_por=?,cerrado_nombre=?,efectivo_esperado=?,efectivo_contado=?,diferencia=?,total_ventas=?,cantidad_ventas=?"
            + " WHERE id=?",
        p.getId(),
        p.getNombre(),
        esperado,
        contado,
        contado.subtract(esperado),
        totals.get("total"),
        totals.get("cantidad"),
        id);
    audit.registrar(
        p,
        empresa,
        local,
        "CAJA_CERRADA",
        id,
        "Efectivo esperado=" + esperado + ", contado=" + contado);
    return detalle(empresa, local, id);
  }
}
