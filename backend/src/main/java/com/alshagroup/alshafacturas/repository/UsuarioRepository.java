package com.alshagroup.alshafacturas.repository;

import com.alshagroup.alshafacturas.entity.Usuario;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
  @Override
  @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "empresa")
  Optional<Usuario> findById(Long id);

  @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "empresa")
  Optional<Usuario> findByCorreoAndRolAndActivoTrue(String correo, String rol);

  @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "empresa")
  List<Usuario> findByCorreoAndActivoTrue(String correo);

  Optional<Usuario> findByIdAndEmpresaId(Long id, Long empresaId);

  @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "empresa")
  List<Usuario> findByEmpresaId(Long empresaId);

  @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "empresa")
  Optional<Usuario> findByEmpresaIdAndCorreo(Long empresaId, String correo);

  boolean existsByEmpresaIdAndCorreo(Long empresaId, String correo);

  @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "empresa")
  Optional<Usuario> findByEmpresaIdAndCorreoAndActivoTrue(Long empresaId, String correo);
}
