package com.student.recipe.dto.recipe;

public record RecipeListItemDto(
        Long id,
        String title,
        String image,
        String primaryCategory,
        Integer servings,
        Integer readyInMinutes,
        Double calories,
        boolean favorited
) {
}
