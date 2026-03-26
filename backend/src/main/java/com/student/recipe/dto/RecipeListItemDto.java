package com.student.recipe.dto;

public record RecipeListItemDto(
        Long id,
        String title,
        String image,
        Integer servings,
        Integer readyInMinutes,
        Double calories
) {
}
