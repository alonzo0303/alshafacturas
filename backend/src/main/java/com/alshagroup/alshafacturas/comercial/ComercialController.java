package com.alshagroup.alshafacturas.comercial;

import static com.alshagroup.alshafacturas.comercial.ComercialDtos.*;

import com.alshagroup.alshafacturas.security.UsuarioPrincipal;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ComercialController {
  private final ComercialService service;

  private final com.alshagroup.alshafacturas.gestion.OrdenesCompraService ordenes;

  public ComercialController(
      ComercialService service, com.alshagroup.alshafacturas.gestion.OrdenesCompraService ordenes) {
    this.ordenes = ordenes;
    this.service = service;
  }

  @GetMapping("/productos")
  @PreAuthorize("hasAuthority('PRODUCTOS_VER')")
  public List<Map<String, Object>> productos(@AuthenticationPrincipal UsuarioPrincipal p) {
    var productos = service.productos(p.getEmpresaId());
    if (!"ADMIN".equals(p.getRol())) productos.forEach(producto -> producto.remove("ultimo_costo"));
    return productos;
  }

  @PostMapping("/productos")
  @PreAuthorize("hasAuthority('PRODUCTOS_EDITAR')")
  public Map<String, Object> crearProducto(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody ProductoRequest r) {
    return productoVisible(p, service.producto(p.getEmpresaId(), null, r));
  }

  @PutMapping("/productos/{id}")
  @PreAuthorize("hasAuthority('PRODUCTOS_EDITAR')")
  public Map<String, Object> producto(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody ProductoRequest r) {
    return productoVisible(p, service.producto(p.getEmpresaId(), id, r));
  }

  private Map<String, Object> productoVisible(UsuarioPrincipal p, Map<String, Object> producto) {
    if (!"ADMIN".equals(p.getRol())) producto.remove("ultimo_costo");
    return producto;
  }

  @GetMapping("/clientes")
  @PreAuthorize("hasAnyAuthority('CLIENTES_GESTIONAR','VENTAS_GESTIONAR')")
  public List<Map<String, Object>> clientes(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.clientes(p.getEmpresaId());
  }

  @PostMapping("/clientes")
  @PreAuthorize("hasAuthority('CLIENTES_GESTIONAR')")
  public Map<String, Object> crearCliente(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody ClienteRequest r) {
    return service.cliente(p.getEmpresaId(), null, r);
  }

  @PutMapping("/clientes/{id}")
  @PreAuthorize("hasAuthority('CLIENTES_GESTIONAR')")
  public Map<String, Object> cliente(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody ClienteRequest r) {
    return service.cliente(p.getEmpresaId(), id, r);
  }

  @GetMapping("/inventario")
  @PreAuthorize("hasAuthority('INVENTARIO_VER')")
  public List<Map<String, Object>> inventario(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.movimientos(p);
  }

  @PostMapping("/inventario/ajustes")
  @PreAuthorize("hasAuthority('INVENTARIO_EDITAR')")
  public void ajuste(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody AjusteRequest r) {
    service.ajuste(p, r);
  }

  @GetMapping("/ventas")
  @PreAuthorize(
      "authentication.principal.modulosVisibles.contains('VENTAS') and"
          + " hasAnyAuthority('VENTAS_GESTIONAR','FACTURACION_VER')")
  public List<Map<String, Object>> ventas(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.ventas(p);
  }

  @GetMapping("/ventas/{id}")
  @PreAuthorize("hasAuthority('VENTAS_GESTIONAR')")
  public Map<String, Object> venta(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    return service.ventaAutorizada(p, id);
  }

  @PostMapping("/ventas")
  @PreAuthorize("hasAuthority('VENTAS_GESTIONAR')")
  public Map<String, Object> vender(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody VentaRequest r) {
    return service.vender(p, r);
  }

  @PostMapping("/ventas/{id}/anular")
  @PreAuthorize("hasAuthority('VENTAS_ANULAR')")
  public Map<String, Object> anular(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody AnulacionRequest r) {
    return service.anular(p, id, r.motivo());
  }

  @GetMapping("/compras")
  @PreAuthorize("hasAuthority('COMPRAS_GESTIONAR')")
  public List<Map<String, Object>> compras(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.compras(p);
  }

  @PostMapping("/compras")
  @PreAuthorize("hasAuthority('COMPRAS_GESTIONAR')")
  public Map<String, Object> comprar(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody CompraRequest r) {
    return ordenes.crear(p, r);
  }

  @GetMapping("/resumen")
  @PreAuthorize("hasAuthority('RESUMEN_VER')")
  public Map<String, Object> resumen(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.resumen(p);
  }
}
