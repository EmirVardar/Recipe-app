package com.student.recipe.dto;

public record NutritionPreferenceUpdateRequestDto(
        String dietType,
        String avoidFoods,
        String preferredFoods,
        String budgetLevel
) {
}
