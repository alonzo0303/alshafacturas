
package com.alshagroup.alshafacturas.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LoginRequest(

    @NotNull(message = "La empresa es obligatoria")
    Long empresaId,

    @NotBlank(message = "El correo es obligatorio")
    @Email(message = "El correo no tiene un formato valido")
    String correo,

    @NotBlank(message = "La contraseña es obligatoria")
    String password

) {
}
