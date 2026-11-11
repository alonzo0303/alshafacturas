package com.alshagroup.alshafacturas.dto;

public record LoginResponse(
    Long id,
    Long empresaId,
    String nombre,
    String correo,
    String rol,
    java.util.List<String> permisos) {}
