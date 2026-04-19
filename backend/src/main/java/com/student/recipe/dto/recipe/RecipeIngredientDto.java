package com.student.recipe.dto.recipe;

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
