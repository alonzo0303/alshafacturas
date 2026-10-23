
package com.alshagroup.alshafacturas.exception;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> manejarValidaciones(
            MethodArgumentNotValidException ex) {

        String mensaje = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .findFirst()
                .map(error -> error.getDefaultMessage())
                .orElse("Los datos enviados no son validos");

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(Map.of("mensaje", mensaje));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> manejarErroresHttp(
            ResponseStatusException ex) {

        String mensaje = ex.getReason() != null
                ? ex.getReason()
                : "Ocurrio un error en la solicitud";

        return ResponseEntity
                .status(ex.getStatusCode())
                .body(Map.of("mensaje", mensaje));
    }
}
