package com.alshagroup.alshafacturas.dto;

import jakarta.validation.constraints.*;

public record LoginRequest(
    Long empresaId,
    String ruc,
    @NotBlank @Email @Size(max = 150) String correo,
    @NotBlank @Size(max = 72) String password) {}
