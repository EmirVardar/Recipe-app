package com.student.recipe.dto.meal;

import java.util.List;

public record MealLogResponseDto(
        Long id,
        String mealType,
        Double totalCalories,
        Double totalProtein,
        Double totalCarbs,
        Double totalFat,
        List<MealLogItemResponseDto> items
) {
}
