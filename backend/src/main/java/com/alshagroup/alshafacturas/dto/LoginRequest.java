package com.alshagroup.alshafacturas.dto;

import jakarta.validation.constraints.*;

public record LoginRequest(
    Long empresaId, String ruc, @NotBlank @Email String correo, @NotBlank String password) {}
