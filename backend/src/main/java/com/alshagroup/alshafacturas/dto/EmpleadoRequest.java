package com.alshagroup.alshafacturas.dto;

import jakarta.validation.constraints.*;

public record EmpleadoRequest(
    @NotBlank @Size(max = 150) String nombre,
    @NotBlank @Email @Size(max = 150) String correo,
    @NotBlank @Size(min = 8, max = 72) String password,
    @NotBlank String rol) {}
