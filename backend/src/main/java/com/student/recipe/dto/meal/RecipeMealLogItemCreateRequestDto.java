package com.student.recipe.dto.meal;

import java.time.LocalDate;

public record RecipeMealLogItemCreateRequestDto(
        LocalDate logDate,
        String mealType,
        Long recipeId,
        Double servings
) {
}