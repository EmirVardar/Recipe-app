package com.student.recipe.dto.user;

public record NutritionPreferenceUpdateRequestDto(
        String dietType,
        String avoidFoods,
        String preferredFoods,
        String budgetLevel
) {
}
