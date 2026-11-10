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

  public ComercialController(ComercialService service) {
    this.service = service;
  }

  @GetMapping("/productos")
  public List<Map<String, Object>> productos(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.productos(p.getEmpresaId());
  }

  @PostMapping("/productos")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> crearProducto(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody ProductoRequest r) {
    return service.producto(p.getEmpresaId(), null, r);
  }

  @PutMapping("/productos/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> producto(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody ProductoRequest r) {
    return service.producto(p.getEmpresaId(), id, r);
  }

  @GetMapping("/clientes")
  public List<Map<String, Object>> clientes(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.clientes(p.getEmpresaId());
  }

  @PostMapping("/clientes")
  public Map<String, Object> crearCliente(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody ClienteRequest r) {
    return service.cliente(p.getEmpresaId(), null, r);
  }

  @PutMapping("/clientes/{id}")
  public Map<String, Object> cliente(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody ClienteRequest r) {
    return service.cliente(p.getEmpresaId(), id, r);
  }

  @GetMapping("/inventario")
  @PreAuthorize("hasRole('ADMIN')")
  public List<Map<String, Object>> inventario(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.movimientos(p.getEmpresaId());
  }

  @PostMapping("/inventario/ajustes")
  @PreAuthorize("hasRole('ADMIN')")
  public void ajuste(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody AjusteRequest r) {
    service.ajuste(p, r);
  }

  @GetMapping("/ventas")
  public List<Map<String, Object>> ventas(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.ventas(p.getEmpresaId());
  }

  @GetMapping("/ventas/{id}")
  public Map<String, Object> venta(
      @AuthenticationPrincipal UsuarioPrincipal p, @PathVariable Long id) {
    return service.venta(p.getEmpresaId(), id);
  }

  @PostMapping("/ventas")
  public Map<String, Object> vender(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody VentaRequest r) {
    return service.vender(p, r);
  }

  @PostMapping("/ventas/{id}/anular")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> anular(
      @AuthenticationPrincipal UsuarioPrincipal p,
      @PathVariable Long id,
      @Valid @RequestBody AnulacionRequest r) {
    return service.anular(p, id, r.motivo());
  }

  @GetMapping("/compras")
  @PreAuthorize("hasRole('ADMIN')")
  public List<Map<String, Object>> compras(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.compras(p.getEmpresaId());
  }

  @PostMapping("/compras")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> comprar(
      @AuthenticationPrincipal UsuarioPrincipal p, @Valid @RequestBody CompraRequest r) {
    return service.comprar(p, r);
  }

  @GetMapping("/resumen")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> resumen(@AuthenticationPrincipal UsuarioPrincipal p) {
    return service.resumen(p.getEmpresaId());
  }
}
