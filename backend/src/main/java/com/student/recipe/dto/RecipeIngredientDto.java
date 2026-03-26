package com.student.recipe.dto;

public record RecipeIngredientDto(
        Long ingredientId,
        Long spoonacularId,
        String name,
        String originalName,
        String image,
        Double amount,
        String unit,
        String consistency,
        String aisle,
        String originalText
) {
}
