
package com.alshagroup.alshafacturas.repository;

import com.alshagroup.alshafacturas.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    List<Usuario> findByEmpresaId(Long empresaId);

    Optional<Usuario> findByEmpresaIdAndCorreo(
        Long empresaId,
        String correo
    );

    boolean existsByEmpresaIdAndCorreo(
        Long empresaId,
        String correo
    );
    
Optional<Usuario> findByEmpresaIdAndCorreoAndActivoTrue(
        Long empresaId,
        String correo
);

}
