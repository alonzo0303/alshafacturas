package com.alshagroup.alshafacturas.repository;

import com.alshagroup.alshafacturas.entity.Empresa;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpresaRepository extends JpaRepository<Empresa, Long> {

  java.util.Optional<Empresa> findByRuc(String ruc);

  boolean existsByRuc(String ruc);

  @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @org.springframework.data.jpa.repository.Query("SELECT e FROM Empresa e WHERE e.id=:id")
  java.util.Optional<Empresa> paraEditar(
      @org.springframework.data.repository.query.Param("id") Long id);

  @org.springframework.data.jpa.repository.Modifying(
      clearAutomatically = true,
      flushAutomatically = true)
  @org.springframework.data.jpa.repository.Query(
      "UPDATE Empresa e SET e.razonSocial=:nombre,e.direccion=:direccion WHERE e.id=:id")
  int editarDatos(
      @org.springframework.data.repository.query.Param("id") Long id,
      @org.springframework.data.repository.query.Param("nombre") String nombre,
      @org.springframework.data.repository.query.Param("direccion") String direccion);
}
