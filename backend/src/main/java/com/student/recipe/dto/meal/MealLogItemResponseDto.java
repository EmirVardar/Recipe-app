package com.student.recipe.dto.meal;

public record MealLogItemResponseDto(
        Long id,
        Long foodProductId,
        String foodName,
        Double quantity,
        String unitType,
        Double gramEquivalent,
        Double calories,
        Double protein,
        Double carbs,
        Double fat
) {
}
