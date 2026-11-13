package com.alshagroup.alshafacturas.comercial;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;

public final class ComercialDtos {
  private ComercialDtos() {}

  public record ProductoRequest(
      @Size(max = 60) String sku,
      @NotBlank @Size(max = 200) String nombre,
      @NotNull @DecimalMin("0") @DecimalMax("999999999.99") @Digits(integer = 9, fraction = 2)
          BigDecimal precio,
      @Min(0) @Max(1000000) int minimo,
      boolean activo,
      @Size(max = 100) String marca,
      @Size(max = 100) String categoria,
      @Size(max = 100) String presentacion,
      @Size(max = 80) String codigoBarras,
      Long catalogoId,
      @Pattern(regexp = "GRAVADO|EXONERADO|INAFECTO|SIN_IGV") String afectacionIgv,
      Boolean precioIncluyeIgv) {
    public ProductoRequest(
        String sku, String nombre, BigDecimal precio, int minimo, boolean activo) {
      this(sku, nombre, precio, minimo, activo, null, null, null, null, null, null, true);
    }
  }

  public record ClienteRequest(
      @NotBlank @Pattern(regexp = "(?:[0-9]{8}|[0-9]{11})") String documento,
      @NotBlank @Size(max = 200) String nombre,
      @Email @Size(max = 150) String correo,
      @Size(max = 255) String direccion) {}

  public record AjusteRequest(
      @NotNull Long productoId,
      @Min(-1000000) @Max(1000000) int cantidad,
      @NotBlank @Size(max = 255) String motivo) {}

  public record LineaVenta(@NotNull Long productoId, @Min(1) @Max(100000) int cantidad) {}

  public record VentaRequest(
      @NotNull UUID idempotencia,
      Long clienteId,
      @NotNull @Pattern(regexp = "TICKET|BOLETA|FACTURA") String tipo,
      @NotNull @Pattern(regexp = "EFECTIVO|TARJETA|TRANSFERENCIA") String metodoPago,
      @NotEmpty @Size(max = 100) List<@NotNull @Valid LineaVenta> lineas) {}

  public record LineaCompra(
      @NotNull Long productoId,
      @Min(1) @Max(100000) int cantidad,
      @NotNull @DecimalMin("0.01") @DecimalMax("999999999.99") @Digits(integer = 9, fraction = 2)
          BigDecimal costo) {}

  public record CompraRequest(
      @NotNull UUID idempotencia,
      @NotBlank @Size(max = 200) String proveedor,
      @NotBlank @Size(max = 100) String referencia,
      @NotEmpty @Size(max = 100) List<@NotNull @Valid LineaCompra> lineas,
      @Pattern(regexp = "(?:[0-9]{11})?") String proveedorRuc,
      @Pattern(regexp = "INTERNO|FACTURA|BOLETA") String tipoDocumento,
      Boolean gravada,
      Boolean costoIncluyeIgv,
      Boolean creditoFiscal) {
    public CompraRequest(
        UUID idempotencia, String proveedor, String referencia, List<LineaCompra> lineas) {
      this(idempotencia, proveedor, referencia, lineas, null, "INTERNO", false, true, false);
    }
  }

  public record AnulacionRequest(@NotBlank @Size(max = 255) String motivo) {}
}
