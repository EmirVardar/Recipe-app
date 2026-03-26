package com.student.recipe.dto;

public record RecipeNutritionDto(
        Double calories,
        Double protein,
        Double fat,
        Double carbs,
        Double fiber,
        Double sugar,
        Double sodium
) {
}
