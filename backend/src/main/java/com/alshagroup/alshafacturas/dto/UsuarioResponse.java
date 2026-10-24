
package com.alshagroup.alshafacturas.dto;

public record UsuarioResponse(
    Long id,
    Long empresaId,
    String nombre,
    String correo,
    String rol,
    Boolean activo
) {
}
