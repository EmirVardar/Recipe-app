package com.student.recipe.dto;

import java.time.LocalDate;

public record MealLogItemCreateRequestDto(
        LocalDate logDate,
        String mealType,
        Long foodProductId,
        Double quantity,
        String unitType
) {
}
