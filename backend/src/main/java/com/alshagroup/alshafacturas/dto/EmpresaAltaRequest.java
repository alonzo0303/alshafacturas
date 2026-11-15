package com.alshagroup.alshafacturas.dto;

import jakarta.validation.constraints.*;

public record EmpresaAltaRequest(
    @Pattern(regexp = "(?:[0-9]{11})?") String ruc,
    @NotBlank @Size(max = 200) String razonSocial,
    @Size(max = 255) String direccion,
    @NotBlank @Size(max = 150) String administradorNombre,
    @NotBlank @Email @Size(max = 150) String administradorCorreo,
    @NotBlank @Size(min = 8, max = 72) String administradorPassword,
    @Size(max = 100) String rubroNegocio) {}
