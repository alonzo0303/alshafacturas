
package com.alshagroup.alshafacturas.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record EmpleadoRequest(

        @NotBlank(message = "El nombre es obligatorio")
        String nombre,

        @NotBlank(message = "El correo es obligatorio")
        @Email(message = "El correo no es valido")
        String correo,

        @NotBlank(message = "La contraseña es obligatoria")
        String password,

        @NotBlank(message = "El rol es obligatorio")
        String rol

) {
}
