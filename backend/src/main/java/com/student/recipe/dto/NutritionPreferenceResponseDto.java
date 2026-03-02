package com.student.recipe.dto;

public record NutritionPreferenceResponseDto(
        String dietType,
        String avoidFoods,
        String preferredFoods,
        String budgetLevel
) {
}
