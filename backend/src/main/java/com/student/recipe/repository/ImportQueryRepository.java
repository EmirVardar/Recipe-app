package com.student.recipe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.ImportQuery;

public interface ImportQueryRepository extends JpaRepository<ImportQuery, Long> {

    Optional<ImportQuery> findByQueryTextIgnoreCase(String queryText);

    List<ImportQuery> findAllBySearchedFalseOrderByIdAsc();
}
