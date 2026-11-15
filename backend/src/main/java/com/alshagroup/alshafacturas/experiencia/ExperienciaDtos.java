package com.alshagroup.alshafacturas.experiencia;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;

public class ExperienciaDtos {
  public enum Clase {
    SERVICIO,
    LOGISTICA,
    ATENCION
  }

  public enum Operacion {
    VENTAS_CONTAR,
    VENTAS_TOTAL,
    VENTAS_UNIDADES,
    VENTAS_TICKET_PROMEDIO,
    VENTAS_UNIDADES_TICKET,
    VENTAS_COMIDAS,
    CAJAS_CIERRES,
    CAJAS_DIFERENCIA,
    ACTIVIDADES_CREADAS,
    ACTIVIDADES_COMPLETADAS,
    ACTIVIDADES_TIEMPO_PROMEDIO,
    PEDIDOS_TOMADOS,
    PEDIDOS_TIEMPO_PRIMER_SERVICIO,
    INVENTARIO_ROTACION_UNIDADES
  }

  public record Etapa(
      @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,39}") String codigo,
      @NotBlank @Size(max = 100) String nombre) {}

  public record Flujo(
      @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,39}") String codigo,
      @NotBlank @Size(max = 100) String nombre,
      @NotNull Clase clase,
      @NotNull @Size(min = 3, max = 8) List<@NotNull @Valid Etapa> etapas) {}

  public record Metrica(
      @NotBlank @Pattern(regexp = "[a-z][a-z0-9_]{1,39}") String clave,
      @NotBlank @Size(max = 100) String titulo,
      @NotNull Operacion operacion,
      @Pattern(regexp = "[A-Z][A-Z0-9_]{1,39}") String flujoCodigo,
      Clase clase,
      @DecimalMin("0") @DecimalMax("999999999.99") BigDecimal meta) {}

  public record Definicion(
      @NotNull @Size(min = 1, max = 12) List<@NotNull @Valid Metrica> metricas,
      @NotNull @Size(max = 10) List<@NotNull @Valid Flujo> flujos) {}

  public record Plantilla(
      @NotNull UUID idempotencia,
      Long baseId,
      Long empresaPropietariaId,
      @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,39}") String codigo,
      @NotBlank @Size(max = 100) String nombre,
      @NotBlank @Size(max = 100) String rubro,
      @NotNull @Valid Definicion definicion) {}

  public record Config(
      @NotNull @Pattern(regexp = "GENERAL|ESPECIFICO|PERSONALIZADO") String modo,
      Long plantillaId) {}

  public record NuevaActividad(
      @NotNull UUID idempotencia,
      @NotBlank @Size(max = 40) String flujoCodigo,
      @NotBlank @Size(max = 200) String titulo,
      @Size(max = 500) String detalle,
      Long servicioId,
      Long ejecutorId) {}

  public record Paso(
      @NotNull @Min(0) Integer version,
      @NotBlank @Size(max = 40) String estado,
      @Size(max = 500) String motivo) {}

  public record Reasignar(@NotNull @Min(0) Integer version, @NotNull Long ejecutorId) {}

  public enum Trigger {
    POST_LOGIN,
    PAGE_OPEN,
    EXIT_INTENT
  }

  public enum Pagina {
    RESUMEN,
    RENDIMIENTO,
    SERVICIOS,
    MESAS,
    POS,
    ACTIVIDADES,
    OTRA
  }

  public enum Accion {
    CERRAR,
    VER_RENDIMIENTO,
    VER_NOTIFICACIONES,
    VER_ACTIVIDADES
  }

  public enum Condicion {
    SIEMPRE,
    SUSCRIPCION_POR_VENCER
  }

  public enum Frecuencia {
    DIA,
    SESION,
    UNA_VEZ
  }

  public record Aviso(
      @NotNull UUID idempotencia,
      Long baseId,
      Long empresaId,
      Long localId,
      Long plantillaId,
      @NotBlank @Size(max = 100) String nombre,
      @NotBlank @Size(max = 120) String titulo,
      @NotBlank @Size(max = 1500) String mensaje,
      @NotEmpty @Size(max = 3) List<@NotNull Trigger> disparadores,
      @NotNull @Size(max = 10) List<@NotNull Pagina> paginas,
      @NotNull @Size(max = 20) List<@NotBlank @Size(max = 30) String> roles,
      @NotNull Condicion condicion,
      @NotNull Frecuencia frecuencia,
      @Min(0) @Max(100) int prioridad,
      @NotNull Accion accion,
      boolean activa,
      java.time.LocalDate desde,
      java.time.LocalDate hasta) {}

  public record Solicitar(@NotNull Trigger trigger, @NotNull Pagina pagina) {}

  public record Respuesta(
      @NotNull @Pattern(regexp = "MOSTRADO|CERRADO|ACEPTADO|ACCION|LIBERAR") String estado) {}
}
