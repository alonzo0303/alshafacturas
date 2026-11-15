package com.alshagroup.alshafacturas.visual;

import java.util.*;

public final class Modulos {
  private Modulos() {}

  public static final List<String> TODOS =
      List.of(
          "RESUMEN",
          "PRODUCTOS",
          "SERVICIOS",
          "VENTAS",
          "CLIENTES",
          "INVENTARIO",
          "COMPRAS",
          "PREPARACION",
          "MESAS",
          "CAJA",
          "ACTIVIDADES",
          "RENDIMIENTO",
          "FACTURACION",
          "IMPUESTOS");

  public static String dePermiso(String permiso) {
    return switch (permiso) {
      case "FACTURACION_EMITIR", "FACTURACION_VER" -> "FACTURACION";
      case "VENTAS_ANULAR", "VENTAS_GESTIONAR" -> "VENTAS";
      default -> permiso.substring(0, permiso.indexOf('_'));
    };
  }

  public static List<String> lista(String[] raw) {
    return raw == null ? TODOS : List.of(raw);
  }
}
