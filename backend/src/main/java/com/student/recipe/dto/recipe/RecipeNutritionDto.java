package com.student.recipe.dto.recipe;

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
