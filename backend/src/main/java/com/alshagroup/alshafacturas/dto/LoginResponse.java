package com.alshagroup.alshafacturas.dto;

public record LoginResponse(
    Long id,
    Long empresaId,
    String nombre,
    String correo,
    String rol,
    java.util.List<String> permisos,
    String modalidad,
    String tipoAtencion,
    Long localId,
    String localNombre,
    String tipoNombre,
    String nichoEmoji,
    String nichoTema,
    String rolNombre,
    String colorPrimario,
    String diseno,
    long aparienciaVersion,
    java.util.List<String> modulosVisibles,
    java.util.List<String> ordenModulos) {}
