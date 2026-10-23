
package com.alshagroup.alshafacturas.repository;

import com.alshagroup.alshafacturas.entity.Empresa;
import org.springframework.data.jpa.repository.JpaRepository;


public interface EmpresaRepository extends JpaRepository<Empresa, Long> {

    boolean existsByRuc(String ruc);

}
