package com.student.recipe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.Recipe;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    @EntityGraph(attributePaths = "recipeNutrition")
    List<Recipe> findAllByOrderByCreatedAtDesc();

    Optional<Recipe> findBySpoonacularId(Long spoonacularId);
}
