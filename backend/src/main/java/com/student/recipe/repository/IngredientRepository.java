package com.student.recipe.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.Ingredient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {

    Optional<Ingredient> findBySpoonacularId(Long spoonacularId);

    Optional<Ingredient> findFirstByNameIgnoreCase(String name);

    @Query("SELECT i FROM Ingredient i WHERE i.nameTr IS NULL")
    Page<Ingredient> findAllWithoutTurkishName(Pageable pageable);
}