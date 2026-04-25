package com.student.recipe.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.Ingredient;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {

    Optional<Ingredient> findBySpoonacularId(Long spoonacularId);

    Optional<Ingredient> findFirstByNameIgnoreCase(String name);
}