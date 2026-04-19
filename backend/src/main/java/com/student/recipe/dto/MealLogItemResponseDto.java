package com.student.recipe.dto;

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
