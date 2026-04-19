package com.student.recipe.dto.meal;

import java.time.LocalDate;

public record MealLogItemCreateRequestDto(
        LocalDate logDate,
        String mealType,
        Long foodProductId,
        Double quantity,
        String unitType
) {
}
