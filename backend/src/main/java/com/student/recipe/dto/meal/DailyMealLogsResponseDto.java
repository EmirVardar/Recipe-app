package com.student.recipe.dto.meal;

import java.time.LocalDate;
import java.util.List;

public record DailyMealLogsResponseDto(
        LocalDate logDate,
        Double totalCalories,
        Double totalProtein,
        Double totalCarbs,
        Double totalFat,
        List<MealLogResponseDto> meals
) {
}
