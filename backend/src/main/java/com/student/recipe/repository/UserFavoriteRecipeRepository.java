package com.student.recipe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.UserFavoriteRecipe;

public interface UserFavoriteRecipeRepository extends JpaRepository<UserFavoriteRecipe, Long> {

    boolean existsByUserIdAndRecipeId(Long userId, Long recipeId);

    Optional<UserFavoriteRecipe> findByUserIdAndRecipeId(Long userId, Long recipeId);

    List<UserFavoriteRecipe> findAllByUserIdOrderByCreatedAtDesc(Long userId);
}
