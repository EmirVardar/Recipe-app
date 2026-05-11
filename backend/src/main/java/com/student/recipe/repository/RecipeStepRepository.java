package com.student.recipe.repository;

import com.student.recipe.entity.RecipeStep;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RecipeStepRepository extends JpaRepository<RecipeStep, Long> {

    @Query("select rs from RecipeStep rs where rs.instructionTr is null")
    Page<RecipeStep> findAllWithoutTurkishInstruction(Pageable pageable);
}
