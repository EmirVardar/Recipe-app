package com.student.recipe.dto;

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
