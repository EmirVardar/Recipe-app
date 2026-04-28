package com.student.recipe.dto.user;

public record NutritionPreferenceResponseDto(
        String dietType,
        String avoidFoods,
        String preferredFoods,
        String budgetLevel
) {
}
